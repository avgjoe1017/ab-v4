import { PreferencesV3Schema, type PreferencesV3 } from "./schemas";

// Centralized migrations. Only place old shapes get normalized.
export function migratePreferences(input: unknown): PreferencesV3 {
  // TODO: implement v1/v2 -> v3 mapping (e.g., whisper -> neutral voiceId)
  // For skeleton: apply defaults if missing.
  const fallback: PreferencesV3 = {
    schemaVersion: 3,
    voiceId: "neutral",
    pace: "slow",
    affirmationSpacingMs: 1000,
    binauralHz: 10,
    backgroundId: "ocean",
    mix: { affirmations: 1, binaural: 0.35, background: 0.35 },
    loopBackground: true,
    loopBinaural: true,
  };
  const candidate = (typeof input === "object" && input !== null) ? { ...fallback, ...(input as any), schemaVersion: 3 } : fallback;
  return PreferencesV3Schema.parse(candidate);
}
