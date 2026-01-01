import { z } from "zod";

export const UUID = z.string().uuid();

// ---- PreferencesV3 ----
export const MixSchema = z.object({
  affirmations: z.number().min(0).max(1),
  binaural: z.number().min(0).max(1),
  background: z.number().min(0).max(1),
});

export const PreferencesV3Schema = z.object({
  schemaVersion: z.literal(3),
  voiceId: z.string().min(1),
  pace: z.enum(["slow", "normal", "fast"]),
  affirmationSpacingMs: z.number().int().min(0),
  binauralHz: z.number().min(1),
  backgroundId: z.string().min(1),
  mix: MixSchema,
  loopBackground: z.boolean(),
  loopBinaural: z.boolean(),
});

export type PreferencesV3 = z.infer<typeof PreferencesV3Schema>;

// ---- DraftSession (client-only) ----
export const DraftSessionSchema = z.object({
  localDraftId: z.string().uuid(),
  title: z.string().min(1),
  goalTag: z.string().optional(),
  // durationSec removed/ignored in V3 Loop
  affirmations: z.array(z.string().min(1)).min(1),
  voiceId: z.string().min(1),
  pace: z.literal("slow").default("slow"), // Locked
  // affirmationSpacingMs: z.number().int().min(0), // Removed from user control
  solfeggioHz: z.number().optional(), // Optional: use solfeggio instead of binaural
});

export type DraftSession = z.infer<typeof DraftSessionSchema>;

