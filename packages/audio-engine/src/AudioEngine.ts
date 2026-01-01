/**
 * V3 Audio Engine
 * - Process-level singleton (getAudioEngine())
 * - Orchestrates 3 players: Affirmations, Binaural, Background
 * - Manages playback state, mix levels, and looping
 * 
 * Refactored to use modular components:
 * - AudioSession: Audio session configuration
 * - PlayerManager: Player lifecycle management
 * - PrerollManager: Pre-roll atmosphere handling
 * - MixerController: Mix automation, crossfade, control loop
 * - DriftCorrector: Drift correction for looping tracks
 */

import { type PlaybackBundleVM } from "@ab/contracts";
import type { AudioEngineSnapshot, Mix } from "./types";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import { VoiceActivityDucker } from "./ducking";
import { AudioSession } from "./AudioSession";
import { waitForPlayerReady, waitForPlayersReady } from "./PlayerManager";
import { PrerollManager } from "./PrerollManager";
import { MixerController } from "./MixerController";
// Drift correction disabled - see DriftCorrector.ts for rationale

/**
 * Cache remote audio URIs locally to avoid network stalls during playback
 * Uses expo-asset to download and cache HTTP/HTTPS URLs to local file:// URIs
 * This eliminates "random" split-second dropouts from network buffering
 * 
 * NOTE: PlayerScreen already resolves bundled assets to local URIs, so this
 * primarily handles cases where bundled resolution fails and we get S3/HTTP URLs.
 */
async function toCachedUri(uri: string): Promise<string> {
  // If already local (file:// or bundled asset), return as-is (no caching needed)
  if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
    return uri;
  }
  
  // Only cache remote URLs (S3, HTTP) - these can cause network buffering stalls
  try {
    const asset = Asset.fromURI(uri);
    // Download if not already cached
    if (!asset.localUri) {
      console.log(`[AudioEngine] Caching remote asset (fallback from bundled resolution): ${uri.substring(0, 60)}...`);
      await asset.downloadAsync();
    }
    // Return local URI (file://) for gapless playback
    return asset.localUri ?? uri;
  } catch (error) {
    console.warn(`[AudioEngine] Failed to cache remote asset ${uri}, using remote (may cause buffering):`, error);
    // Fallback to remote URI if caching fails
    return uri;
  }
}

/**
 * V3 Audio Engine
 * - Process-level singleton (getAudioEngine())
 * - Orchestrates 3 players: Affirmations, Binaural, Background
 * - Manages playback state, mix levels, and looping
 */
export class AudioEngine {
  // Build proof - if you see this timestamp, you're running the compiled version
  private static readonly BUILD_PROOF = "2025-01-14T00:00:00Z";
  
  private snapshot: AudioEngineSnapshot = {
    status: "idle",
    positionMs: 0,
    durationMs: 0,
    mix: { affirmations: 1, binaural: 0.05, background: 0.3 }, // Default: affirmations 100%, background 30%, binaural 5%
    sessionDurationCapMs: "unlimited",
    totalPlaybackTimeMs: 0,
  };
  
  // Track if user has explicitly adjusted volumes (prevents reset on reload)
  private hasUserSetMix: boolean = false;
  
  // P1.1: Session duration tracking for Free tier cap (5 minutes)
  private sessionStartTime: number | null = null;
  private totalPlaybackTimeMs: number = 0;
  private sessionDurationCapMs: number | "unlimited" = "unlimited";
  private isFadingOut: boolean = false;
  private lastPlaybackCheck: number = 0;

  private listeners = new Set<(s: AudioEngineSnapshot) => void>();
  private queue: Promise<void> = Promise.resolve();

  // Players
  private affPlayer: AudioPlayer | null = null;
  private binPlayer: AudioPlayer | null = null;
  private bgPlayer: AudioPlayer | null = null;

  // Position Polling (250ms for UI)
  private interval: ReturnType<typeof setInterval> | null = null;
  
  // Control Tick Loop (75ms for mixer/ducking/smoothing - reduced from 25ms for performance)
  private controlInterval: ReturnType<typeof setInterval> | null = null;
  
  // Current bundle
  private currentBundle: PlaybackBundleVM | null = null;
  
  // Modular components
  private audioSession: AudioSession;
  private prerollManager: PrerollManager;
  private mixerController: MixerController;
  
  // Drift correction
  private lastDriftCheck: number = 0;
  
  // UNIFIED PLAYBACK WATCHDOG
  // Instead of multiple restart mechanisms fighting each other, we use a single
  // debounced watchdog that only restarts if player is *persistently* stopped.
  // This prevents transient state flickers from causing micro-disruptions.
  
  // Track when each player was first detected as stopped (0 = not stopped)
  private affStoppedAt: number = 0;
  private binStoppedAt: number = 0;
  private bgStoppedAt: number = 0;
  
  // Track last known position for each player (to detect if playback is advancing)
  private affLastPosition: number = 0;
  private binLastPosition: number = 0;
  private bgLastPosition: number = 0;
  
  // Track failed restart attempts to prevent infinite loops
  private affFailedRestarts: number = 0;
  private binFailedRestarts: number = 0;
  private bgFailedRestarts: number = 0;
  
  // Debounce threshold: only restart if stopped for this long (ms)
  // This prevents reacting to transient expo-audio state flickers
  private static readonly WATCHDOG_DEBOUNCE_MS = 400;
  
  // Max failed restart attempts before giving up (prevents infinite loops)
  private static readonly MAX_FAILED_RESTARTS = 3;

  constructor() {
    console.log("[AudioEngine] BUILD PROOF:", AudioEngine.BUILD_PROOF);
    
    // Initialize modular components
    this.audioSession = new AudioSession();
    this.prerollManager = new PrerollManager();
    this.mixerController = new MixerController();
    
    // Connect preroll smoother to mixer controller
    this.mixerController.setPrerollSmoother(this.prerollManager.getSmoother());
  }

