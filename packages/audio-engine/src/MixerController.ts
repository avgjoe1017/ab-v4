/**
 * Mixer Controller Module
 * Handles mix automation, crossfade, and control loop for smooth audio transitions
 */

import type { AudioPlayer } from "expo-audio";
import type { Mix } from "./types";
import { GainSmoother } from "./smoothing";
import { VoiceActivityDucker } from "./ducking";
import { computeTargetVolumes, equalPowerCrossfade } from "./mixer";

export interface MixerControllerState {
  sessionStartTime: number;
  automationMultipliers: {
    affirmations: number;
    binaural: number;
    background: number;
  };
  crossfadeStartTime: number;
  crossfadeDuration: number;
  isCrossfading: boolean;
}

export class MixerController {
  private affSmoother: GainSmoother;
  private binSmoother: GainSmoother;
  private bgSmoother: GainSmoother;
  private prerollSmoother: GainSmoother | null = null; // Will be set from PrerollManager
  private ducker: VoiceActivityDucker | null = null;
  private state: MixerControllerState = {
    sessionStartTime: 0,
    automationMultipliers: {
      affirmations: 0,
      binaural: 0,
      background: 0,
    },
    crossfadeStartTime: 0,
    crossfadeDuration: 0,
    isCrossfading: false,
  };
  private lastControlTick: number = Date.now();

  constructor() {
    // Initialize gain smoothers with attack/release times
    this.affSmoother = new GainSmoother({ attackMs: 80, releaseMs: 250 });
    this.binSmoother = new GainSmoother({ attackMs: 80, releaseMs: 250 });
    this.bgSmoother = new GainSmoother({ attackMs: 80, releaseMs: 250 });
    // prerollSmoother will be set from PrerollManager
  }

  /**
   * Set preroll smoother (from PrerollManager)
   */
  setPrerollSmoother(smoother: GainSmoother): void {
    this.prerollSmoother = smoother;
  }

  /**
   * Initialize voice activity ducker
   */
  setDucker(ducker: VoiceActivityDucker | null): void {
    this.ducker = ducker;
  }

  /**
   * Get smoothers for external access
   */
  getSmoothers() {
    return {
      aff: this.affSmoother,
      bin: this.binSmoother,
      bg: this.bgSmoother,
      preroll: this.prerollSmoother,
    };
  }

  /**
   * Start intro automation (rolling start)
   */
  startIntroAutomation(): void {
    this.state.sessionStartTime = Date.now();
    this.state.automationMultipliers = {
      affirmations: 0,
      binaural: 0,
      background: 0,
    };
  }

  /**
   * Start crossfade from preroll to main mix
   */
  startCrossfade(durationMs: number = 1750): void {
    this.state.isCrossfading = true;
    this.state.crossfadeStartTime = Date.now();
    this.state.crossfadeDuration = durationMs;
    // Reset automation during crossfade
    this.state.automationMultipliers = {
      affirmations: 1.0,
      binaural: 1.0,
      background: 1.0,
    };
  }

  /**
   * Complete crossfade and start intro automation
   */
  completeCrossfade(): void {
    this.state.isCrossfading = false;
    if (this.prerollSmoother) {
      this.prerollSmoother.setTarget(0);
    }
    this.startIntroAutomation();
  }

  /**
   * Reset automation state
   */
  resetAutomation(): void {
    this.state.sessionStartTime = 0;
    this.state.automationMultipliers = {
      affirmations: 0,
      binaural: 0,
      background: 0,
    };
  }

