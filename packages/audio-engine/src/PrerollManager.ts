/**
 * Preroll Manager Module
 * Handles pre-roll atmosphere playback (starts immediately while main tracks load)
 */

import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { GainSmoother } from "./smoothing";

export class PrerollManager {
  private prerollPlayer: AudioPlayer | null = null;
  private prerollAssetUri: string | null = null;
  private prerollFadeOutInterval: ReturnType<typeof setInterval> | null = null;
  private prerollSmoother: GainSmoother;

  constructor() {
    this.prerollSmoother = new GainSmoother({ attackMs: 80, releaseMs: 250 });
  }

  /**
   * Set the pre-roll atmosphere asset URI.
   * This must be called from the mobile app context with the resolved asset URI.
   */
  setPrerollAssetUri(uri: string): void {
    this.prerollAssetUri = uri;
  }

  /**
   * Get the pre-roll atmosphere asset URI.
   * Pre-roll atmosphere is not an intro - it's designed to feel like stepping into an already-existing environment.
   * This should be a bundled local asset that's instantly available offline.
   */
  private async getPrerollAssetUri(): Promise<string> {
    if (!this.prerollAssetUri) {
      throw new Error("Pre-roll asset URI not set. Call setPrerollAssetUri() from mobile app context first.");
    }
    return this.prerollAssetUri;
  }

  /**
   * Start pre-roll atmosphere player.
   * Pre-roll starts immediately (within 100-300ms) to buy time while main tracks load.
   */
  async start(): Promise<void> {
    if (this.prerollPlayer) return; // Already started

    try {
      const prerollUri = await this.getPrerollAssetUri();
      console.log("[PrerollManager] Starting pre-roll with URI:", prerollUri);
      this.prerollPlayer = createAudioPlayer({ uri: prerollUri });
      this.prerollPlayer.loop = true; // Loop if needed while loading
      this.prerollPlayer.volume = 0; // Start at 0 for fade-in
      
      await this.prerollPlayer.play();
      console.log("[PrerollManager] Pre-roll player started");
      
      // Fade in over 250ms using smoother (control loop will handle it)
      this.prerollSmoother.reset(0);
      this.prerollSmoother.setTarget(0.10); // Cap at 10%
    } catch (error) {
      console.error("[PrerollManager] Failed to start pre-roll:", error);
      console.warn("[PrerollManager] Continuing without pre-roll");
      // Don't block playback if pre-roll fails
    }
  }

  /**
   * Fade pre-roll volume smoothly.
   */
  fadeVolume(from: number, to: number, durationMs: number): void {
    if (!this.prerollPlayer) return;
    
    // Clear any existing fade interval
    if (this.prerollFadeOutInterval) {
      clearInterval(this.prerollFadeOutInterval);
      this.prerollFadeOutInterval = null;
    }
    
    const steps = 20; // 20 steps for smooth fade
    const stepDuration = durationMs / steps;
    const stepSize = (to - from) / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      const volume = Math.min(0.10, from + stepSize * currentStep); // Cap at 10%
      if (this.prerollPlayer) {
        this.prerollPlayer.volume = volume;
      }

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        if (this.prerollFadeOutInterval === fadeInterval) {
          this.prerollFadeOutInterval = null;
        }
      }
    }, stepDuration);
    
    // Track fade interval for cleanup
    this.prerollFadeOutInterval = fadeInterval;
  }

  /**
   * Stop and release pre-roll player.
   */
  async stop(fadeOutMs: number = 300): Promise<void> {
    if (!this.prerollPlayer) return;

    // Fade out smoothly
    const currentVolume = this.prerollPlayer.volume;
    this.fadeVolume(currentVolume, 0, fadeOutMs);
    
    // Wait for fade, then stop and release
    setTimeout(async () => {
      if (this.prerollPlayer) {
        await this.prerollPlayer.pause();
        this.prerollPlayer.release();
        this.prerollPlayer = null;
      }
    }, fadeOutMs + 50); // Small buffer
  }

  /**
   * Get the preroll player (for volume control)
   */
  getPlayer(): AudioPlayer | null {
    return this.prerollPlayer;
  }

  /**
   * Get the preroll smoother (for volume control)
   */
  getSmoother(): GainSmoother {
    return this.prerollSmoother;
  }

  /**
   * Check if preroll is active
   */
  isActive(): boolean {
    return this.prerollPlayer !== null;
  }
}