  subscribe(listener: (s: AudioEngineSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getState(): AudioEngineSnapshot {
    return this.snapshot;
  }

  private setState(patch: Partial<AudioEngineSnapshot>) {
    const oldStatus = this.snapshot.status;
    this.snapshot = { ...this.snapshot, ...patch };
    const newStatus = this.snapshot.status;
    
    // Dev-only state transition logging
    if ((typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production') {
      if (oldStatus !== newStatus) {
        console.log(`[AudioEngine] ${oldStatus} → ${newStatus} @ ${Date.now()}`);
      }
    }
    
    for (const l of this.listeners) l(this.snapshot);
  }

  // Serialized command queue execution
  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(fn).catch((err) => {
      console.error("[AudioEngine] Error:", err);
      this.setState({ status: "error", error: { message: "AudioEngine error", details: err } });
    });
    return this.queue;
  }

  private startPolling() {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      if (this.affPlayer) {
        // Use affirmation player as the "master" timekeeper
        const pos = this.affPlayer.currentTime * 1000; // seconds to ms
        const duration = this.affPlayer.duration * 1000; // seconds to ms
        
        // P1.1: Track total playback time for Free tier cap (5 minutes)
        // Compute currentTotalMs once per tick (only if playing)
        let totalPlaybackTimeMsToUse: number;
        if (this.snapshot.status === "playing" && this.sessionStartTime) {
          const now = Date.now();
          // Calculate elapsed time since current play session started
          const elapsedSinceStart = now - this.sessionStartTime;
          // Current total = previously accumulated time + current session elapsed time
          const currentTotalMs = this.totalPlaybackTimeMs + elapsedSinceStart;
          totalPlaybackTimeMsToUse = currentTotalMs;
          
          // Check if we've hit the duration cap
          if (
            typeof this.sessionDurationCapMs === "number" &&
            currentTotalMs >= this.sessionDurationCapMs &&
            !this.isFadingOut
          ) {
            const remainingMs = currentTotalMs - this.sessionDurationCapMs;
            if (remainingMs < 1000) { // Only trigger once (within 1 second of cap)
              console.log(`[AudioEngine] Session duration cap reached (${this.sessionDurationCapMs}ms = ${this.sessionDurationCapMs / 60000} minutes), starting fade-out`);
              this.startFadeOut();
            }
          }
        } else {
          // Not playing - use stored total
          totalPlaybackTimeMsToUse = this.totalPlaybackTimeMs;
        }
        
        // Single setState per tick with all values
        this.setState({ 
          positionMs: pos,
          durationMs: duration,
          sessionDurationCapMs: this.sessionDurationCapMs,
          totalPlaybackTimeMs: totalPlaybackTimeMsToUse,
        });
      }
    }, 250);
  }

  private stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Start control tick loop (75ms) for mixer, ducking, smoothing
   * Runs only when preroll or playing
   * Reduced from 25ms to 75ms to reduce CPU spikes and audio-thread contention in React Native
   */
  private startControlLoop() {
    if (this.controlInterval) return; // Already running
    
    this.controlInterval = setInterval(() => {
      this.controlTick();
    }, 75); // ~13 Hz control rate (reduced from 40 Hz for better performance)
  }

  private stopControlLoop() {
    if (this.controlInterval) {
      clearInterval(this.controlInterval);
      this.controlInterval = null;
    }
  }

