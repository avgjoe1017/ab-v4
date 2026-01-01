import type { PlaybackBundleVM } from "@ab/contracts";

export type Mix = PlaybackBundleVM["mix"];

export type AudioEngineStatus =
  | "idle"
  | "preroll"  // Pre-roll atmosphere playing while main tracks load
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "stopping"
  | "error";

export type AudioEngineSnapshot = {
  status: AudioEngineStatus;
  sessionId?: string;
  positionMs: number;
  durationMs: number;
  mix: Mix;
  error?: { message: string; details?: unknown };
  // P1.1: Session duration cap for Free tier (5 minutes)
  sessionDurationCapMs?: number | "unlimited"; // Max session duration (300000ms for Free, unlimited for Paid)
  totalPlaybackTimeMs?: number; // Total time played in this session (for Free tier cap)
};
