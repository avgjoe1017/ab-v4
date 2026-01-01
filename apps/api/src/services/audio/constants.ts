import path from "path";
import { AUDIO_PROFILE_V3 } from "@ab/contracts";

export { AUDIO_PROFILE_V3, SILENCE_DURATIONS_MS } from "@ab/contracts";

export const STORAGE_ROOT = path.resolve(process.cwd(), "storage");
export const CHUNKS_DIR = path.join(STORAGE_ROOT, "chunks");
export const MERGED_DIR = path.join(STORAGE_ROOT, "merged");
export const TEMP_DIR = path.join(STORAGE_ROOT, "temp");

// Ensuring directories exist (simple check, initialization logic should handle this)
// This file is just constants.