  /**
   * Control tick - delegates to MixerController
   * Called every 75ms when playing or prerolling (reduced from 25ms for performance)
   */
  private controlTick(): void {
    const status = this.snapshot.status;
    const positionMs = this.snapshot.positionMs;

    // Only run control loop during preroll or playing
    if (status !== "preroll" && status !== "playing") {
      return;
    }

    // Delegate to mixer controller
    const { crossfadeComplete } = this.mixerController.controlTick(
      status,
      positionMs,
      this.snapshot.mix,
      this.affPlayer,
      this.binPlayer,
      this.bgPlayer,
      this.prerollManager.getPlayer()
    );

    // Handle crossfade completion
    if (crossfadeComplete) {
      this.mixerController.completeCrossfade();
      const prerollPlayer = this.prerollManager.getPlayer();
      if (prerollPlayer) {
        prerollPlayer.pause();
        prerollPlayer.release();
      }
      this.prerollManager.stop(0); // Clean up
      this.setState({ status: "playing" });
    }

    // UNIFIED PLAYBACK WATCHDOG
    // Single source of truth for player recovery. Only restarts if player is *persistently* stopped.
    // This prevents transient expo-audio state flickers from causing micro-disruptions.
    const now = Date.now();
    if (status === "playing") {
      // Helper: Check if player is truly stopped (buffer-aware, EOF-aware, debounced)
      // expo-audio doesn't auto-rewind at EOF - must seekTo(0) before replay
      // Also ignore buffering states to avoid false positives
      const checkAndRestartPlayer = (
        player: AudioPlayer | null,
        name: string,
        stoppedAt: number,
        lastPosition: number,
        failedRestarts: number,
        setStoppedAt: (t: number) => void,
        setLastPosition: (p: number) => void,
        setFailedRestarts: (n: number) => void,
        isLoopingTrack: boolean = false // Background and binaural are looping
      ) => {
        if (!player) return;
        
        // Skip if duration is invalid (NaN, 0, or negative)
        // BUT: If player is actually playing, duration NaN is OK (expo-audio sometimes reports NaN during initial load)
        const playerDuration = player.duration;
        if (isNaN(playerDuration) || playerDuration <= 0) {
          // If player is actually playing, duration NaN is fine - expo-audio will load it eventually
          if (player.playing) {
            // Player is playing, just update position and return (don't treat as failure)
            setLastPosition(player.currentTime);
            if (stoppedAt !== 0) setStoppedAt(0); // Reset any stopped timer
            if (failedRestarts > 0) setFailedRestarts(0); // Reset failed count if it was playing
            return;
          }
          
          // Player is NOT playing and duration is invalid - this is a real problem
          // For looping tracks (background, binaural), be more lenient - they may take longer to load
          // Remote/streaming sources can report NaN duration for a while
          const isLooping = isLoopingTrack || (player as any).loop === true;
          const loadTimeout = isLooping ? 10000 : 2000; // 10 seconds for looping, 2 seconds for non-looping
          
          // If we've already tried to restart multiple times, give up
          if (failedRestarts >= AudioEngine.MAX_FAILED_RESTARTS) {
            // Only log once to avoid spam (log exactly when we hit the limit, not after)
            if (failedRestarts === AudioEngine.MAX_FAILED_RESTARTS) {
              console.warn(`[AudioEngine] ⚠️  ${name} failed to load after ${failedRestarts} attempts (duration: ${playerDuration}). Giving up.`);
              // Increment past the limit so we don't log again
              setFailedRestarts(failedRestarts + 1);
            }
            return;
          }
          // If duration is still invalid after a delay, mark as failed
          if (stoppedAt === 0) {
            setStoppedAt(now);
          } else {
            const waitDuration = now - stoppedAt;
            // Give it more time for looping tracks (remote sources can be slow)
            if (waitDuration >= loadTimeout) {
              const newFailedCount = failedRestarts + 1;
              setFailedRestarts(newFailedCount);
              console.warn(`[AudioEngine] ⚠️  ${name} still not loaded after ${waitDuration}ms (duration: ${playerDuration}). Failed attempt ${newFailedCount}/${AudioEngine.MAX_FAILED_RESTARTS}`);
              setStoppedAt(0); // Reset timer
            }
          }
          return;
        }
        
        // Check buffering state (expo-audio exposes this via status)
        // If buffering, do nothing - this is normal and will resolve
        const status = (player as any).status;
        const isBuffering = status?.isBuffering === true;
        if (isBuffering) {
          // Buffering is normal - reset timer and update position
          if (stoppedAt !== 0) setStoppedAt(0);
          setLastPosition(player.currentTime);
          return;
        }
        
        const currentPos = player.currentTime;
        const duration = player.duration;
        const isAtEOF = duration > 0 && currentPos >= duration - 0.1; // Within 100ms of end
        
        // Check if position is advancing (player is actually playing)
        const isAdvancing = Math.abs(currentPos - lastPosition) > 0.01; // 10ms tolerance
        
        if (player.playing && isAdvancing) {
          // Playing and advancing - reset stopped timer and failed count
          if (stoppedAt !== 0) setStoppedAt(0);
          if (failedRestarts > 0) setFailedRestarts(0); // Reset failed count if playing successfully
          setLastPosition(currentPos);
          return;
        }
        
        // If player should be playing but isn't, and we're in playing state, try to start it
        // This handles cases where the player was created but never started
        if (!player.playing && this.snapshot.status === "playing" && failedRestarts === 0 && stoppedAt === 0) {
          // Player exists but isn't playing - try to start it (only once, don't spam)
          console.log(`[AudioEngine] ${name} exists but not playing - attempting to start`);
          Promise.resolve(player.play()).then(() => {
            // Success - reset any timers
            setStoppedAt(0);
            setLastPosition(player.currentTime);
          }).catch((err: unknown) => {
            console.warn(`[AudioEngine] Failed to start ${name}:`, err);
            // Start the stopped timer so watchdog can handle it
            setStoppedAt(now);
          });
          return; // Don't check further this tick
        }
        
        // Not playing or not advancing - start or check debounce timer
        if (stoppedAt === 0) {
          // First time seeing it stopped - start timer
          setStoppedAt(now);
          setLastPosition(currentPos);
          return;
        }
        
        // Check if it's been stopped long enough AND position hasn't advanced (truly stuck)
        const stoppedDuration = now - stoppedAt;
        if (stoppedDuration >= AudioEngine.WATCHDOG_DEBOUNCE_MS && !isAdvancing) {
          // Check if we've exceeded max failed restart attempts
          if (failedRestarts >= AudioEngine.MAX_FAILED_RESTARTS) {
            // Only log once to avoid spam
            if (failedRestarts === AudioEngine.MAX_FAILED_RESTARTS) {
              console.warn(`[AudioEngine] ⚠️  ${name} exceeded max restart attempts (${failedRestarts}). Giving up.`);
            }
            return;
          }
          
          console.warn(`[AudioEngine] ⚠️  ${name} persistently stopped for ${stoppedDuration}ms (pos: ${currentPos.toFixed(2)}s/${duration.toFixed(2)}s, EOF: ${isAtEOF}) - restarting`);
          setStoppedAt(0); // Reset so we don't spam
          setLastPosition(currentPos);
          
          // Track restart attempt
          const restartAttempt = failedRestarts + 1;
          
          // If at EOF, seekTo(0) first (expo-audio doesn't auto-rewind)
          if (isAtEOF) {
            player.seekTo(0).then(() => {
              // Wrap play() in Promise to handle potential errors
              Promise.resolve(player.play()).then(() => {
                // Success - reset failed count
                if (failedRestarts > 0) {
                  setFailedRestarts(0);
                }
              }).catch((err: unknown) => {
                console.error(`[AudioEngine] Error restarting ${name} after EOF seek:`, err);
                setFailedRestarts(restartAttempt);
              });
            }).catch((err: unknown) => {
              console.error(`[AudioEngine] Error seeking ${name} to 0:`, err);
              // Try play anyway
              Promise.resolve(player.play()).then(() => {
                if (failedRestarts > 0) {
                  setFailedRestarts(0);
                }
              }).catch((err2: unknown) => {
                console.error(`[AudioEngine] Error restarting ${name}:`, err2);
                setFailedRestarts(restartAttempt);
              });
            });
          } else {
            // Not at EOF - just play
            Promise.resolve(player.play()).then(() => {
              // Success - reset failed count
              if (failedRestarts > 0) {
                setFailedRestarts(0);
              }
            }).catch((err: unknown) => {
              console.error(`[AudioEngine] Error restarting ${name}:`, err);
              setFailedRestarts(restartAttempt);
            });
          }
        } else {
          // Update position even if not restarting (for next check)
          setLastPosition(currentPos);
        }
      };
      
      // Check all three players with debouncing (buffer-aware, EOF-aware)
      // Background and binaural are looping tracks - be more lenient with NaN duration
      checkAndRestartPlayer(
        this.affPlayer, "Affirmations", this.affStoppedAt, this.affLastPosition, this.affFailedRestarts,
        (t) => { this.affStoppedAt = t; },
        (p) => { this.affLastPosition = p; },
        (n) => { this.affFailedRestarts = n; },
        false // Affirmations are not looping
      );
      checkAndRestartPlayer(
        this.binPlayer, "Binaural", this.binStoppedAt, this.binLastPosition, this.binFailedRestarts,
        (t) => { this.binStoppedAt = t; },
        (p) => { this.binLastPosition = p; },
        (n) => { this.binFailedRestarts = n; },
        true // Binaural is looping
      );
      checkAndRestartPlayer(
        this.bgPlayer, "Background", this.bgStoppedAt, this.bgLastPosition, this.bgFailedRestarts,
        (t) => { this.bgStoppedAt = t; },
        (p) => { this.bgLastPosition = p; },
        (n) => { this.bgFailedRestarts = n; },
        true // Background is looping
      );
    } else {
      // Not playing - reset all stopped timers and failed restart counts
      this.affStoppedAt = 0;
      this.binStoppedAt = 0;
      this.bgStoppedAt = 0;
      this.affFailedRestarts = 0;
      this.binFailedRestarts = 0;
      this.bgFailedRestarts = 0;
    }

    // DISABLED: Drift correction removed (causes audible gaps)
    // Beds don't need to be time-locked to affirmations - expo-audio handles looping natively
    // See: packages/audio-engine/src/DriftCorrector.ts for rationale
  }