  /**
   * Control tick - updates mixer, ducking, smoothing, automation
   * Called every 25ms when playing or prerolling
   */
  controlTick(
    status: "preroll" | "playing" | string,
    positionMs: number,
    userMix: Mix,
    affPlayer: AudioPlayer | null,
    binPlayer: AudioPlayer | null,
    bgPlayer: AudioPlayer | null,
    prerollPlayer: AudioPlayer | null
  ): { crossfadeComplete: boolean } {
    const now = Date.now();
    const dtMs = Math.max(0, now - this.lastControlTick);
    this.lastControlTick = now;

    // Only run control loop during preroll or playing
    if (status !== "preroll" && status !== "playing") {
      return { crossfadeComplete: false };
    }

    // Update intro automation multipliers (only during initial play, not during crossfade)
    // Rolling start: Background first, then binaural, then affirmations
    // Each layer fades in gradually for a smooth, professional intro
    if (this.state.sessionStartTime > 0 && !this.state.isCrossfading) {
      const elapsed = now - this.state.sessionStartTime;
      
      // Background: starts immediately, fades in over 4000ms (4 seconds)
      this.state.automationMultipliers.background = Math.min(1, elapsed / 4000);
      
      // Binaural: starts after 2000ms delay, fades in over 4000ms
      const binElapsed = Math.max(0, elapsed - 2000);
      this.state.automationMultipliers.binaural = Math.min(1, binElapsed / 4000);
      
      // Affirmations: starts after 5000ms delay, fades in over 3000ms
      // This ensures background and binaural are well-established before voice comes in
      const affElapsed = Math.max(0, elapsed - 5000);
      this.state.automationMultipliers.affirmations = Math.min(1, affElapsed / 3000);
    } else if (this.state.isCrossfading) {
      // During crossfade, automation is handled by crossfade curve
      // Set to 1.0 so crossfade curve controls everything
      this.state.automationMultipliers = {
        affirmations: 1.0,
        binaural: 1.0,
        background: 1.0,
      };
    }

    // Update ducking if voice activity is available
    let duckingMultipliers = { background: 1.0, binaural: 1.0 };
    if (this.ducker) {
      duckingMultipliers = this.ducker.update(positionMs, dtMs);
    }

    // Compute target volumes using mixer
    const targetVolumes = computeTargetVolumes({
      userMix,
      stateMultipliers: {
        affirmations: (status === "playing" || status === "preroll") ? 1.0 : 0,
        binaural: (status === "playing" || status === "preroll") ? 1.0 : 0,
        background: (status === "playing" || status === "preroll") ? 1.0 : 0,
      },
      duckingMultipliers,
      automationMultipliers: this.state.automationMultipliers,
      safetyCeilings: {
        affirmations: 1.0,
        binaural: 1.0,
        background: 1.0,
      },
    });

    // Handle crossfade if active
    let crossfadeComplete = false;
    if (this.state.isCrossfading && prerollPlayer) {
      const crossfadeElapsed = Date.now() - this.state.crossfadeStartTime;
      const progress = Math.min(1, crossfadeElapsed / this.state.crossfadeDuration);
      
      if (progress >= 1) {
        // Crossfade complete
        crossfadeComplete = true;
      } else {
        // Equal-power crossfade
        const { main, preroll } = equalPowerCrossfade(progress);
        
        // Apply crossfade to main mix
        targetVolumes.affirmations *= main;
        targetVolumes.binaural *= main;
        targetVolumes.background *= main;
        
        // Apply crossfade to preroll
        if (this.prerollSmoother) {
          this.prerollSmoother.setTarget(preroll * 0.10); // Cap preroll at 10%
        }
      }
    }

    // Update smoothers with targets
    if (affPlayer) {
      this.affSmoother.setTarget(targetVolumes.affirmations);
      affPlayer.volume = this.affSmoother.update(dtMs);
    }
    
    if (binPlayer) {
      this.binSmoother.setTarget(targetVolumes.binaural);
      binPlayer.volume = this.binSmoother.update(dtMs);
    }
    
    if (bgPlayer) {
      this.bgSmoother.setTarget(targetVolumes.background);
      bgPlayer.volume = this.bgSmoother.update(dtMs);
    }
    
    if (prerollPlayer && this.prerollSmoother) {
      prerollPlayer.volume = this.prerollSmoother.update(dtMs);
    }

    return { crossfadeComplete };
  }

  /**
   * Reset all smoothers to a value (for rolling start)
   */
  resetSmoothers(value: number = 0): void {
    this.affSmoother.reset(value);
    this.binSmoother.reset(value);
    this.bgSmoother.reset(value);
  }

  /**
   * Get session start time for drift correction timing
   */
  getSessionStartTime(): number {
    return this.state.sessionStartTime;
  }
}

