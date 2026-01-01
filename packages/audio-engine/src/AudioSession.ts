/**
 * Audio Session Configuration Module
 * Handles audio session setup for background playback and silent mode
 */

import { setAudioModeAsync, setIsAudioActiveAsync } from "expo-audio";

/**
 * Ensures audio session is configured for background playback
 * Caches the promise to avoid multiple configuration calls
 */
export class AudioSession {
  private audioSessionReady: Promise<void> | null = null;

  /**
   * Configure audio session (plays in silent mode, doesn't randomly stall)
   * Returns cached promise if already configuring
   */
  ensureConfigured(): Promise<void> {
    if (this.audioSessionReady) return this.audioSessionReady;

    this.audioSessionReady = (async () => {
      console.log("[AudioSession] Configuring audio session...");
      try {
        console.log("[AudioSession] Calling setIsAudioActiveAsync(true)...");
        await setIsAudioActiveAsync(true);
        console.log("[AudioSession] ✅ setIsAudioActiveAsync(true) completed");
      } catch (e) {
        console.error("[AudioSession] ❌ setIsAudioActiveAsync failed:", e);
        throw e;
      }
      
      try {
        console.log("[AudioSession] Calling setAudioModeAsync...");
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionModeAndroid: "duckOthers",
          interruptionMode: "mixWithOthers",
        });
        console.log("[AudioSession] ✅ setAudioModeAsync completed");
      } catch (e) {
        console.error("[AudioSession] ❌ setAudioModeAsync failed:", e);
        throw e;
      }
      
      console.log("[AudioSession] ✅ Audio session configured successfully");
    })().catch((e) => {
      console.error("[AudioSession] ❌ Audio session config failed:", e);
      // Don't swallow the error completely - log it clearly
    });

    return this.audioSessionReady;
  }
}