  load(bundle: PlaybackBundleVM): Promise<void> {
    console.log("[AudioEngine] load() method called");
    return this.enqueue(async () => {
      // Ensure audio session is configured before loading
      await this.audioSession.ensureConfigured();
      
      console.log("[AudioEngine] load() enqueued, executing...");
      console.log("[AudioEngine] load() called, current status:", this.snapshot.status);
      
      // If switching to a different session, stop current playback first
      const isDifferentSession = this.snapshot.sessionId && this.snapshot.sessionId !== bundle.sessionId;
      if (isDifferentSession && (this.snapshot.status === "playing" || this.snapshot.status === "paused" || this.snapshot.status === "preroll")) {
        console.log("[AudioEngine] Switching sessions - stopping current playback");
        // Stop pre-roll if active
        if (this.prerollManager.isActive()) {
          await this.prerollManager.stop(200);
        }
        // Stop main players
        this.affPlayer?.pause();
        this.binPlayer?.pause();
        this.bgPlayer?.pause();
        this.stopPolling();
        this.setState({ status: "idle", positionMs: 0 });
      }
      
      this.currentBundle = bundle;
      console.log("[AudioEngine] Bundle stored in currentBundle");
      
      // P1.1: Reset loop counter when loading new bundle
      this.resetSessionTracking();
      
      // Initialize voice activity ducker if available
      let ducker: VoiceActivityDucker | null = null;
      if (bundle.voiceActivity && bundle.voiceActivity.segments) {
        ducker = new VoiceActivityDucker(bundle.voiceActivity.segments);
        console.log(`[AudioEngine] Voice activity ducker initialized with ${bundle.voiceActivity.segments.length} segments`);
      }
      this.mixerController.setDucker(ducker);
      
      // Reset automation state for new session
      this.mixerController.resetAutomation();
      
      // If we're in preroll state, keep it (don't change to loading yet)
      // Loading will happen in parallel with pre-roll
      if (this.snapshot.status !== "preroll") {
        console.log("[AudioEngine] Setting status to loading");
        this.setState({ status: "loading", sessionId: bundle.sessionId });
      }
      this.stopPolling();

      // Teardown existing main players (but keep pre-roll if active)
      this.affPlayer?.release();
      this.binPlayer?.release();
      this.bgPlayer?.release();
      // Note: We don't release pre-roll here - it continues during load
      
      // Reset failed restart counts when loading new bundle
      this.affFailedRestarts = 0;
      this.binFailedRestarts = 0;
      this.bgFailedRestarts = 0;

      // V3 Compliance: Platform-aware URL selection
      const getUrl = (asset: { urlByPlatform: { ios: string, android: string } }) => {
        return Platform.OS === "ios" ? asset.urlByPlatform.ios : asset.urlByPlatform.android;
      };

      // Determine brain layer asset (binaural or solfeggio)
      const bundleWithSolfeggio = bundle as PlaybackBundleVM & { solfeggio?: { urlByPlatform: { ios: string; android: string }; loop: true; hz: number } };
      const brainLayerAsset = bundleWithSolfeggio.solfeggio || bundle.binaural;
      if (!brainLayerAsset) {
        throw new Error("PlaybackBundleVM must have either binaural or solfeggio");
      }
      const brainLayerType = bundleWithSolfeggio.solfeggio ? "solfeggio" : "binaural";

      try {
        console.log("[AudioEngine] Loading Bundle:", bundle.sessionId, `(brain layer: ${brainLayerType})`);
        const urls = {
          affirmations: bundle.affirmationsMergedUrl,
          brainLayer: getUrl(brainLayerAsset),
          background: getUrl(bundle.background)
        };
        console.log("[AudioEngine] URLs:", urls);

        // Removed HEAD requests - let createAudioPlayer() + waitForPlayerReady() be the source of truth
        // This removes 3 extra network calls and latency on device networks

        // 1. Create Players
        // Affirmations (Track A) - V3: Should loop infinitely per Loop-and-delivery.md
        console.log("[AudioEngine] Creating affPlayer...");
        try {
          this.affPlayer = createAudioPlayer({ uri: bundle.affirmationsMergedUrl });
          this.affPlayer.loop = true; // V3: All tracks loop infinitely
          console.log("[AudioEngine] Created affPlayer successfully, loop:", this.affPlayer.loop);
        } catch (err) {
          console.error("[AudioEngine] Failed to create affPlayer:", err);
          throw new Error(`Failed to create affirmations player: ${err}`);
        }

        // Brain Layer (Track B) - Binaural or Solfeggio
        // CRITICAL: Force loop=true - don't trust bundle flags for bed tracks
        // If loop is false/undefined, player hits EOF and pauses, causing gaps
        // Also cache remote URIs locally to avoid network buffering stalls
        console.log(`[AudioEngine] Creating binPlayer (${brainLayerType})...`);
        try {
          const brainLayerUri = await toCachedUri(getUrl(brainLayerAsset));
          this.binPlayer = createAudioPlayer({ uri: brainLayerUri });
          this.binPlayer.loop = true; // Force loop - bed tracks must loop continuously
          console.log(`[AudioEngine] Created binPlayer (${brainLayerType}) successfully, loop:`, this.binPlayer.loop, "cached:", brainLayerUri.startsWith("file://"));
        } catch (err) {
          console.error(`[AudioEngine] Failed to create binPlayer (${brainLayerType}):`, err);
          throw new Error(`Failed to create ${brainLayerType} player: ${err}`);
        }

        // Background (Track C)
        // CRITICAL: Force loop=true - don't trust bundle flags for bed tracks
        // Also cache remote URIs locally to avoid network buffering stalls
        console.log("[AudioEngine] Creating bgPlayer...");
        try {
          const bgUrl = getUrl(bundle.background);
          console.log("[AudioEngine] Background URL from bundle:", bgUrl);
          
          if (!bgUrl || bgUrl === "unknown") {
            throw new Error(`Invalid background URL: ${bgUrl}`);
          }
          
          const bgUri = await toCachedUri(bgUrl);
          console.log("[AudioEngine] Background URI (after caching):", bgUri);
          
          this.bgPlayer = createAudioPlayer({ uri: bgUri });
          this.bgPlayer.loop = true; // Force loop - bed tracks must loop continuously
          
          console.log("[AudioEngine] Created bgPlayer successfully:", {
            loop: this.bgPlayer.loop,
            cached: bgUri.startsWith("file://"),
            originalUrl: bgUrl,
            finalUri: bgUri
          });
        } catch (err) {
          console.error("[AudioEngine] ❌ CRITICAL: Failed to create bgPlayer:", err);
          console.error("[AudioEngine] Background bundle data:", bundle.background);
          throw new Error(`Failed to create background player: ${err}`);
        }

        // 2. Apply Mix
        // Preserve current mix ONLY if user has explicitly adjusted it
        // This prevents volume controls from resetting when reloading the same session
        const mixToUse = this.hasUserSetMix ? this.snapshot.mix : bundle.mix;
        
        this.affPlayer.volume = mixToUse.affirmations;
        this.binPlayer.volume = mixToUse.binaural;
        this.bgPlayer.volume = mixToUse.background;
        
        // Update snapshot with the mix we're using
        this.setState({ mix: mixToUse });
        
        console.log("[AudioEngine] Set volumes (preserved user adjustments):", {
          aff: this.affPlayer.volume,
          bin: this.binPlayer.volume,
          bg: this.bgPlayer.volume
        });
        
        // REMOVED: Redundant playbackStatusUpdate listeners for binaural/background
        // Recovery is now handled by the UNIFIED PLAYBACK WATCHDOG in controlTick()
        // This prevents multiple mechanisms fighting each other and causing micro-disruptions.
        // 
        // expo-audio with loop=true handles looping automatically.
        // The watchdog only intervenes if a player is *persistently* stopped (400ms+).

        // 3. Note: expo-audio loads files when play() is called, not when players are created
        // We can't wait for duration here since it won't be available until after play()
        console.log("[AudioEngine] Players created, will verify loading when play() is called");

        // Listen for playback status updates - ONLY for duration extraction and error logging
        // Recovery is handled by the UNIFIED PLAYBACK WATCHDOG in controlTick()
        this.affPlayer.addListener("playbackStatusUpdate", (status) => {
          // Log errors
          if ((status as any).error) {
            console.error("[AudioEngine] ❌ Affirmations player error:", (status as any).error);
          }
          
          if (status.isLoaded) {
            // Extract duration from player when loaded (only once)
            // expo-audio status has duration in seconds, convert to ms
            if (status.duration !== undefined && status.duration > 0 && this.snapshot.durationMs === 0) {
              this.setState({ durationMs: status.duration * 1000 });
            }
            
            // Log if didJustFinish fires (shouldn't with loop=true, but useful for debugging)
            if (status.didJustFinish && status.duration && status.duration > 0) {
              console.warn("[AudioEngine] ⚠️  Affirmations didJustFinish fired (loop=true should prevent this)");
              // Don't take action here - watchdog will restart if persistently stopped
            }
          }
        });

        // Set initial state (duration will be updated by listener when player loads)
        // If we were in preroll, we'll transition to playing via crossfade
        // Otherwise, go to ready state
        // Note: expo-audio players load asynchronously, so we mark as ready immediately
        // The actual loading happens in the background
        const targetStatus = this.snapshot.status === "preroll" ? "preroll" : "ready";
        console.log("[AudioEngine] Setting status to:", targetStatus);
        this.setState({
          status: targetStatus,
          mix: mixToUse, // Use preserved mix, not bundle.mix
          durationMs: 0 // Will be updated by playbackStatusUpdate listener
        });
        
        // If pre-roll is active and main tracks are now ready, crossfade
        if (targetStatus === "preroll" && this.prerollManager.isActive()) {
          // Trigger crossfade (will be handled by next play() call or can auto-trigger)
          // For now, wait for explicit play() call to crossfade
          console.log("[AudioEngine] Pre-roll active, main tracks loaded - ready for crossfade");
        }

        console.log("[AudioEngine] Bundle load complete, status:", targetStatus);

      } catch (e) {
        console.error("[AudioEngine] Failed to load audio bundle:", e);
        this.setState({ status: "error" });
        throw e;
      }
    });
  }