// ---- SessionV3 ----
export const SessionV3Schema = z.object({
  schemaVersion: z.literal(3),
  id: UUID,
  ownerUserId: z.string().nullable(), // Changed from .uuid() to accept Clerk user IDs (e.g., "user_xxx")
  source: z.enum(["catalog", "user", "generated"]),
  title: z.string().min(1),
  goalTag: z.string().optional(),
  // durationSec: z.number().int().min(30), // Removed
  affirmations: z.array(z.string().min(1)).min(1),
  voiceId: z.string().min(1),
  pace: z.literal("slow"),
  // affirmationSpacingMs: z.number().int().min(0), // Removed
  frequencyHz: z.number().optional(), // Phase 4.1: Binaural frequency
  brainwaveState: z.enum(["Delta", "Theta", "Alpha", "SMR", "Beta"]).optional(), // Phase 4.1: Brainwave state
  solfeggioHz: z.number().optional(), // Solfeggio frequency (alternative to binaural)
  audio: z.object({
    affirmationsMergedUrl: z.string().url(),
    affirmationsHash: z.string().min(1),
    generatedAt: z.string().datetime(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SessionV3 = z.infer<typeof SessionV3Schema>;

// ---- PlaybackBundleVM ----
export const PlaybackBundleVMSchema = z.object({
  sessionId: UUID,
  affirmationsMergedUrl: z.string().url(),
  background: z.object({
    urlByPlatform: z.object({ ios: z.string().url(), android: z.string().url() }),
    loop: z.literal(true),
  }),
  binaural: z.object({
    urlByPlatform: z.object({ ios: z.string().url(), android: z.string().url() }),
    loop: z.literal(true),
    hz: z.number().min(1),
  }).optional(), // Optional: session may use solfeggio instead
  solfeggio: z.object({
    urlByPlatform: z.object({ ios: z.string().url(), android: z.string().url() }),
    loop: z.literal(true),
    hz: z.number().min(1),
  }).optional(), // Optional: session may use binaural instead
  mix: MixSchema,
  effectiveAffirmationSpacingMs: z.number().int().min(0),
  loudness: z.object({
    affirmationsLUFS: z.number().optional(),
    backgroundLUFS: z.number().optional(),
    binauralLUFS: z.number().optional(),
    solfeggioLUFS: z.number().optional(),
  }).optional(),
  voiceActivity: z.object({
    segments: z.array(z.object({
      startMs: z.number().int().min(0),
      endMs: z.number().int().min(0),
    })),
    thresholdDb: z.number().optional(),
    minSilenceMs: z.number().optional(),
  }).optional(),
}).refine(
  (data) => data.binaural || data.solfeggio,
  { message: "Either binaural or solfeggio must be provided" }
);

export type PlaybackBundleVM = z.infer<typeof PlaybackBundleVMSchema>;

// ---- EntitlementV3 ----
export const EntitlementV3Schema = z.object({
  plan: z.enum(["free", "pro"]),
  status: z.enum(["active", "grace", "expired", "unknown"]),
  renewsAt: z.string().datetime().optional(),
  source: z.enum(["apple", "google", "stripe", "internal", "revenuecat"]).optional(), // Phase 6.3: Added revenuecat
  limits: z.object({
    dailyGenerations: z.number().int().min(0),
    maxSessionLengthSec: z.number().int().min(0),
    offlineDownloads: z.boolean(),
  }),
  canCreateSession: z.boolean(),
  canGenerateAudio: z.boolean(),
  remainingFreeGenerationsToday: z.number().int().min(0),
  maxSessionLengthSecEffective: z.number().int().min(0),
});

export type EntitlementV3 = z.infer<typeof EntitlementV3Schema>;

// ---- V4 SCHEMAS ----

// ---- ChatTurnV4 ----
export const ChatTurnV4Schema = z.object({
  threadId: UUID.optional(), // Optional: first turn creates thread
  message: z.string().min(1),
  locale: z.string().optional(), // e.g., "en-US"
  clientContext: z.object({
    platform: z.string().optional(),
    appVersion: z.string().optional(),
    timezoneOffsetMinutes: z.number().int().optional(), // Minutes from UTC (e.g., -300 for EST)
  }).optional(),
});

export type ChatTurnV4 = z.infer<typeof ChatTurnV4Schema>;

export const ChatTurnResponseV4Schema = z.object({
  threadId: UUID,
  assistantMessages: z.array(z.object({
    id: UUID,
    text: z.string().min(1),
    timestamp: z.string().datetime(),
  })),
  suggestedChips: z.array(z.object({
    id: z.string(),
    text: z.string().min(1),
  })).optional(),
  planPreview: z.object({
    planDraftId: UUID,
    title: z.string().min(1),
    affirmations: z.array(z.string().min(1)),
    intent: z.string().optional(), // User's original intent/context
  }).optional(),
});

export type ChatTurnResponseV4 = z.infer<typeof ChatTurnResponseV4Schema>;

// ---- PlanV4 ----
export const PlanV4Schema = z.object({
  schemaVersion: z.literal(4),
  id: UUID,
  threadId: UUID.optional(), // Link back to chat thread that created it
  ownerUserId: z.string().nullable(),
  source: z.enum(["catalog", "user", "generated", "saved"]),
  title: z.string().min(1),
  intent: z.string().optional(), // User's original intent/context
  affirmations: z.array(z.string().min(1)),
  affirmationCount: z.number().int().min(6).max(24), // 6, 12, 18, or 24
  voiceId: z.string().min(1),
  // Audio settings (V4)
  brainTrackMode: z.enum(["binaural", "solfeggio", "none"]).optional(),
  binauralHz: z.number().min(1).optional(),
  binauralState: z.enum(["Delta", "Theta", "Alpha", "SMR", "Beta"]).optional(),
  solfeggioHz: z.number().min(1).optional(),
  backgroundId: z.string().optional(),
  // State
  isSaved: z.boolean().default(false), // Paid only
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Audio (same structure as V3)
  audio: z.object({
    affirmationsMergedUrl: z.string().url(),
    affirmationsHash: z.string().min(1),
    generatedAt: z.string().datetime(),
  }).optional(),
});

export type PlanV4 = z.infer<typeof PlanV4Schema>;

// ---- PlanCommitV4 ----
export const PlanCommitV4Schema = z.object({
  threadId: UUID,
  planDraftId: UUID,
  selections: z.object({
    affirmationCount: z.number().int().min(6).max(24).optional(), // Override if user changed from default
    voiceId: z.string().optional(), // Override if user changed
    brainTrackMode: z.enum(["binaural", "solfeggio", "none"]).optional(),
    binauralHz: z.number().optional(),
    binauralState: z.enum(["Delta", "Theta", "Alpha", "SMR", "Beta"]).optional(),
    solfeggioHz: z.number().optional(),
    backgroundId: z.string().optional(),
  }).optional(),
});

export type PlanCommitV4 = z.infer<typeof PlanCommitV4Schema>;

export const PlanCommitResponseV4Schema = z.object({
  planId: UUID,
  audioJobId: UUID.optional(), // If audio generation was triggered
});

export type PlanCommitResponseV4 = z.infer<typeof PlanCommitResponseV4Schema>;

// ---- EntitlementV4 ----
export const EntitlementV4Schema = z.object({
  schemaVersion: z.literal(4),
  plan: z.enum(["free", "pro"]),
  status: z.enum(["active", "grace", "expired", "unknown"]),
  renewsAt: z.string().datetime().optional(),
  source: z.enum(["apple", "google", "stripe", "internal", "revenuecat"]).optional(),
  limits: z.object({
    dailyPlans: z.union([z.number().int().min(0), z.literal("unlimited")]), // Free: 1, Paid: "unlimited"
    maxSessionDurationMs: z.union([z.number().int().min(0), z.literal("unlimited")]), // Free: 300000 (5 minutes), Paid: "unlimited"
    affirmationCountsAllowed: z.array(z.number().int().min(6).max(24)), // Free: [6], Paid: [6,12,18,24]
    canSave: z.boolean(), // Free: false, Paid: true
    voicesAllowed: z.array(z.string()).or(z.literal("all")), // Free: ["male","female"], Paid: "all"
    canPickBrainTrack: z.boolean(), // Free: false, Paid: true
    canPickBackground: z.boolean(), // Free: false, Paid: true
    canWriteOwnAffirmations: z.boolean(), // Free: false, Paid: true
  }),
  canCreatePlan: z.boolean(), // Based on dailyPlans limit
  remainingPlansToday: z.union([z.number().int().min(0), z.literal("unlimited")]),
});

export type EntitlementV4 = z.infer<typeof EntitlementV4Schema>;
