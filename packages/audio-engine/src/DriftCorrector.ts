/**
 * Drift Corrector Module
 * 
 * IMPORTANT: Drift correction for binaural/background tracks is DISABLED.
 * 
 * Rationale (from audio analysis):
 * - Hard-seeking during playback causes audible micro-gaps
 * - Beds don't need to be time-locked to affirmations for the experience
 * - expo-audio handles looping automatically with loop=true
 * - If correction is needed, it should only happen at loop boundaries with fade-out→seek→fade-in
 * 
 * This module is retained for potential future use cases where drift correction
 * might be needed (e.g., for synchronized visual elements), but is currently no-op.
 */

import type { AudioPlayer } from "expo-audio";

/**
 * Drift correction - DISABLED for binaural/background tracks
 * 
 * Previously this would seek beds to match affirmation position,
 * but this caused split-second audio dropouts. Now it's a no-op.
 * 
 * Beds use loop=true and expo-audio handles seamless looping natively.
 */
export function correctDrift(
  _affPlayer: AudioPlayer | null,
  _binPlayer: AudioPlayer | null,
  _bgPlayer: AudioPlayer | null
): void {
  // DISABLED: Seeking during playback causes audible gaps.
  // Beds don't need to be synchronized with affirmations.
  // See: packages/audio-engine/src/DriftCorrector.ts header comment
  return;
}

/**
 * Future: If drift correction is ever needed, implement with fades:
 * 
 * 1. Check if volume is near-zero (during ducking), then seek is safe
 * 2. Or detect loop boundary, fade out over 100ms, seek, fade in over 100ms
 * 3. Never hard-seek while audio is audible at normal volume
 */
export function correctDriftWithFade(
  affPlayer: AudioPlayer | null,
  binPlayer: AudioPlayer | null,
  bgPlayer: AudioPlayer | null,
  currentBinVolume: number,
  currentBgVolume: number
): void {
  // Only correct if volume is very low (during ducking), making any gap inaudible
  if (currentBinVolume > 0.05 || currentBgVolume > 0.05) {
    return; // Don't correct - audio is audible
  }
  
  if (!affPlayer || !binPlayer || !bgPlayer) return;

  const affTime = affPlayer.currentTime;
  const binDuration = binPlayer.duration || 1;
  const bgDuration = bgPlayer.duration || 1;

  // Only correct significant drift (>500ms) during silent periods
  const binExpected = affTime % binDuration;
  const binDrift = Math.abs(binPlayer.currentTime - binExpected);
  if (binDrift > 0.5) {
    console.log(`[DriftCorrector] Correcting binaural drift during low volume: ${(binDrift * 1000).toFixed(0)}ms`);
    binPlayer.seekTo(binExpected);
  }

  const bgExpected = affTime % bgDuration;
  const bgDrift = Math.abs(bgPlayer.currentTime - bgExpected);
  if (bgDrift > 0.5) {
    console.log(`[DriftCorrector] Correcting background drift during low volume: ${(bgDrift * 1000).toFixed(0)}ms`);
    bgPlayer.seekTo(bgExpected);
  }
}