  /**
   * Set the pre-roll atmosphere asset URI.
   * This must be called from the mobile app context with the resolved asset URI.
   * The mobile app should use prerollAsset.ts to get the asset module and resolve it.
   */
  setPrerollAssetUri(uri: string): void {
    this.prerollManager.setPrerollAssetUri(uri);
  }

  play(): Promise<void> {
    return this.enqueue(async () => {
      // Ensure audio session is configured before playing
      await this.audioSession.ensureConfigured();
      
      // If idle, start pre-roll immediately (within 100-300ms)
      if (this.snapshot.status === "idle") {
        this.setState({ status: "preroll" });
        await this.prerollManager.start();
        
        // If bundle exists, load it in parallel (pre-roll continues)
        if (this.currentBundle) {
          // Load will happen, but we don't await it here - pre-roll continues
          this.load(this.currentBundle).catch(err => {
            console.error("[AudioEngine] Failed to load bundle:", err);
          });
        }
        this.startControlLoop();
        return; // Pre-roll is now playing, will crossfade when ready
      }

      // If in preroll state and main tracks are ready, crossfade to them
      if (this.snapshot.status === "preroll") {
        if (this.affPlayer && this.binPlayer && this.bgPlayer) {
          await this.crossfadeToMainMix();
          return;
        }
        // Main tracks not ready yet, pre-roll continues
        // Start control loop for preroll
        this.startControlLoop();
        return;
      }
      
      // If in loading state, start pre-roll if not already started
      if (this.snapshot.status === "loading") {
        if (!this.prerollManager.isActive()) {
          await this.prerollManager.start();
          this.setState({ status: "preroll" });
          this.startControlLoop(); // Start control loop for preroll
        }
        return; // Wait for load to complete
      }

      // Standard play from ready or paused
      // If already playing, just return (idempotent - safe to call multiple times)
      if (this.snapshot.status === "playing") {
        // Already playing, no-op (this is fine, just means user tapped Play again)
        return;
      }
      
      // If idle and no bundle, can't play (should have been handled above, but double-check)
      // Note: This check is defensive - status shouldn't be "idle" here after the checks above
      if (!this.currentBundle) {
        console.warn("[AudioEngine] Cannot play without a bundle loaded");
        return;
      }
      
      if (this.snapshot.status !== "ready" && this.snapshot.status !== "paused") {
        console.warn("[AudioEngine] Cannot play from status:", this.snapshot.status);
        return;
      }

      // If resuming from pause and pre-roll was active, restart it if needed
      if (this.snapshot.status === "paused" && !this.affPlayer) {
        // Main tracks not ready, restart pre-roll
        this.setState({ status: "preroll" });
        await this.prerollManager.start();
        this.startControlLoop();
        return;
      }

      // Start main mix (may be muted initially if crossfading)
      if (!this.affPlayer || !this.binPlayer || !this.bgPlayer) {
        console.warn("[AudioEngine] Cannot play - players not loaded:", {
          aff: !!this.affPlayer,
          bin: !!this.binPlayer,
          bg: !!this.bgPlayer
        });
        return;
      }

      // If resuming from pause, just resume at current volumes (no rolling start)
      if (this.snapshot.status === "paused") {
        console.log("[AudioEngine] Resuming from pause at current volumes:", {
          aff: this.affPlayer.volume,
          bin: this.binPlayer.volume,
          bg: this.bgPlayer.volume
        });
        
        // Simply resume all players at their current volumes
        await Promise.all([
          this.affPlayer.play(),
          this.binPlayer.play(),
          this.bgPlayer.play()
        ]);
        
        this.mixerController.startIntroAutomation(); // Restart intro automation
        this.startControlLoop();
        // P1.1: Resume session time tracking
        if (!this.sessionStartTime) {
          this.sessionStartTime = Date.now();
        }
        
        this.startPolling();
        this.setState({ status: "playing" });
        console.log("[AudioEngine] Resumed playback");
        return;
      }

      // Rolling start only for initial play (from ready state)
      console.log("[AudioEngine] Playing main mix with rolling start:", {
        volumes: {
          aff: this.snapshot.mix.affirmations,
          bin: this.snapshot.mix.binaural,
          bg: this.snapshot.mix.background
        }
      });

      // Initialize all players at volume 0 for rolling start
      // Use smoothers for smooth intro automation
      this.mixerController.resetSmoothers(0);
      
      if (this.affPlayer) this.affPlayer.volume = 0;
      if (this.binPlayer) this.binPlayer.volume = 0;
      if (this.bgPlayer) this.bgPlayer.volume = 0;
      
      try {
        // Rolling start sequence:
        // 1. Background starts first, fades in over 3 seconds
        // 2. Binaural starts after background begins, fades in over 1 second
        // 3. Affirmations start after binaural begins (no fade, immediate)
        
        // Get URLs from currentBundle for logging
        const getUrl = this.currentBundle ? ((asset: { urlByPlatform: { ios: string, android: string } }) => {
          return Platform.OS === "ios" ? asset.urlByPlatform.ios : asset.urlByPlatform.android;
        }) : null;
        
        console.log("[AudioEngine] Step 1: Starting background player...");
        const bgUrl = this.currentBundle && getUrl ? getUrl(this.currentBundle.background) : "unknown";
        console.log("[AudioEngine] Background URL:", bgUrl);
        console.log("[AudioEngine] Background player exists:", !!this.bgPlayer);
        console.log("[AudioEngine] Background player loop:", this.bgPlayer?.loop);
        console.log("[AudioEngine] Background player volume:", this.bgPlayer?.volume);
        
        if (!this.bgPlayer) {
          console.error("[AudioEngine] ❌ Background player is null! Cannot start.");
          throw new Error("Background player is null");
        }
        
        try {
          // Call play() to trigger loading
          console.log("[AudioEngine] Calling play() on background player...");
          await this.bgPlayer.play();
          console.log("[AudioEngine] Background play() called, waiting for ready...");
          
          // Wait for ready with longer timeout for remote files
          // CRITICAL: Must wait for valid duration, not just playing=true
          try {
            await waitForPlayerReady(this.bgPlayer, "Background", 15000); // 15 seconds for remote files
          } catch (waitError) {
            console.error("[AudioEngine] ❌ Background waitForPlayerReady failed:", waitError);
            // Check if we at least have a valid duration now
            if (isNaN(this.bgPlayer.duration) || this.bgPlayer.duration <= 0) {
              throw new Error(`Background player failed to load - no valid duration after timeout. URL: ${bgUrl}`);
            }
          }
          
          // CRITICAL CHECK: Must have valid duration to proceed
          // expo-audio can report playing=true even when file hasn't loaded
          const hasValidDuration = !isNaN(this.bgPlayer.duration) && this.bgPlayer.duration > 0;
          if (!hasValidDuration) {
            console.error("[AudioEngine] ❌ Background player has no valid duration!");
            console.error("[AudioEngine] Background player state:", {
              playing: this.bgPlayer.playing,
              volume: this.bgPlayer.volume,
              duration: this.bgPlayer.duration,
              loop: this.bgPlayer.loop,
              currentTime: this.bgPlayer.currentTime,
              url: bgUrl
            });
            throw new Error(`Background player has no valid duration. URL: ${bgUrl}`);
          }
          
          // Multiple retry attempts if not playing (but we have duration)
          let retryCount = 0;
          const maxRetries = 5;
          while (!this.bgPlayer.playing && retryCount < maxRetries) {
            console.log(`[AudioEngine] Background not playing (but has duration), retry ${retryCount + 1}/${maxRetries}...`);
            await this.bgPlayer.play();
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between retries
            retryCount++;
          }
          
          // Final check - must have both valid duration AND be playing
          if (this.bgPlayer.playing && hasValidDuration) {
            console.log("[AudioEngine] ✅ Background started successfully, intro automation will fade in over 4s");
            console.log("[AudioEngine] Background player state:", {
              playing: this.bgPlayer.playing,
              volume: this.bgPlayer.volume,
              duration: this.bgPlayer.duration,
              loop: this.bgPlayer.loop,
              currentTime: this.bgPlayer.currentTime
            });
          } else {
            console.error(`[AudioEngine] ❌ Background player FAILED to start after ${maxRetries} attempts!`);
            console.error("[AudioEngine] Background player state:", {
              playing: this.bgPlayer.playing,
              volume: this.bgPlayer.volume,
              duration: this.bgPlayer.duration,
              loop: this.bgPlayer.loop,
              currentTime: this.bgPlayer.currentTime,
              url: bgUrl,
              hasValidDuration
            });
            console.error("[AudioEngine] Check if audio file exists and is accessible:", bgUrl);
            // Don't continue - this is a critical failure
            throw new Error(`Background player failed to start. URL: ${bgUrl}, duration: ${this.bgPlayer.duration}, playing: ${this.bgPlayer.playing}`);
          }
        } catch (error) {
          console.error("[AudioEngine] ❌ CRITICAL ERROR starting background player:", error);
          console.error("[AudioEngine] Audio file URL:", bgUrl);
          console.error("[AudioEngine] Background player state:", {
            exists: !!this.bgPlayer,
            playing: this.bgPlayer?.playing,
            volume: this.bgPlayer?.volume,
            duration: this.bgPlayer?.duration,
            loop: this.bgPlayer?.loop
          });
          // Re-throw to prevent silent failure
          throw error;
        }
        
        // Brief pause before starting brain layer (staggered start)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Determine brain layer asset for logging
        const currentBundle = this.currentBundle as any;
        const brainLayerAsset = currentBundle?.solfeggio || currentBundle?.binaural;
        const brainLayerType = currentBundle?.solfeggio ? "solfeggio" : "binaural";
        
        console.log(`[AudioEngine] Step 2: Starting ${brainLayerType} player...`);
        const binUrl = this.currentBundle && brainLayerAsset && getUrl ? getUrl(brainLayerAsset) : "unknown";
        console.log(`[AudioEngine] ${brainLayerType.charAt(0).toUpperCase() + brainLayerType.slice(1)} URL:`, binUrl);
        
        try {
          // Call play() to trigger loading
          console.log("[AudioEngine] Calling play() on binaural player...");
          await this.binPlayer!.play();
          console.log("[AudioEngine] Binaural play() called, waiting for ready...");
          
          // Wait for ready with shorter timeout
          try {
            await waitForPlayerReady(this.binPlayer!, brainLayerType.charAt(0).toUpperCase() + brainLayerType.slice(1), 5000); // Reduced to 5s
          } catch (waitError) {
            console.warn(`[AudioEngine] ⚠️  ${brainLayerType.charAt(0).toUpperCase() + brainLayerType.slice(1)} waitForPlayerReady timed out, but continuing anyway`);
            // Don't wait - just continue
          }
          
          // Quick retry if not playing
          if (!this.binPlayer!.playing) {
            await this.binPlayer!.play();
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait
          }
          
          if (this.binPlayer!.playing) {
            console.log(`[AudioEngine] ✅ ${brainLayerType.charAt(0).toUpperCase() + brainLayerType.slice(1)} started, intro automation will fade in over 4s (after 2s delay)`);
          } else {
            console.error(`[AudioEngine] ❌ ${brainLayerType.charAt(0).toUpperCase() + brainLayerType.slice(1)} player failed to start after multiple attempts!`);
            console.error("[AudioEngine] Check if audio file exists and is accessible:", binUrl);
            // Continue anyway - control loop will handle it
            console.warn(`[AudioEngine] Continuing playback - ${brainLayerType} may start later`);
          }
        } catch (error) {
          console.error(`[AudioEngine] ❌ Error starting ${brainLayerType} player:`, error);
          console.error("[AudioEngine] Audio file URL:", binUrl);
          // Continue anyway - don't block other players
        }
        
        // Brief pause before starting affirmations (staggered start)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log("[AudioEngine] Step 3: Starting affirmations player...");
        const affUrl = this.currentBundle?.affirmationsMergedUrl || "unknown";
        
        try {
          // Call play() to trigger loading, then wait for it to be ready
          await this.affPlayer!.play();
          
          // Wait for ready with shorter timeout
          try {
            await waitForPlayerReady(this.affPlayer!, "Affirmations", 5000); // Reduced to 5s
          } catch (waitError) {
            console.warn("[AudioEngine] ⚠️  Affirmations waitForPlayerReady timed out, but continuing anyway");
            // Don't wait - just continue
          }
          
          // Quick retry if not playing
          if (!this.affPlayer!.playing) {
            await this.affPlayer!.play();
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait
          }
          
          if (this.affPlayer!.playing) {
            console.log("[AudioEngine] ✅ Affirmations started");
          } else {
            console.error("[AudioEngine] ❌ Affirmations player failed to start after loading!");
            console.error("[AudioEngine] Check if file exists and is accessible:", affUrl);
          }
        } catch (error) {
          console.error("[AudioEngine] ❌ Error starting affirmations player:", error);
          console.error("[AudioEngine] Audio file URL:", affUrl);
        }
        
        console.log("[AudioEngine] ✅ All players started with rolling start sequence");
        
        // Verify all players are actually playing after a brief delay
        setTimeout(() => {
          console.log("[AudioEngine] Player status check (after 500ms):", {
            aff: { 
              playing: this.affPlayer?.playing, 
              volume: this.affPlayer?.volume,
              duration: this.affPlayer?.duration 
            },
            bin: { 
              playing: this.binPlayer?.playing, 
              volume: this.binPlayer?.volume,
              duration: this.binPlayer?.duration,
              loop: this.binPlayer?.loop
            },
            bg: { 
              playing: this.bgPlayer?.playing, 
              volume: this.bgPlayer?.volume,
              duration: this.bgPlayer?.duration,
              loop: this.bgPlayer?.loop
            }
          });
          
          // Log warnings if players aren't playing
          if (this.affPlayer && !this.affPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Affirmations player not playing after play() call!");
          }
          if (this.binPlayer && !this.binPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Binaural player not playing! Check volume and audio file.");
          }
          if (this.bgPlayer && !this.bgPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Background player not playing! Check volume and audio file.");
          }
        }, 500);
        
        // Start control loop and position polling
        this.mixerController.startIntroAutomation(); // Start intro automation
        this.startControlLoop();
        // P1.1: Start session time tracking when playback starts
        if (!this.sessionStartTime) {
          this.sessionStartTime = Date.now();
          this.totalPlaybackTimeMs = 0;
        }
        
        this.startPolling();
        this.setState({ status: "playing" });
        console.log("[AudioEngine] All players started, status set to playing");
      } catch (error) {
        console.error("[AudioEngine] ❌ CRITICAL ERROR starting players:", error);
        console.error("[AudioEngine] Error type:", typeof error);
        console.error("[AudioEngine] Error message:", error instanceof Error ? error.message : String(error));
        console.error("[AudioEngine] Error stack:", error instanceof Error ? error.stack : "No stack");
        // Set error state but don't throw - let playback continue with available players
        this.setState({ status: "error", error: { message: error instanceof Error ? error.message : String(error) } });
        // Still start polling and set playing so UI doesn't hang
        this.startPolling();
        this.setState({ status: "playing" });
      }
    });
  }

