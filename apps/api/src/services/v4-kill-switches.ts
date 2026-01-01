/**
 * V4 Kill Switches Service
 * P1-10.2: Remote flags for production safety
 * 
 * Kill switches can be toggled via environment variables to:
 * - Force silent mode (all playback uses silent mode, no voice)
 * - Force premade-only for Free users (cost control)
 * - Disable certain voices/tracks if failing
 * 
 * Future enhancement: Store in database with admin UI for toggling
 */

/**
 * Check if silent mode is forced globally
 * If true, all playback bundles will return fallbackMode: "silent"
 */
export function isSilentModeForced(): boolean {
  return process.env.KILL_SWITCH_FORCE_SILENT === "true";
}

/**
 * Check if Free users are forced to use premade plans only
 * If true, Free users will not get generated plans, only premade matches
 */
export function isPremadeOnlyForFreeForced(): boolean {
  return process.env.KILL_SWITCH_PREMADE_ONLY_FREE === "true";
}

/**
 * Get list of disabled voice IDs
 * Disabled voices will not be used for audio generation
 * Format: Comma-separated list in env var, e.g., "voice1,voice2,voice3"
 */
export function getDisabledVoices(): string[] {
  const disabled = process.env.KILL_SWITCH_DISABLED_VOICES;
  if (!disabled) return [];
  return disabled.split(",").map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Check if a specific voice is disabled
 */
export function isVoiceDisabled(voiceId: string): boolean {
  const disabled = getDisabledVoices();
  return disabled.includes(voiceId);
}

/**
 * Get list of disabled brain track frequencies (Hz)
 * Disabled frequencies will fall back to default or be skipped
 * Format: Comma-separated list in env var, e.g., "10,20,30"
 */
export function getDisabledBrainTrackFrequencies(): number[] {
  const disabled = process.env.KILL_SWITCH_DISABLED_BRAIN_TRACKS;
  if (!disabled) return [];
  return disabled
    .split(",")
    .map(v => v.trim())
    .filter(v => v.length > 0)
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v));
}

/**
 * Check if a specific brain track frequency is disabled
 */
export function isBrainTrackFrequencyDisabled(hz: number): boolean {
  const disabled = getDisabledBrainTrackFrequencies();
  return disabled.includes(hz);
}

/**
 * Get list of disabled background IDs
 * Disabled backgrounds will fall back to default
 * Format: Comma-separated list in env var, e.g., "background1,background2"
 */
export function getDisabledBackgrounds(): string[] {
  const disabled = process.env.KILL_SWITCH_DISABLED_BACKGROUNDS;
  if (!disabled) return [];
  return disabled.split(",").map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Check if a specific background is disabled
 */
export function isBackgroundDisabled(backgroundId: string): boolean {
  const disabled = getDisabledBackgrounds();
  return disabled.includes(backgroundId);
}

/**
 * Get all kill switch status (for admin/debugging)
 */
export function getKillSwitchStatus(): {
  forceSilentMode: boolean;
  premadeOnlyForFree: boolean;
  disabledVoices: string[];
  disabledBrainTracks: number[];
  disabledBackgrounds: string[];
} {
  return {
    forceSilentMode: isSilentModeForced(),
    premadeOnlyForFree: isPremadeOnlyForFreeForced(),
    disabledVoices: getDisabledVoices(),
    disabledBrainTracks: getDisabledBrainTrackFrequencies(),
    disabledBackgrounds: getDisabledBackgrounds(),
  };
}