  /**
   * Crossfade from pre-roll to main mix using equal-power curve and control loop.
   * Pre-roll fades out over 1.75 seconds while main mix fades in.
   */
  private async crossfadeToMainMix(): Promise<void> {
    if (!this.prerollManager.isActive() || !this.affPlayer || !this.binPlayer || !this.bgPlayer) {
      return;
    }

    const crossfadeDuration = 1750; // 1.75 seconds

    // Initialize main tracks at volume 0 (control loop will fade them in)
    this.mixerController.resetSmoothers(0);
    
    // Initialize preroll smoother at current volume
    const prerollPlayer = this.prerollManager.getPlayer();
    if (prerollPlayer) {
      const prerollSmoother = this.mixerController.getSmoothers().preroll;
      if (prerollSmoother) {
        prerollSmoother.reset(prerollPlayer.volume);
      }
    }

    // Play main tracks simultaneously (muted initially, control loop will fade in)
    // Call play() to trigger loading
    await Promise.all([
      this.affPlayer.play(),
      this.binPlayer.play(),
      this.bgPlayer.play()
    ]);

    // Wait for all players to be ready before starting crossfade
    console.log("[AudioEngine] Waiting for main tracks to load before crossfade...");
    try {
      await waitForPlayersReady(this.affPlayer, this.binPlayer, this.bgPlayer);
      console.log("[AudioEngine] ✅ All main tracks loaded, starting crossfade");
    } catch (error) {
      console.error("[AudioEngine] ❌ Error waiting for main tracks to load:", error);
      // Continue anyway - players may still work
    }

    // Start crossfade (control loop will handle the equal-power curve)
    this.mixerController.startCrossfade(crossfadeDuration);

    // Start control loop to drive crossfade
    this.startControlLoop();
    this.startPolling();
    
    // After crossfade completes, control loop will clean up preroll
    // Status will be set to "playing" by control loop when crossfade finishes
  }

  pause(): Promise<void> {
    return this.enqueue(async () => {
      if (this.snapshot.status !== "playing" && this.snapshot.status !== "preroll") {
        return;
      }
      
      // P1.1: Update total playback time when pausing
      if (this.sessionStartTime && this.snapshot.status === "playing") {
        const now = Date.now();
        const sessionElapsed = now - this.sessionStartTime;
        this.totalPlaybackTimeMs += sessionElapsed;
        this.sessionStartTime = null; // Reset start time until resumed
        this.lastPlaybackCheck = now;
        this.setState({ totalPlaybackTimeMs: this.totalPlaybackTimeMs });
      }

      // Pause main tracks if playing
      this.affPlayer?.pause();
      this.binPlayer?.pause();
      this.bgPlayer?.pause();

      // If in preroll, fade it out quickly (300-500ms)
      if (this.snapshot.status === "preroll" && this.prerollManager.isActive()) {
        await this.prerollManager.stop(400);
      }

      this.stopControlLoop();
      this.stopPolling();
      this.setState({ status: "paused" });
    });
  }

  stop(): Promise<void> {
    return this.enqueue(async () => {
      this.setState({ status: "stopping" });

      // Stop pre-roll immediately with fast fade (200-300ms)
      if (this.prerollManager.isActive()) {
        await this.prerollManager.stop(250);
      }

      this.affPlayer?.pause();
      this.affPlayer?.seekTo(0);

      this.binPlayer?.pause();
      this.binPlayer?.seekTo(0);

      this.bgPlayer?.pause();
      this.bgPlayer?.seekTo(0);

      this.stopControlLoop();
      // P1.1: Update total playback time before stopping
      if (this.sessionStartTime) {
        const now = Date.now();
        const sessionElapsed = now - this.sessionStartTime;
        this.totalPlaybackTimeMs += sessionElapsed;
        this.setState({ totalPlaybackTimeMs: this.totalPlaybackTimeMs });
      }
      
      this.stopPolling();
      // Reset automation
      this.mixerController.resetAutomation();
      // P1.1: Reset session tracking when stopping
      this.resetSessionTracking();
      this.setState({ status: "idle", positionMs: 0 }); // Back to idle
      // Keep currentBundle so user can play again without reloading
      // this.currentBundle = null;
    });
  }

  seek(ms: number): Promise<void> {
    return this.enqueue(async () => {
      const sec = ms / 1000;
      // Only seek affirmations player - bed tracks loop automatically and don't need seeking
      // Seeking bed tracks causes audible gaps, and they're not time-locked to affirmations anyway
      this.affPlayer?.seekTo(sec);
      
      // DO NOT seek binaural/background players - they loop automatically with loop=true
      // Seeking them causes audible gaps. expo-audio handles looping natively without seeking.

      this.setState({ positionMs: ms });
    });
  }

  setMix(mix: Mix, opts?: { rampMs?: number; source?: "user" | "system" }): void {
    // Mark that user has explicitly set the mix (prevents reset on reload)
    if (opts?.source === "user" || opts === undefined) {
      this.hasUserSetMix = true;
    }
    
    // Update snapshot mix (control loop will apply with smoothing)
    this.setState({ mix });
    
    // If control loop is running, it will smoothly transition
    // If not, set volumes directly (for immediate feedback when not playing)
    if (this.snapshot.status !== "playing" && this.snapshot.status !== "preroll") {
      if (this.affPlayer) this.affPlayer.volume = mix.affirmations;
      if (this.binPlayer) this.binPlayer.volume = mix.binaural;
      if (this.bgPlayer) this.bgPlayer.volume = mix.background;
    }
    // Otherwise, control loop will handle smooth transition
  }

  /**
   * Set voice prominence (convenience method)
   * Maps a single slider (0..1) to a mix where voice is always at 1.0
   * and beds scale inversely
   */
  setVoiceProminence(x: number): void {
    const clamped = Math.max(0, Math.min(1, x));
    const mix: Mix = {
      affirmations: 1.0,
      background: 0.18 + (0.38 - 0.18) * (1 - clamped), // Lerp from 0.38 to 0.18
      binaural: 0.14 + (0.32 - 0.14) * (1 - clamped),   // Lerp from 0.32 to 0.14
    };
    this.setMix(mix, { source: "user" });
  }

  /**
   * P1.1: Set session duration cap from entitlements (called when loading bundle)
   */
  setSessionDurationCap(capMs: number | "unlimited"): void {
    this.sessionDurationCapMs = capMs;
    this.setState({ sessionDurationCapMs: capMs });
  }

  /**
   * P1.1: Start smooth fade-out of voice track when loop cap is reached
   * Fades voice out over 3 seconds, keeps background playing
   */
  private startFadeOut(): void {
    if (this.isFadingOut) return;
    this.isFadingOut = true;

    const fadeDurationMs = 3000; // 3 second fade
    const steps = 30; // 30 steps for smooth fade
    const stepDurationMs = fadeDurationMs / steps;
    const volumeStep = (this.snapshot.mix.affirmations || 1.0) / steps;

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
      if (currentStep >= steps || !this.affPlayer) {
        clearInterval(fadeInterval);
        // Fade complete - stop affirmations player but keep background/binaural
        this.affPlayer?.pause();
        this.isFadingOut = false;
        console.log("[AudioEngine] Fade-out complete, voice stopped");
        return;
      }

      const newVolume = Math.max(0, (this.snapshot.mix.affirmations || 1.0) - (volumeStep * (currentStep + 1)));
      if (this.affPlayer) {
        this.affPlayer.volume = newVolume;
      }
      
      // Update mix in snapshot (voice fades, beds stay same)
      this.setState({
        mix: {
          ...this.snapshot.mix,
          affirmations: newVolume,
        },
      });

      currentStep++;
    }, stepDurationMs);
  }

  /**
   * Reset session tracking (call when starting new session)
   */
  resetSessionTracking(): void {
    this.totalPlaybackTimeMs = 0;
    this.sessionStartTime = null;
    this.isFadingOut = false;
    this.lastPlaybackCheck = 0;
    this.setState({ totalPlaybackTimeMs: 0 });
  }
}

// Singleton accessor (V3 rule)
let singleton: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
}
