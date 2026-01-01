import { Hono } from "hono";
import { z } from "zod";
import crypto from "crypto";
import { UUID, PlaybackBundleVMSchema, type ApiError, DraftSessionSchema, SessionV3Schema, ChatTurnV4Schema, ChatTurnResponseV4Schema, PlanCommitV4Schema, PlanCommitResponseV4Schema, EntitlementV4Schema } from "@ab/contracts";
import path from "path";
import fs from "fs-extra";
import { createJob, getJob, registerJobProcessor, startJobWorker } from "./services/jobs";
import { processEnsureAudioJob } from "./services/audio/generation";
import { getEntitlement } from "./services/entitlements";
import { generateAffirmations, type AffirmationGenerationRequest } from "./services/affirmation-generator";
import { moderateAffirmation } from "./services/moderation";
import { getFrequencyForGoalTag } from "@ab/contracts";
import { checkRateLimit } from "./services/rate-limit";
import { authenticateAdmin, createSessionToken, destroySession, getSession } from "./services/admin/auth";
import { requireAdminAuth, requireAdminRole, type AdminContext } from "./middleware/admin-auth";
import { createAuditLog, getAuditLogs } from "./services/admin/audit";
import {
  getModerationStats,
  getFlaggedSessions,
  moderateAffirmationAction,
  bulkModerateAffirmations,
} from "./services/admin/moderation";
import {
  getAISourceTemplates,
  getAISourceTemplate,
  createAISourceTemplate,
  createAISourceVersion,
  updateAISourceVersion,
  activateAISourceVersion,
} from "./services/admin/ai-sources";
import {
  getCurationCards,
  trackSessionEvent,
  saveCurationPreferences,
  getCurationPreferences,
  type CurationPreferences,
} from "./services/curation";
import { processChatTurn, commitPlan } from "./services/v4-chat";
import { rerollPlanDraft } from "./services/v4-reroll";
import { getPlaybackBundleV4 } from "./services/v4-playback";

import { prisma } from "./lib/db";
import { getUserId } from "./lib/auth";
import { requireAuthMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error-handler";
import { config, getPort } from "./lib/config";

const app = new Hono();

// Phase 6: Production middleware
app.use("*", corsMiddleware);
app.onError(errorHandler);

// ---- helpers ----
const error = (code: ApiError["code"], message: string, details?: unknown) =>
  ({ code, message, details } satisfies ApiError);

const uuidParam = z.object({ id: UUID });

// Define STORAGE_PUBLIC_BASE_URL for local dev static serving
export const STORAGE_PUBLIC_BASE_URL = "/storage";
export const ASSETS_PUBLIC_BASE_URL = "/assets";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

function getApiBaseUrl(c: any): string {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const host = c.req.header("host") || "localhost:8787";
  const protocol = c.req.header("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

function canAccessSession(session: { source: string; ownerUserId: string | null }, userId: string | null): boolean {
  if (session.source === "catalog") return true;
  if (!userId) return false;
  return session.ownerUserId === userId;
}

// ---- health ----
app.get("/health", (c) => c.json({ ok: true }));

// ---- ENTITLEMENTS ----
app.get("/me/entitlement", async (c) => {
  // Phase 6.1: Use auth helper (currently returns default user ID, ready for Clerk integration)
  const userId = await getUserId(c);
  const ent = await getEntitlement(userId);
  return c.json(ent);
});

// V4: Return V4 format entitlements
app.get("/v4/me/entitlement", async (c) => {
  const userId = await getUserId(c);
  const v3Ent = await getEntitlement(userId);
  
  // Map V3 to V4 structure
  const v4Ent = EntitlementV4Schema.parse({
    schemaVersion: 4,
    plan: v3Ent.plan,
    status: v3Ent.status,
    renewsAt: v3Ent.renewsAt,
    source: v3Ent.source,
    limits: {
      dailyPlans: v3Ent.plan === "free" ? 1 : "unlimited",
      maxSessionDurationMs: v3Ent.plan === "free" ? 300000 : "unlimited",
      affirmationCountsAllowed: v3Ent.plan === "free" ? [6] : [6, 12, 18, 24],
      canSave: v3Ent.plan === "pro",
      voicesAllowed: v3Ent.plan === "free" ? ["male", "female"] : "all",
      canPickBrainTrack: v3Ent.plan === "pro",
      canPickBackground: v3Ent.plan === "pro",
      canWriteOwnAffirmations: v3Ent.plan === "pro",
    },
    canCreatePlan: v3Ent.canCreateSession,
    remainingPlansToday: v3Ent.plan === "pro" ? "unlimited" : v3Ent.remainingFreeGenerationsToday,
  });
  
  return c.json(v4Ent);
});

// P1-7.2: GET /v4/me/last-plan - Get last saved plan settings for "same vibe as yesterday"
app.get("/v4/me/last-plan", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const { getLastSavedPlanSettings } = await import("./services/v4-last-plan");
    const lastPlan = await getLastSavedPlanSettings(userId);

    if (!lastPlan) {
      return c.json({ settings: null }, 200);
    }

    return c.json({ settings: lastPlan }, 200);
  } catch (err: unknown) {
    console.error("[API] Error fetching last plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch last plan", errorMessage),
      500
    );
  }
});

// ---- AFFIRMATIONS ----
app.post("/affirmations/generate", async (c) => {
  try {
    const body = await c.req.json();

    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const rate = checkRateLimit(`affirmations:${userId}`, 60_000, 5);
    if (!rate.allowed) {
      return c.json(
        error("RATE_LIMITED", "Too many requests. Please wait and try again.", {
          resetAt: rate.resetAt,
        }),
        429
      );
    }
    
    // Validate request
    const request: AffirmationGenerationRequest = {
      sessionType: body.sessionType || "Meditate",
      struggle: body.struggle,
      goal: body.goal, // User's written goal for this specific session
      count: body.count || 4,
    };

    // Generate affirmations
    const result = await generateAffirmations(request);
    
    return c.json({
      affirmations: result.affirmations,
      reasoning: result.reasoning,
    });
  } catch (err: unknown) {
    console.error("[API] Error generating affirmations:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to generate affirmations", errorMessage),
      500
    );
  }
});

// ---- USER VALUES ----
app.post("/me/values", async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate request
    if (!Array.isArray(body.values)) {
      return c.json(error("VALIDATION_ERROR", "values must be an array"), 400);
    }

    // Phase 6.1: Use auth helper (currently returns default user ID, ready for Clerk integration)
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    
    // Ensure user exists (use upsert to handle case where user exists with different email)
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {}, // Don't update if exists
      create: {
        id: userId,
        email: `user-${userId}@example.com`, // Email will come from auth provider in production
      },
    });

    // Delete existing values for this user
    await prisma.userValue.deleteMany({
      where: { userId },
    });

    // Create new values with ranking
    const valuesToCreate = body.values.map((value: { valueId: string; valueText: string; rank?: number }, index: number) => ({
      userId,
      valueId: value.valueId,
      valueText: value.valueText,
      rank: value.rank ?? (index < 3 ? index + 1 : null), // Top 3 get ranks 1-3, rest are null
    }));

    await prisma.userValue.createMany({
      data: valuesToCreate,
    });

    return c.json({ success: true, count: valuesToCreate.length });
  } catch (err: unknown) {
    console.error("[API] Error saving user values:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to save user values", errorMessage),
      500
    );
  }
});

app.get("/me/values", async (c) => {
  try {
    // Phase 6.1: Use auth helper
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    
    const values = await prisma.userValue.findMany({
      where: { userId },
      orderBy: [
        { rank: "asc" }, // Ranked values first
        { createdAt: "asc" }, // Then by creation order
      ],
    });

    return c.json({ values });
  } catch (err: unknown) {
    console.error("[API] Error fetching user values:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch user values", errorMessage),
      500
    );
  }
});

app.put("/me/struggle", async (c) => {
  try {
    const body = await c.req.json();
    const struggle = typeof body.struggle === "string" ? body.struggle.trim() : null;

    // Validate length
    if (struggle && struggle.length > 200) {
      return c.json(error("VALIDATION_ERROR", "Struggle text must be 200 characters or less"), 400);
    }

    // Phase 6.1: Use auth helper
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    
    // Ensure user exists and update struggle
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { struggle: struggle || null },
      create: {
        id: userId,
        email: `user-${userId}@example.com`, // Email will come from auth provider in production
        struggle: struggle || undefined,
      },
    });

    return c.json({ success: true, struggle: user.struggle });
  } catch (err: unknown) {
    console.error("[API] Error saving user struggle:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to save user struggle", errorMessage),
      500
    );
  }
});

app.get("/me/struggle", async (c) => {
  try {
    // Phase 6.1: Use auth helper
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { struggle: true },
    });

    return c.json({ struggle: user?.struggle || null });
  } catch (err: unknown) {
    console.error("[API] Error fetching user struggle:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch user struggle", errorMessage),
      500
    );
  }
});

// ---- CURATION ----
app.get("/me/curation", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const cards = await getCurationCards(userId);
    return c.json({ cards });
  } catch (err: unknown) {
    console.error("[API] Error fetching curation cards:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch curation cards", errorMessage),
      500
    );
  }
});

app.post("/me/curation/preferences", async (c) => {
  try {
    const body = await c.req.json();
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const preferences: CurationPreferences = {
      primaryGoal: body.primaryGoal,
      voicePreference: body.voicePreference,
      soundPreference: body.soundPreference,
    };

    await saveCurationPreferences(userId, preferences);
    return c.json({ success: true });
  } catch (err: unknown) {
    console.error("[API] Error saving curation preferences:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to save curation preferences", errorMessage),
      500
    );
  }
});

app.get("/me/curation/preferences", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const preferences = await getCurationPreferences(userId);
    return c.json({ preferences });
  } catch (err: unknown) {
    console.error("[API] Error fetching curation preferences:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch curation preferences", errorMessage),
      500
    );
  }
});

app.post("/sessions/:id/events", async (c) => {
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID", parsed.error.flatten()), 400);
    }

    const body = await c.req.json();
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const eventType = body.eventType as "start" | "complete" | "abandon" | "replay" | "skip_affirmation" | "mix_adjust";
    if (!["start", "complete", "abandon", "replay", "skip_affirmation", "mix_adjust"].includes(eventType)) {
      return c.json(error("VALIDATION_ERROR", "Invalid eventType"), 400);
    }

    await trackSessionEvent(userId, parsed.data.id, eventType, body.metadata);

    // DATA STRATEGY: Record efficacy events for session completion/abandon
    try {
      const session = await prisma.session.findUnique({
        where: { id: parsed.data.id },
        include: { v4Plan: true },
      });

      if (session && session.v4Plan) {
        const { recordEfficacyEvent } = await import("./services/data-strategy/efficacy-map");
        
        // Get intent mapping for this plan
        const { mapIntent } = await import("./services/data-strategy/intent-ontology");
        const intentMapping = await mapIntent(userId, session.v4Plan.intentSummary || "", undefined, session.v4Plan.id);

        if (eventType === "complete") {
          await recordEfficacyEvent({
            userId,
            sessionId: session.id,
            planId: session.v4Plan.id,
            topicId: intentMapping.topicId,
            outcomeType: "completion",
            outcomeValue: 1.0,
            reasonCode: body.metadata?.completionReason || "natural_end",
          });
        } else if (eventType === "abandon") {
          await recordEfficacyEvent({
            userId,
            sessionId: session.id,
            planId: session.v4Plan.id,
            topicId: intentMapping.topicId,
            outcomeType: "abandon",
            outcomeValue: body.metadata?.abandonTimeSec ? body.metadata.abandonTimeSec / 1000 : undefined,
            reasonCode: body.metadata?.reasonCode || "other",
          });
        }
      }
    } catch (dataStrategyError) {
      // Don't fail event tracking if data strategy fails
      console.error("[API] Data strategy integration error:", dataStrategyError);
    }

    return c.json({ success: true });
  } catch (err: unknown) {
    console.error("[API] Error tracking session event:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to track session event", errorMessage),
      500
    );
  }
});

// ---- SESSIONS ----

app.get("/sessions", async (c) => {
  // V3: Return lightweight list without durationSec (sessions are infinite)
  const userId = await getUserId(c);
  const rawLimit = Number(c.req.query("limit") ?? DEFAULT_PAGE_LIMIT);
  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  const where = userId
    ? { OR: [{ source: "catalog" }, { ownerUserId: userId }] }
    : { source: "catalog" };

  const sessions = await prisma.session.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, goalTag: true }, // Lightweight list
    take: limit,
    skip: offset,
  });
  console.log("[API] GET /sessions - Returning", sessions.length, "sessions");
  console.log("[API] Session goalTags:", sessions.map(s => ({ title: s.title, goalTag: s.goalTag })));
  return c.json({ sessions, limit, offset, hasMore: sessions.length === limit });
});

app.post("/sessions", async (c) => {
  const body = await c.req.json();
  const parsedBody = DraftSessionSchema.safeParse(body);

  if (!parsedBody.success) {
    return c.json(error("VALIDATION_ERROR", "Invalid session draft provided", parsedBody.error.flatten()), 400);
  }

  // Risk 3: Entitlements Must Be Enforced Server-Side Early
  // Phase 6.1: Use auth helper (currently returns default user ID, ready for Clerk integration)
  const userId = await getUserId(c);
  if (!userId) {
    return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
  }
  
  // Ensure user exists (for foreign key constraint)
  // In production with Clerk, user will already exist from auth flow
  if (userId) {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `user-${userId}@clerk.dev`, // Placeholder email, will be updated from Clerk user data if available
      },
    });
  }
  
  const entitlement = await getEntitlement(userId);

  if (!entitlement.canCreateSession) {
    return c.json(error("FREE_LIMIT_REACHED", "You have reached your daily limit of free sessions."), 403);
  }

  // Duration check removed for V3 (Infinite sessions)

  // Phase 4.1: Get frequency info for this session type (only if not using solfeggio)
  const frequencyInfo = parsedBody.data.solfeggioHz ? null : getFrequencyForGoalTag(parsedBody.data.goalTag);

  // Create DB entry
  // Use relation syntax for ownerUser (Prisma prefers this over direct foreign key)
  const session = await prisma.session.create({
    data: {
      source: "user",
      ...(userId ? {
        ownerUser: {
          connect: { id: userId }
        }
      } : {}),
      title: parsedBody.data.title,
      goalTag: parsedBody.data.goalTag,
      durationSec: undefined, // Infinite
      voiceId: parsedBody.data.voiceId,
      pace: "slow", // Locked
      affirmationSpacingMs: undefined, // Fixed internally
      affirmationsHash: crypto.createHash("sha256").update(parsedBody.data.affirmations.join("|")).digest("hex"),
      frequencyHz: frequencyInfo?.frequencyHz ?? null,
      brainwaveState: frequencyInfo?.brainwaveState ?? null,
      solfeggioHz: parsedBody.data.solfeggioHz ?? null,
      // Create session affirmations
      affirmations: {
        create: parsedBody.data.affirmations.map((text: string, idx: number) => ({
          text,
          idx,
        })),
      },
    },
    include: { affirmations: true },
  });

  // Automatically trigger audio generation for "Auto-Generate" UX
  // This is an async operation, the client will poll /jobs/:id
  // Worker loop will pick up the job automatically
  // Use idempotent job creation to prevent duplicates
  let audioJobId: string | undefined;
  try {
    const { findOrCreateJobForSession } = await import("./services/jobs");
    const job = await findOrCreateJobForSession("ensure-audio", session.id, { sessionId: session.id });
    audioJobId = job.id;
  } catch (jobError) {
    // Log but don't fail the session creation if job creation fails
    console.error("[API] Failed to create audio generation job:", jobError);
    // Continue - audio can be generated later via /ensure-audio endpoint
  }

  // Return the new session (mapped to SessionV3)
  try {
    const sessionV3 = SessionV3Schema.parse({
    schemaVersion: 3,
    id: session.id,
    ownerUserId: session.ownerUserId,
    source: session.source,
    title: session.title,
    goalTag: session.goalTag ?? undefined, // Convert null to undefined for schema
    // durationSec: 0, // Removed or mapped to undefined if schema allows, but V3 Schema removed it so we omit
    affirmations: session.affirmations.map((a: { text: string }) => a.text),
    voiceId: session.voiceId,
    pace: "slow",
    // affirmationSpacingMs: 0, // Removed
    frequencyHz: session.frequencyHz ?? undefined,
    brainwaveState: session.brainwaveState ?? undefined,
    solfeggioHz: session.solfeggioHz ?? undefined,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    audio: undefined // Not fully ready yet usually
    });
    
    // Include jobId in response if audio generation was triggered
    const response = sessionV3 as any;
    if (audioJobId) {
      response._audioJobId = audioJobId; // Include for frontend polling
    }
    
    return c.json(response, 201); // 201 Created
  } catch (parseError) {
    console.error("[API] Failed to parse SessionV3:", parseError);
    return c.json(error("INTERNAL_ERROR", "Failed to serialize session response", parseError), 500);
  }
});

app.get("/sessions/:id", async (c) => {
  const parsed = uuidParam.safeParse({ id: c.req.param("id") });
  if (!parsed.success) return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID", parsed.error.flatten()), 400);

  const session = await prisma.session.findUnique({
    where: { id: parsed.data.id },
    include: { affirmations: { orderBy: { idx: "asc" } }, audio: { include: { mergedAudioAsset: true } } },
  });

  if (!session) return c.json(error("NOT_FOUND", "Session not found"), 404);

  const userId = await getUserId(c);
  if (!canAccessSession(session, userId)) {
    return c.json(error("NOT_FOUND", "Session not found"), 404);
  }

  // Construct affirmations URL if audio exists (same logic as playback-bundle endpoint)
  let affirmationsMergedUrl: string | undefined;
  if (session.audio?.mergedAudioAsset?.url) {
    const filePath = session.audio.mergedAudioAsset.url;
    
    // If URL is already an S3/CloudFront URL (starts with http/https), use it directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      affirmationsMergedUrl = filePath;
    } else {
      // Local file path - construct URL for local serving
      const apiBaseUrl = getApiBaseUrl(c);
      
      let affirmationsUrlRelative: string;
      if (path.isAbsolute(filePath)) {
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
        affirmationsUrlRelative = relativePath.startsWith("storage/") 
          ? `/${relativePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${relativePath}`;
      } else {
        affirmationsUrlRelative = filePath.startsWith("storage/") 
          ? `/${filePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${filePath}`;
      }
      
      affirmationsMergedUrl = affirmationsUrlRelative.startsWith("http") 
        ? affirmationsUrlRelative 
        : `${apiBaseUrl}${affirmationsUrlRelative}`;
    }
  }

  // Map to strict SessionV3 (V3 compliance: no durationSec, pace is always "slow", no affirmationSpacingMs)
  try {
    const sessionV3 = SessionV3Schema.parse({
      schemaVersion: 3,
      id: session.id,
      ownerUserId: session.ownerUserId,
      source: session.source as "catalog" | "user" | "generated",
      title: session.title,
      goalTag: session.goalTag ?? undefined,
      // durationSec removed in V3 (infinite sessions)
      affirmations: session.affirmations.map(a => a.text),
      voiceId: session.voiceId,
      pace: "slow", // V3: pace is always "slow"
      // affirmationSpacingMs removed in V3 (fixed internally)
      frequencyHz: session.frequencyHz ?? undefined, // Phase 4.1: Frequency transparency
      brainwaveState: session.brainwaveState ?? undefined, // Phase 4.1: Brainwave state
      solfeggioHz: session.solfeggioHz ?? undefined, // Solfeggio frequency (alternative to binaural)
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      audio: session.audio?.mergedAudioAsset && affirmationsMergedUrl ? {
        affirmationsMergedUrl,
        affirmationsHash: session.audio.mergedAudioAsset.hash,
        generatedAt: session.audio.generatedAt.toISOString(),
      } : undefined
    });
    
    return c.json(sessionV3);
  } catch (parseError) {
    console.error("[API] Failed to parse SessionV3:", parseError);
    return c.json(error("INTERNAL_ERROR", "Failed to serialize session response", parseError), 500);
  }
});

// ---- ensure-audio (Job Trigger) ----
app.post("/sessions/:id/ensure-audio", async (c) => {
  const parsed = uuidParam.safeParse({ id: c.req.param("id") });
  if (!parsed.success) return c.json(error("INVALID_SESSION_ID", "Invalid UUID"), 400);

  const session = await prisma.session.findUnique({ where: { id: parsed.data.id } });
  if (!session) return c.json(error("NOT_FOUND", "Session not found"), 404);

  const userId = await getUserId(c);
  if (!canAccessSession(session, userId)) {
    return c.json(error("NOT_FOUND", "Session not found"), 404);
  }

  // Check if audio already exists?
  const existing = await prisma.sessionAudio.findUnique({ where: { sessionId: parsed.data.id } });
  if (existing) return c.json({ status: "ready" });

  // Use idempotent job creation - returns existing job if one is already pending/processing
  const { findOrCreateJobForSession } = await import("./services/jobs");
  const job = await findOrCreateJobForSession("ensure-audio", parsed.data.id, { sessionId: parsed.data.id });

  return c.json({ status: "pending", jobId: job.id });
});

// ---- jobs status ----
app.get("/jobs/:id", async (c) => {
  const { getJob } = await import("./services/jobs");
  const job = await getJob(c.req.param("id"));
  if (!job) return c.json(error("NOT_FOUND", "Job not found"), 404);

  try {
    const payload = JSON.parse(job.payload);
    if (payload?.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
      if (!session) return c.json(error("NOT_FOUND", "Job not found"), 404);
      const userId = await getUserId(c);
      if (!canAccessSession(session, userId)) {
        return c.json(error("NOT_FOUND", "Job not found"), 404);
      }
    }
  } catch {
    // If payload can't be parsed, return job anyway (legacy/malformed payload)
  }
  return c.json({ job });
});

// ---- playback bundle ----
app.get("/sessions/:id/playback-bundle", async (c) => {
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID", parsed.error.flatten()), 400);

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.id },
      include: { audio: { include: { mergedAudioAsset: true } } }
    });

    if (!session) return c.json(error("NOT_FOUND", "Session not found"), 404);

    const userId = await getUserId(c);
    if (!canAccessSession(session, userId)) {
      return c.json(error("NOT_FOUND", "Session not found"), 404);
    }

    if (!session.audio) {
      return c.json(error("AUDIO_NOT_READY", "Audio not generated", { sessionId: session.id }), 404);
      // Client should see this error and call ensure-audio
    }

    // V3 Compliance: Resolve real binaural/background assets
    // Use request host to construct URLs that work for physical devices
    const apiBaseUrl = getApiBaseUrl(c);
    
    const { getBinauralAsset, getBackgroundAsset, getSolfeggioAsset } = await import("./services/audio/assets");
    
    // Get real asset URLs (platform-aware) with error handling
    // Pass apiBaseUrl as argument instead of mutating process.env
    let binaural;
    let solfeggio;
    let background;
    
    // Check if session uses solfeggio or binaural
    if (session.solfeggioHz) {
      // Session uses solfeggio
      try {
        solfeggio = await getSolfeggioAsset(session.solfeggioHz, apiBaseUrl);
      } catch (solfeggioError: any) {
        console.error("[API] Failed to get solfeggio asset:", solfeggioError);
        return c.json(error("ASSET_ERROR", `Solfeggio asset not available: ${solfeggioError.message}`, solfeggioError), 500);
      }
    } else {
      // Session uses binaural (default behavior)
      // Phase 4.1: Use session's frequencyHz and brainwaveState if available, otherwise default to 10Hz Alpha
      const binauralHz = session.frequencyHz ?? 10;
      const brainwaveState = session.brainwaveState as "Delta" | "Theta" | "Alpha" | "SMR" | "Beta" | undefined;
      try {
        binaural = await getBinauralAsset(binauralHz, apiBaseUrl, brainwaveState);
      } catch (binauralError: any) {
        console.error("[API] Failed to get binaural asset:", binauralError);
        return c.json(error("ASSET_ERROR", `Binaural asset not available: ${binauralError.message}`, binauralError), 500);
      }
    }
    
    try {
      background = await getBackgroundAsset(undefined, apiBaseUrl); // Default background
    } catch (backgroundError: any) {
      console.error("[API] Failed to get background asset:", backgroundError);
      return c.json(error("ASSET_ERROR", `Background asset not available: ${backgroundError.message}`, backgroundError), 500);
    }
    
    // Construct affirmations URL
    if (!session.audio.mergedAudioAsset?.url) {
      return c.json(error("ASSET_ERROR", "Merged audio asset URL not found"), 500);
    }
    
    const filePath = session.audio.mergedAudioAsset.url;
    let affirmationsUrl: string;
    
    // If URL is already an S3/CloudFront URL (starts with http/https), use it directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      affirmationsUrl = filePath;
    } else {
      // Local file path - construct URL for local serving
      // File path is relative to apps/api, e.g., "storage/merged/file.mp3"
      // Static server serves /storage/* from apps/api/, so we need to construct the URL correctly
      let affirmationsUrlRelative: string;
      
      // If path is absolute, make it relative to process.cwd() (apps/api)
      if (path.isAbsolute(filePath)) {
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
        // If relative path already starts with "storage", use it directly
        affirmationsUrlRelative = relativePath.startsWith("storage/") 
          ? `/${relativePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${relativePath}`;
      } else {
        // Path is already relative, ensure it starts with /storage/
        affirmationsUrlRelative = filePath.startsWith("storage/") 
          ? `/${filePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${filePath}`;
      }
      
      // Convert to absolute URL using request host (works for localhost, IP addresses, etc.)
      affirmationsUrl = affirmationsUrlRelative.startsWith("http") 
        ? affirmationsUrlRelative 
        : `${apiBaseUrl}${affirmationsUrlRelative}`;
    }

    // Parse loudness and voiceActivity from metaJson if available
    let loudness: { affirmationsLUFS?: number; backgroundLUFS?: number; binauralLUFS?: number; solfeggioLUFS?: number } | undefined;
    let voiceActivity: { segments: Array<{ startMs: number; endMs: number }>; thresholdDb?: number; minSilenceMs?: number } | undefined;
    
    if (session.audio.mergedAudioAsset?.metaJson) {
      try {
        const meta = JSON.parse(session.audio.mergedAudioAsset.metaJson);
        if (meta.loudness) {
          loudness = {
            affirmationsLUFS: meta.loudness.input_i,
            // Background and binaural loudness will be measured separately
            // For now, we only measure affirmations during generation
          };
        }
        if (meta.voiceActivity && meta.voiceActivity.segments) {
          voiceActivity = {
            segments: meta.voiceActivity.segments.map((seg: any) => ({
              startMs: Math.round(seg.startMs),
              endMs: Math.round(seg.endMs),
            })),
            thresholdDb: meta.voiceActivity.thresholdDb,
            minSilenceMs: meta.voiceActivity.minSilenceMs,
          };
        }
      } catch (e) {
        console.warn("[API] Failed to parse metaJson:", e);
      }
    }

    try {
      // Determine mix levels based on whether we're using binaural or solfeggio
      const brainLayerVolume = binaural ? 0.05 : (solfeggio ? 0.05 : 0); // 5% for either brain layer
      const bundle = PlaybackBundleVMSchema.parse({
        sessionId: session.id,
        affirmationsMergedUrl: affirmationsUrl,
        background,
        ...(binaural ? { binaural } : {}),
        ...(solfeggio ? { solfeggio } : {}),
        mix: { affirmations: 1, binaural: brainLayerVolume, background: 0.3 }, // Mix schema still uses binaural field name for volume
        effectiveAffirmationSpacingMs: session.affirmationSpacingMs ?? 3000, // Default to 3s if null
        loudness, // Include loudness measurements if available
        voiceActivity, // Include voice activity segments for ducking
      });

      return c.json({ bundle });
    } catch (parseError: any) {
      console.error("[API] Failed to parse PlaybackBundleVM:", parseError);
      return c.json(error("VALIDATION_ERROR", "Failed to construct playback bundle", parseError), 500);
    }
  } catch (err: any) {
    console.error("[API] Unexpected error in playback-bundle:", err);
    return c.json(error("INTERNAL_ERROR", "Internal server error", err.message), 500);
  }
});

// ---- V4 ROUTES ----

// POST /v4/chat/turn - Process a chat turn and optionally return plan preview
app.post("/v4/chat/turn", async (c) => {
  try {
    const body = await c.req.json();
    const parsedBody = ChatTurnV4Schema.safeParse(body);
    
    if (!parsedBody.success) {
      return c.json(error("VALIDATION_ERROR", "Invalid chat turn request", parsedBody.error.flatten()), 400);
    }

    const userId = await getUserId(c);
    
    const rate = checkRateLimit(`chat:${userId || "anon"}`, 60_000, 10);
    if (!rate.allowed) {
      return c.json(
        error("RATE_LIMITED", "Too many requests. Please wait and try again.", {
          resetAt: rate.resetAt,
        }),
        429
      );
    }

    const response = await processChatTurn(userId, parsedBody.data);
    
    return c.json(response);
  } catch (err: unknown) {
    console.error("[API] Error processing chat turn:", err);
    
    // P0.6: Use error handling service for user-friendly messages
    const { handleV4Error } = await import("./services/v4-errors");
    const v4Error = handleV4Error(err, "chat_turn");
    
    // Map V4 error codes to ApiErrorCode
    const apiErrorCode = (v4Error.code === "NETWORK_ERROR" || v4Error.code === "GENERATION_ERROR")
      ? v4Error.code as ApiError["code"]
      : "INTERNAL_ERROR";
    
    if (v4Error.code === "NETWORK_ERROR" || v4Error.code === "GENERATION_ERROR") {
      return c.json(error(apiErrorCode, v4Error.userMessage, {
        recoveryActions: v4Error.recoveryActions,
      }), 500);
    }
    
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage === "Thread not found" || errorMessage === "Unauthorized") {
      return c.json(error("NOT_FOUND", errorMessage), 404);
    }
    
    return c.json(
      error(apiErrorCode, v4Error.userMessage, {
        recoveryActions: v4Error.recoveryActions,
      }),
      500
    );
  }
});

// POST /v4/plans/reroll - Regenerate affirmations for a plan draft
app.post("/v4/plans/reroll", async (c) => {
  try {
    const body = await c.req.json();
    const planDraftId = body.planDraftId;

    if (!planDraftId || typeof planDraftId !== "string") {
      return c.json(error("VALIDATION_ERROR", "planDraftId is required"), 400);
    }

    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const updated = await rerollPlanDraft(userId, planDraftId);
    const affirmations = JSON.parse(updated.affirmations) as string[];

    // Get entitlement for rerolls remaining
    const { getEntitlementV4 } = await import("./services/v4-entitlements");
    const { hasRemainingRerolls } = await import("./services/v4-usage");
    const entitlement = await getEntitlementV4(userId);
    const rerollLimit = entitlement.plan === "free" ? 2 : -1; // -1 = unlimited
    const rerollsRemaining = rerollLimit === -1 
      ? "unlimited" 
      : await hasRemainingRerolls(userId, rerollLimit, planDraftId);

    return c.json({
      planDraft: {
        id: updated.id,
        title: updated.intentSummary || "Your Plan",
        affirmations,
        rerollsRemaining,
      },
    });
  } catch (err: unknown) {
    console.error("[API] Error rerolling plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    if (errorMessage === "REROLL_LIMIT_REACHED") {
      return c.json(error("REROLL_LIMIT_REACHED", "You have reached your reroll limit for today."), 403);
    }
    
    if (errorMessage === "Authentication required") {
      return c.json(error("UNAUTHORIZED", errorMessage), 401);
    }
    
    if (errorMessage === "Plan draft not found" || errorMessage === "Unauthorized") {
      return c.json(error("NOT_FOUND", errorMessage), 404);
    }
    
    return c.json(
      error("INTERNAL_ERROR", "Failed to reroll plan", errorMessage),
      500
    );
  }
});

// PATCH /v4/plans/draft/:planDraftId - Update a plan draft (edit affirmations or count)
app.patch("/v4/plans/draft/:planDraftId", async (c) => {
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("planDraftId") });
    if (!parsed.success) {
      return c.json(error("INVALID_PLAN_DRAFT_ID", "Plan draft id must be a UUID", parsed.error.flatten()), 400);
    }

    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const body = await c.req.json();
    const { updatePlanDraft } = await import("./services/v4-edit");

    const result = await updatePlanDraft(userId, parsed.data.id, {
      affirmations: body.affirmations,
      affirmationCount: body.affirmationCount,
      title: body.title,
    });

    return c.json(result, 200);
  } catch (err: unknown) {
    console.error("[API] Error updating plan draft:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    if (errorMessage === "AFFIRMATION_COUNT_NOT_ALLOWED") {
      return c.json(error("AFFIRMATION_COUNT_NOT_ALLOWED", "This affirmation count isn't available on your plan."), 403);
    }
    
    if (errorMessage === "Authentication required") {
      return c.json(error("UNAUTHORIZED", errorMessage), 401);
    }
    
    if (errorMessage === "Plan draft not found" || errorMessage === "Unauthorized") {
      return c.json(error("NOT_FOUND", errorMessage), 404);
    }
    
    return c.json(
      error("INTERNAL_ERROR", "Failed to update plan. Please try again.", errorMessage),
      500
    );
  }
});

// POST /v4/plans/commit - Commit a plan draft and create actual plan
app.post("/v4/plans/commit", async (c) => {
  try {
    const body = await c.req.json();
    const parsedBody = PlanCommitV4Schema.safeParse(body);
    
    if (!parsedBody.success) {
      return c.json(error("VALIDATION_ERROR", "Invalid plan commit request", parsedBody.error.flatten()), 400);
    }

    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const response = await commitPlan(userId, parsedBody.data);
    
    return c.json(response, 201);
  } catch (err: unknown) {
    console.error("[API] Error committing plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // P0.6: Handle entitlement errors with user-friendly messages
    if (errorMessage === "FREE_LIMIT_REACHED") {
      return c.json(error("FREE_LIMIT_REACHED", "You've used your free plan for today. Browse premade plans or upgrade for unlimited."), 403);
    }
    
    if (errorMessage === "AFFIRMATION_COUNT_NOT_ALLOWED") {
      return c.json(error("AFFIRMATION_COUNT_NOT_ALLOWED", "This affirmation count isn't available on your plan. Let's use 6 affirmations instead."), 403);
    }
    
    if (errorMessage === "VOICE_NOT_ALLOWED") {
      return c.json(error("VOICE_NOT_ALLOWED", "This voice option isn't available on your plan. Let's use the default voice."), 403);
    }
    
    if (errorMessage === "Authentication required") {
      return c.json(error("UNAUTHORIZED", errorMessage), 401);
    }
    
    if (errorMessage === "Plan draft not found" || errorMessage === "Unauthorized") {
      return c.json(error("NOT_FOUND", errorMessage), 404);
    }
    
    // P0.6: Never show raw errors - provide calm recovery message
    return c.json(
      error("INTERNAL_ERROR", "Something unexpected happened. Let's try again or browse premade plans.", {
        recoveryActions: ["retry", "use_premade"],
      }),
      500
    );
  }
});

// GET /v4/plans/:id - Get a plan by ID
app.get("/v4/plans/:id", async (c) => {
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_PLAN_ID", "Plan id must be a UUID", parsed.error.flatten()), 400);
    }

    // Get Plan from database
    const userId = await getUserId(c);
    const plan = await prisma.plan.findUnique({
      where: { id: parsed.data.id },
      include: {
        saves: userId
          ? {
              where: { userId },
            }
          : true,
      },
    });

    if (!plan) {
      return c.json(error("NOT_FOUND", "Plan not found"), 404);
    }

    if (plan.userId && plan.userId !== userId) {
      return c.json(error("NOT_FOUND", "Plan not found"), 404);
    }

    const affirmations = JSON.parse(plan.affirmations) as string[];
    const voiceConfig = JSON.parse(plan.voiceConfig || "{}") as { voiceId?: string; pace?: string };
    const audioConfig = JSON.parse(plan.audioConfig || "{}") as {
      brainTrackMode?: string;
      brainTrackId?: string;
      backgroundId?: string;
    };

    // Map Plan to PlanV4 format
    const planV4 = {
      schemaVersion: 4 as const,
      id: plan.id,
      threadId: undefined,
      ownerUserId: plan.userId,
      source: plan.source as "generated" | "premade" | "saved",
      title: plan.title,
      intent: plan.intentSummary ?? undefined,
      affirmations,
      affirmationCount: plan.affirmationCount,
      voiceId: voiceConfig.voiceId || "male",
      brainTrackMode: (audioConfig.brainTrackMode as "binaural" | "solfeggio" | "none") || "none",
      binauralHz: audioConfig.brainTrackMode === "binaural" && audioConfig.brainTrackId
        ? parseFloat(audioConfig.brainTrackId)
        : undefined,
      binauralState: undefined, // Could be stored in audioConfig
      solfeggioHz: audioConfig.brainTrackMode === "solfeggio" && audioConfig.brainTrackId
        ? parseFloat(audioConfig.brainTrackId)
        : undefined,
      backgroundId: audioConfig.backgroundId ?? undefined,
      isSaved: plan.saves.length > 0,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      audio: undefined, // Will be available via playback-bundle endpoint
    };

    return c.json(planV4);
  } catch (err: unknown) {
    console.error("[API] Error fetching plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch plan", errorMessage),
      500
    );
  }
});

// GET /v4/plans/:planId/playback-bundle - Get playback bundle with fallback ladder
app.get("/v4/plans/:planId/playback-bundle", async (c) => {
  const bundleFetchedAt = new Date(); // P1-10.1: Track bundle fetch time for metrics
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("planId") });
    if (!parsed.success) {
      return c.json(error("INVALID_PLAN_ID", "Plan id must be a UUID", parsed.error.flatten()), 400);
    }

    const userId = await getUserId(c);
    const apiBaseUrl = getApiBaseUrl(c);

    const bundle = await getPlaybackBundleV4(userId, parsed.data.id, apiBaseUrl);

    // P1-10.1: Include bundle fetch time in response for client to track time to first playback
    return c.json({ bundle, bundleFetchedAt: bundleFetchedAt.toISOString() });
  } catch (err: unknown) {
    console.error("[API] Error fetching playback bundle:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // P1-10.1: Track playback errors
    const userId = await getUserId(c);
    if (userId) {
      const { recordPlaybackError } = await import("./services/v4-metrics");
      await recordPlaybackError(
        c.req.param("planId"),
        "", // sessionId not available on error
        userId,
        "unknown",
        errorMessage
      );
    }
    
    if (errorMessage === "Plan not found" || errorMessage === "Unauthorized") {
      return c.json(error("NOT_FOUND", errorMessage), 404);
    }

    // P0.6: Never show raw errors - provide fallback
    return c.json(
      error("PLAYBACK_ERROR", "Unable to prepare playback. Please try a premade plan or try again later.", {
        fallbackAvailable: true,
      }),
      500
    );
  }
});

// GET /v4/library/premade - Get premade plans
app.get("/v4/library/premade", async (c) => {
  try {
    const userId = await getUserId(c);
    const rawLimit = Number(c.req.query("limit") ?? DEFAULT_PAGE_LIMIT);
    const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);
    const cursor = c.req.query("cursor"); // ISO datetime string for cursor-based pagination

    // P1.4.1: Cursor-based pagination for stable ordering
    const where: any = { source: "catalog" };
    if (cursor) {
      try {
        const cursorDate = new Date(cursor);
        where.createdAt = { lt: cursorDate };
      } catch {
        // Invalid cursor - ignore and return first page
      }
    }

    // Get catalog sessions (premade plans) with cursor pagination
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { affirmations: { orderBy: { idx: "asc" } } },
      take: limit + 1, // Fetch one extra to determine if there's a next page
    });

    // Determine if there are more results
    const hasMore = sessions.length > limit;
    const results = hasMore ? sessions.slice(0, limit) : sessions;

    // Get next cursor (createdAt of the last item)
    const lastItem = results.length > 0 ? results[results.length - 1] : null;
    const nextCursor = hasMore && lastItem
      ? lastItem.createdAt.toISOString()
      : null;

    // P1.4.2: Check which plans are saved (if user is authenticated and paid)
    // When a premade Session is saved, a Plan is created and Session.planId links to it
    const savedPlanIds = userId
      ? await prisma.planSave
          .findMany({
            where: { userId },
            select: { planId: true },
          })
          .then(saves => new Set(saves.map(s => s.planId)))
      : new Set<string>();

    // Map to PlanV4 format
    const plans = results.map(session => {
      // P1.4.2: Check if this Session has a Plan (via planId) that is saved
      // When saving a premade Session, a Plan is created and Session.planId points to it
      const isSaved = session.planId ? savedPlanIds.has(session.planId) : false;
      
      return {
        schemaVersion: 4 as const,
        id: session.id,
        threadId: undefined,
        ownerUserId: null,
        source: "catalog" as const,
        title: session.title,
        intent: session.goalTag ?? undefined,
        affirmations: session.affirmations.map(a => a.text),
        affirmationCount: session.affirmations.length,
        voiceId: session.voiceId,
        brainTrackMode: session.solfeggioHz ? "solfeggio" : (session.frequencyHz ? "binaural" : "none" as const),
        binauralHz: session.frequencyHz ?? undefined,
        binauralState: session.brainwaveState as "Delta" | "Theta" | "Alpha" | "SMR" | "Beta" | undefined,
        solfeggioHz: session.solfeggioHz ?? undefined,
        backgroundId: undefined,
        isSaved, // P1.4.2: Check if Plan linked to this Session is saved
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        audio: undefined,
      };
    });

    return c.json({ plans, limit, cursor: nextCursor, hasMore });
  } catch (err: unknown) {
    console.error("[API] Error fetching premade plans:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch premade plans", errorMessage),
      500
    );
  }
});

// GET /v4/library/saved - Get saved plans (paid only)
app.get("/v4/library/saved", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    // P1.2: Check entitlements using V4 service
    const { enforceEntitlement } = await import("./services/v4-entitlements");
    const entitlementError = await enforceEntitlement(userId, { type: "SAVE_PLAN" });
    if (entitlementError) {
      return c.json(error("FORBIDDEN", "Saved plans are only available for paid users"), 403);
    }

    const rawLimit = Number(c.req.query("limit") ?? DEFAULT_PAGE_LIMIT);
    const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

    // P1.2: Get saved plans from PlanSave table
    const savedPlans = await prisma.planSave.findMany({
      where: { userId },
      include: {
        plan: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    const plans = savedPlans.map(save => {
      const plan = save.plan;
      const affirmations = JSON.parse(plan.affirmations) as string[];
      const voiceConfig = JSON.parse(plan.voiceConfig || "{}") as { voiceId?: string; pace?: string };
      const audioConfig = JSON.parse(plan.audioConfig || "{}") as {
        brainTrackMode?: string;
        brainTrackId?: string;
        backgroundId?: string;
      };

      return {
        schemaVersion: 4 as const,
        id: plan.id,
        threadId: undefined,
        ownerUserId: plan.userId,
        source: "saved" as const,
        title: plan.title,
        intent: plan.intentSummary ?? undefined,
        affirmations,
        affirmationCount: plan.affirmationCount,
        voiceId: voiceConfig.voiceId || "male",
        brainTrackMode: (audioConfig.brainTrackMode as "binaural" | "solfeggio" | "none") || "none",
        binauralHz: audioConfig.brainTrackMode === "binaural" && audioConfig.brainTrackId
          ? parseFloat(audioConfig.brainTrackId)
          : undefined,
        binauralState: undefined,
        solfeggioHz: audioConfig.brainTrackMode === "solfeggio" && audioConfig.brainTrackId
          ? parseFloat(audioConfig.brainTrackId)
          : undefined,
        backgroundId: audioConfig.backgroundId ?? undefined,
        isSaved: true,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        audio: undefined,
      };
    });

    return c.json({ plans, limit, offset, hasMore: savedPlans.length === limit });
  } catch (err: unknown) {
    console.error("[API] Error fetching saved plans:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to fetch saved plans", errorMessage),
      500
    );
  }
});

// POST /v4/library/save/:planId - Save a plan (paid only)
app.post("/v4/library/save/:planId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const parsed = uuidParam.safeParse({ id: c.req.param("planId") });
    if (!parsed.success) {
      return c.json(error("INVALID_PLAN_ID", "Plan id must be a UUID", parsed.error.flatten()), 400);
    }

    // P1.2: Enforce save entitlement
    const { enforceEntitlement } = await import("./services/v4-entitlements");
    const { getEntitlementV4 } = await import("./services/v4-entitlements");
    const entitlement = await getEntitlementV4(userId);
    const isFreeUser = entitlement.plan === "free";
    
    const entitlementError = await enforceEntitlement(userId, { type: "SAVE_PLAN" });
    if (entitlementError) {
      // P1-10.1: Track save attempts for free users
      const { recordSaveAttempt } = await import("./services/v4-metrics");
      await recordSaveAttempt(parsed.data.id, userId, isFreeUser, false);
      
      return c.json(error("FORBIDDEN", "Saving plans is only available for paid users"), 403);
    }

    // P1.2: Check if it's a Plan or a Session (catalog)
    let plan = await prisma.plan.findUnique({
      where: { id: parsed.data.id },
    });

    // If not a Plan, check if it's a catalog Session (premade)
    if (!plan) {
      const session = await prisma.session.findUnique({
        where: { id: parsed.data.id },
        include: { affirmations: { orderBy: { idx: "asc" } } },
      });

      if (!session || session.source !== "catalog") {
        return c.json(error("NOT_FOUND", "Plan not found"), 404);
      }

      // P1-4.3: Use centralized conversion function
      const { convertSessionToPlan } = await import("./services/v4-premade");
      plan = await convertSessionToPlan(session);
    } else {
      // User can save their own plans or premade plans
      if (plan.userId && plan.userId !== userId && plan.source !== "premade") {
        return c.json(error("FORBIDDEN", "Cannot save this plan"), 403);
      }
    }

    // Save plan (unique constraint prevents duplicates)
    try {
      await prisma.planSave.create({
        data: {
          userId,
          planId: plan.id,
        },
      });

      // P1-10.1: Track successful save attempt
      const { recordSaveAttempt } = await import("./services/v4-metrics");
      await recordSaveAttempt(plan.id, userId, isFreeUser, true);

      return c.json({ success: true, planId: plan.id }, 201);
    } catch (dbError: any) {
      // Check if it's a unique constraint violation (already saved)
      if (dbError.code === "P2002") {
        // P1-10.1: Track successful save (already saved counts as success)
        const { recordSaveAttempt } = await import("./services/v4-metrics");
        await recordSaveAttempt(plan.id, userId, isFreeUser, true);
        
        return c.json({ success: true, planId: plan.id, alreadySaved: true }, 200);
      }
      throw dbError;
    }
  } catch (err: unknown) {
    console.error("[API] Error saving plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to save plan", errorMessage),
      500
    );
  }
});

// DELETE /v4/library/save/:planId - Unsave a plan (paid only)
app.delete("/v4/library/save/:planId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const parsed = uuidParam.safeParse({ id: c.req.param("planId") });
    if (!parsed.success) {
      return c.json(error("INVALID_PLAN_ID", "Plan id must be a UUID", parsed.error.flatten()), 400);
    }

    // P1.2: Enforce save entitlement
    const { enforceEntitlement } = await import("./services/v4-entitlements");
    const entitlementError = await enforceEntitlement(userId, { type: "SAVE_PLAN" });
    if (entitlementError) {
      return c.json(error("FORBIDDEN", "Unsaving plans is only available for paid users"), 403);
    }

    // P1.2: Handle both Plan IDs and Session IDs (for premade plans)
    let planIdToDelete = parsed.data.id;
    
    // If it's a Session ID, find the associated Plan
    const plan = await prisma.plan.findUnique({
      where: { id: parsed.data.id },
    });

    if (!plan) {
      // Check if it's a Session that was saved (has associated Plan via planId)
      const session = await prisma.session.findUnique({
        where: { id: parsed.data.id },
      });

      if (session?.planId) {
        planIdToDelete = session.planId;
      } else {
        // Try to find Plan created from this Session (via playbackSessions relation)
        const planFromSession = await prisma.plan.findFirst({
          where: {
            playbackSessions: {
              some: { id: parsed.data.id },
            },
            source: "premade",
          },
        });

        if (planFromSession) {
          planIdToDelete = planFromSession.id;
        }
        // If no plan found, deleteMany is idempotent so this is fine
      }
    }

    // Delete save (only if it exists) - idempotent
    await prisma.planSave.deleteMany({
      where: {
        userId,
        planId: planIdToDelete,
      },
    });

    return c.json({ success: true, planId: parsed.data.id }, 200);
  } catch (err: unknown) {
    console.error("[API] Error unsaving plan:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to unsave plan", errorMessage),
      500
    );
  }
});

// P1-9.2: Delete Endpoints + Data Wipe
// DELETE /v4/me/chat-history - Delete all chat history
app.delete("/v4/me/chat-history", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    // Delete all chat messages and threads for user
    await prisma.$transaction(async (tx) => {
      // Delete all messages in user's threads
      await tx.chatMessage.deleteMany({
        where: {
          thread: {
            userId,
          },
        },
      });

      // Delete all threads
      await tx.chatThread.deleteMany({
        where: { userId },
      });
    });

    // P1-9.2: Log deletion for audit (without retaining content)
    console.log(`[API] User ${userId} deleted chat history at ${new Date().toISOString()}`);

    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    console.error("[API] Error deleting chat history:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to delete chat history", errorMessage),
      500
    );
  }
});

// DELETE /v4/me/saved-plans - Delete all saved plans
app.delete("/v4/me/saved-plans", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    // Delete all PlanSave records for user
    await prisma.planSave.deleteMany({
      where: { userId },
    });

    // P1-9.2: Log deletion for audit
    console.log(`[API] User ${userId} deleted saved plans at ${new Date().toISOString()}`);

    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    console.error("[API] Error deleting saved plans:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to delete saved plans", errorMessage),
      500
    );
  }
});

// DELETE /v4/me/account - Delete everything (hard delete)
app.delete("/v4/me/account", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    // P1-9.2: Hard delete all user data in transaction
    await prisma.$transaction(async (tx) => {
      // Delete chat messages
      await tx.chatMessage.deleteMany({
        where: {
          thread: {
            userId,
          },
        },
      });

      // Delete chat threads
      await tx.chatThread.deleteMany({
        where: { userId },
      });

      // Delete plan saves
      await tx.planSave.deleteMany({
        where: { userId },
      });

      // Delete plan drafts
      await tx.planDraft.deleteMany({
        where: { userId },
      });

      // Delete plans (user-owned)
      await tx.plan.deleteMany({
        where: { userId },
      });

      // Delete usage ledger entries
      await tx.usageLedger.deleteMany({
        where: { userId },
      });

      // Delete sessions (user-owned)
      await tx.session.deleteMany({
        where: { ownerUserId: userId },
      });

      // Finally, delete user account
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // P1-9.2: Log deletion for audit (without retaining content)
    console.log(`[API] User ${userId} deleted account at ${new Date().toISOString()}`);

    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    console.error("[API] Error deleting account:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return c.json(
      error("INTERNAL_ERROR", "Failed to delete account", errorMessage),
      500
    );
  }
});

// ---- ADMIN ROUTES ----
// Admin authentication
app.post("/admin/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json(error("VALIDATION_ERROR", "Email and password required"), 400);
    }

    const session = await authenticateAdmin(email, password);
    if (!session) {
      return c.json(error("UNAUTHORIZED", "Invalid credentials"), 401);
    }

    const token = createSessionToken(session);
    return c.json({ token, admin: { email: session.email, role: session.role, name: session.name } });
  } catch (err: any) {
    console.error("[API] Admin login error:", err);
    return c.json(error("INTERNAL_ERROR", "Login failed", err.message), 500);
  }
});

app.post("/admin/auth/logout", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      destroySession(token);
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json(error("INTERNAL_ERROR", "Logout failed", err.message), 500);
  }
});

// Admin dashboard stats
app.get("/admin/dashboard/stats", async (c) => {
  try {
    await requireAdminAuth(c);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      sessionCount,
      userCount,
      jobStats,
      recentJobs,
      jobs24h,
      jobs7d,
      completedJobs24h,
      failedJobs24h,
      completedJobs7d,
      failedJobs7d,
    ] = await Promise.all([
      prisma.session.count(),
      prisma.user.count(),
      prisma.job.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.job.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          error: true,
        },
      }),
      prisma.job.count({
        where: { createdAt: { gte: last24h } },
      }),
      prisma.job.count({
        where: { createdAt: { gte: last7d } },
      }),
      prisma.job.count({
        where: { status: "completed", createdAt: { gte: last24h } },
      }),
      prisma.job.count({
        where: { status: "failed", createdAt: { gte: last24h } },
      }),
      prisma.job.count({
        where: { status: "completed", createdAt: { gte: last7d } },
      }),
      prisma.job.count({
        where: { status: "failed", createdAt: { gte: last7d } },
      }),
    ]);

    const jobsByStatus = jobStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate success rates
    const successRate24h = jobs24h > 0 ? (completedJobs24h / jobs24h) * 100 : 0;
    const successRate7d = jobs7d > 0 ? (completedJobs7d / jobs7d) * 100 : 0;

    return c.json({
      sessions: { total: sessionCount },
      users: { total: userCount },
      jobs: {
        pending: jobsByStatus["pending"] || 0,
        processing: jobsByStatus["processing"] || 0,
        completed: jobsByStatus["completed"] || 0,
        failed: jobsByStatus["failed"] || 0,
      },
      recentJobs,
      metrics: {
        jobs24h,
        jobs7d,
        successRate24h: Math.round(successRate24h * 10) / 10,
        successRate7d: Math.round(successRate7d * 10) / 10,
        failedJobs24h,
        failedJobs7d,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Dashboard stats error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch stats", err.message), 500);
  }
});

// Admin sessions list
app.get("/admin/sessions", async (c) => {
  try {
    await requireAdminAuth(c);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), MAX_PAGE_LIMIT);
    const offset = (page - 1) * limit;
    const source = c.req.query("source");
    const search = c.req.query("search");
    const audioReady = c.req.query("audioReady");

    const where: any = {};
    if (source) {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { goalTag: { contains: search, mode: "insensitive" } },
      ];
    }
    if (audioReady === "true") {
      where.audio = { isNot: null };
    } else if (audioReady === "false") {
      where.audio = null;
    }
    const moderationStatus = c.req.query("moderationStatus");
    if (moderationStatus) {
      where.affirmations = {
        some: {
          moderationStatus: moderationStatus,
        },
      };
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ownerUser: { select: { id: true, email: true } },
          audio: { include: { mergedAudioAsset: true } },
          affirmations: { orderBy: { idx: "asc" } },
        },
      }),
      prisma.session.count({ where }),
    ]);

    return c.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin sessions error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch sessions", err.message), 500);
  }
});

// Admin session detail
app.get("/admin/sessions/:id", async (c) => {
  try {
    await requireAdminAuth(c);

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID"), 400);
    }

    // Try to include assets, but handle gracefully if migration hasn't run
    let session;
    try {
      session = await prisma.session.findUnique({
        where: { id: parsed.data.id },
        include: {
          ownerUser: { select: { id: true, email: true } },
          audio: {
            include: {
              mergedAudioAsset: true,
              assets: {
                orderBy: [{ kind: "asc" }, { lineIndex: "asc" }],
              },
            },
          },
          affirmations: { orderBy: { idx: "asc" } },
        },
      });
    } catch (err: any) {
      // If assets relation doesn't exist (migration not run), try without it
      if (err.message?.includes("Unknown arg `assets`") || err.message?.includes("Unknown field") || err.message?.includes("Unknown relation")) {
        session = await prisma.session.findUnique({
          where: { id: parsed.data.id },
          include: {
            ownerUser: { select: { id: true, email: true } },
            audio: {
              include: {
                mergedAudioAsset: true,
              },
            },
            affirmations: {
              orderBy: { idx: "asc" },
              select: {
                id: true,
                idx: true,
                text: true,
                moderationStatus: true,
                moderationReason: true,
                autoFlagged: true,
              },
            },
          },
        });
        // Add empty assets array to match expected structure
        if (session?.audio) {
          (session.audio as any).assets = [];
        }
      } else {
        throw err;
      }
    }

    if (!session) {
      return c.json(error("NOT_FOUND", "Session not found"), 404);
    }

    return c.json({ session });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin session detail error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch session", err.message), 500);
  }
});

// Admin session audio integrity checks
app.get("/admin/sessions/:id/audio-integrity", async (c) => {
  try {
    await requireAdminAuth(c);

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID"), 400);
    }

    // Try to get session with assets, but handle case where assets relation doesn't exist yet
    let session;
    let assets: any[] = [];
    try {
      session = await prisma.session.findUnique({
        where: { id: parsed.data.id },
        include: {
          audio: {
            include: {
              mergedAudioAsset: true,
              assets: true,
            },
          },
        },
      });
      // @ts-ignore - assets may not exist if migration hasn't run
      assets = session?.audio?.assets || [];
    } catch (err: any) {
      // If assets relation doesn't exist (migration not run), try without it
      const errMsg = err.message || String(err);
      if (errMsg.includes("Unknown arg `assets`") || errMsg.includes("Unknown field") || errMsg.includes("Unknown relation") || errMsg.includes("does not exist")) {
        try {
          session = await prisma.session.findUnique({
            where: { id: parsed.data.id },
            include: {
              audio: {
                include: {
                  mergedAudioAsset: true,
                },
              },
            },
          });
          assets = [];
        } catch (innerErr: any) {
          throw innerErr;
        }
      } else {
        throw err;
      }
    }

    if (!session || !session.audio) {
      return c.json({ checks: [] });
    }

    const checks: Array<{ name: string; status: "pass" | "fail" | "warning"; message: string; threshold?: string }> = [];

    // Check 1: Merged audio asset exists
    if (!session.audio.mergedAudioAsset) {
      checks.push({
        name: "Merged Audio Asset",
        status: "fail",
        message: "Merged audio asset not found",
      });
    } else {
      // Check if file exists (for local) or S3 key is valid
      const url = session.audio.mergedAudioAsset.url;
      if (url.startsWith("http")) {
        // S3 URL - assume valid (could add HEAD check here)
        checks.push({
          name: "Merged Audio Asset",
          status: "pass",
          message: "Merged audio asset URL present",
        });
      } else {
        // Local file - check existence
        const fs = await import("fs-extra");
        const exists = await fs.pathExists(url);
        checks.push({
          name: "Merged Audio Asset",
          status: exists ? "pass" : "fail",
          message: exists ? "Merged audio file exists" : "Merged audio file missing",
        });
      }
    }

    // Check 2: Asset inventory completeness (only if assets table exists)
    if (assets.length === 0) {
      // Check if assets relation exists by trying to access it
      // @ts-ignore - assets may not exist if migration hasn't run
      const hasAssetsRelation = 'assets' in session.audio;
      if (!hasAssetsRelation) {
        checks.push({
          name: "Asset Inventory",
          status: "warning",
          message: "Asset tracking not available (migration may not be run)",
        });
      } else {
        checks.push({
          name: "Asset Inventory",
          status: "warning",
          message: "No assets recorded for this session",
        });
      }
    } else {
      const expectedKinds = ["affirmation_line", "affirmation_stitched", "background", "binaural", "final_mix"];
      const foundKinds = new Set(assets.map((a) => a.kind));
      const missingKinds = expectedKinds.filter((k) => !foundKinds.has(k));

      if (missingKinds.length > 0) {
        checks.push({
          name: "Asset Inventory",
          status: "warning",
          message: `Missing asset types: ${missingKinds.join(", ")}`,
        });
      } else {
        checks.push({
          name: "Asset Inventory",
          status: "pass",
          message: "All expected asset types present",
        });
      }
    }

    // Check 3: Sample rate consistency
    const sampleRates = assets
      .map((a) => a.sampleRate)
      .filter((sr): sr is number => sr !== null && sr !== undefined);
    if (sampleRates.length > 0) {
      const uniqueRates = new Set(sampleRates);
      if (uniqueRates.size > 1) {
        checks.push({
          name: "Sample Rate Consistency",
          status: "warning",
          message: `Multiple sample rates found: ${Array.from(uniqueRates).join(", ")} Hz`,
          threshold: "Expected: 44100 Hz",
        });
      } else {
        const rate = sampleRates[0];
        if (rate !== 44100) {
          checks.push({
            name: "Sample Rate Consistency",
            status: "warning",
            message: `Non-standard sample rate: ${rate} Hz`,
            threshold: "Expected: 44100 Hz",
          });
        } else {
          checks.push({
            name: "Sample Rate Consistency",
            status: "pass",
            message: "All assets use 44100 Hz",
          });
        }
      }
    }

    // Check 4: File size validation
    const assetsWithSize = assets.filter((a) => a.fileSize !== null && a.fileSize !== undefined);
    const suspiciousSizes = assetsWithSize.filter((a) => (a.fileSize || 0) < 1000); // Less than 1KB is suspicious
    if (suspiciousSizes.length > 0) {
      checks.push({
        name: "File Size Validation",
        status: "warning",
        message: `${suspiciousSizes.length} asset(s) have suspiciously small file sizes`,
      });
    } else if (assetsWithSize.length > 0) {
      checks.push({
        name: "File Size Validation",
        status: "pass",
        message: "All asset file sizes look reasonable",
      });
    }

    return c.json({ checks });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin audio integrity check error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to check audio integrity", err.message), 500);
  }
});

// Admin delete session (ADMIN only)
app.delete("/admin/sessions/:id", async (c) => {
  try {
    const admin = await requireAdminRole(c, "ADMIN");

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID"), 400);
    }

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, title: true, source: true },
    });

    await prisma.session.delete({
      where: { id: parsed.data.id },
    });

    // Log to audit log
    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "session.delete",
      resourceType: "Session",
      resourceId: parsed.data.id,
      details: { sessionTitle: session?.title, sessionSource: session?.source },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin delete session error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to delete session", err.message), 500);
  }
});

// Admin rebuild audio (OPERATOR+)
app.post("/admin/sessions/:id/rebuild-audio", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID"), 400);
    }

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.id },
    });

    if (!session) {
      return c.json(error("NOT_FOUND", "Session not found"), 404);
    }

    // Create ensure-audio job
    const job = await createJob("ensure-audio", { sessionId: parsed.data.id });
    
    // Update job with sessionId
    await prisma.job.update({
      where: { id: job.id },
      data: { sessionId: parsed.data.id },
    });

    // Log to audit log
    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "session.rebuild-audio",
      resourceType: "Session",
      resourceId: parsed.data.id,
      details: { jobId: job.id, sessionTitle: session.title },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true, jobId: job.id });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin rebuild audio error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to rebuild audio", err.message), 500);
  }
});

// Admin jobs list
app.get("/admin/jobs", async (c) => {
  try {
    await requireAdminAuth(c);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), MAX_PAGE_LIMIT);
    const offset = (page - 1) * limit;
    const status = c.req.query("status");
    const type = c.req.query("type");
    const search = c.req.query("search");

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { type: { contains: search, mode: "insensitive" } },
        { error: { contains: search, mode: "insensitive" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    return c.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin jobs error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch jobs", err.message), 500);
  }
});

// Admin job detail
app.get("/admin/jobs/:id", async (c) => {
  try {
    await requireAdminAuth(c);

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_JOB_ID", "Job id must be a UUID"), 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: parsed.data.id },
    });

    if (!job) {
      return c.json(error("NOT_FOUND", "Job not found"), 404);
    }

    return c.json({ job });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin job detail error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch job", err.message), 500);
  }
});

// Admin retry job (OPERATOR+)
app.post("/admin/jobs/:id/retry", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_JOB_ID", "Job id must be a UUID"), 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: parsed.data.id },
    });

    if (!job) {
      return c.json(error("NOT_FOUND", "Job not found"), 404);
    }

    // Reset job to pending
    await prisma.job.update({
      where: { id: parsed.data.id },
      data: {
        status: "pending",
        error: null,
        attempts: { increment: 1 },
      },
    });

    // Log to audit log
    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "job.retry",
      resourceType: "Job",
      resourceId: parsed.data.id,
      details: { jobType: job.type, previousStatus: job.status },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin retry job error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to retry job", err.message), 500);
  }
});

// Admin cancel job (OPERATOR+)
app.post("/admin/jobs/:id/cancel", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_JOB_ID", "Job id must be a UUID"), 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: parsed.data.id },
    });

    if (!job) {
      return c.json(error("NOT_FOUND", "Job not found"), 404);
    }

    // Only cancel if pending or processing
    if (job.status !== "pending" && job.status !== "processing") {
      return c.json(error("INVALID_STATE", "Job cannot be cancelled in current state"), 400);
    }

    await prisma.job.update({
      where: { id: parsed.data.id },
      data: {
        status: "failed",
        error: "Cancelled by admin",
        finishedAt: new Date(),
      },
    });

    // Log to audit log
    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "job.cancel",
      resourceType: "Job",
      resourceId: parsed.data.id,
      details: { jobType: job.type, previousStatus: job.status },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin cancel job error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to cancel job", err.message), 500);
  }
});

// Admin requeue job (OPERATOR+)
app.post("/admin/jobs/:id/requeue", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_JOB_ID", "Job id must be a UUID"), 400);
    }

    const job = await prisma.job.findUnique({
      where: { id: parsed.data.id },
    });

    if (!job) {
      return c.json(error("NOT_FOUND", "Job not found"), 404);
    }

    // Create a new job with same payload
    const newJob = await prisma.job.create({
      data: {
        type: job.type,
        status: "pending",
        payload: job.payload,
        sessionId: job.sessionId || undefined,
        userId: job.userId || undefined,
      },
    });

    // Log to audit log
    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "job.requeue",
      resourceType: "Job",
      resourceId: parsed.data.id,
      details: { jobType: job.type, newJobId: newJob.id },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true, jobId: newJob.id });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin requeue job error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to requeue job", err.message), 500);
  }
});

// Admin users list
app.get("/admin/users", async (c) => {
  try {
    await requireAdminAuth(c);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), MAX_PAGE_LIMIT);
    const offset = (page - 1) * limit;
    const search = c.req.query("search");
    const plan = c.req.query("plan");

    const where: any = {};
    if (search) {
      where.email = { contains: search, mode: "insensitive" };
    }
    if (plan) {
      where.entitlementState = { plan };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          entitlementState: true,
          _count: {
            select: {
              sessions: true,
              entitlementEvents: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return c.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin users error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch users", err.message), 500);
  }
});

// Admin user detail
app.get("/admin/users/:id", async (c) => {
  try {
    await requireAdminAuth(c);

    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) {
      return c.json(error("INVALID_USER_ID", "User id must be a UUID"), 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: parsed.data.id },
      include: {
        entitlementState: true,
        _count: {
          select: {
            sessions: true,
            entitlementEvents: true,
          },
        },
      },
    });

    if (!user) {
      return c.json(error("NOT_FOUND", "User not found"), 404);
    }

    return c.json({ user });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin user detail error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch user", err.message), 500);
  }
});

// Admin audit log
app.get("/admin/audit", async (c) => {
  try {
    await requireAdminAuth(c);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), MAX_PAGE_LIMIT);
    const adminUserId = c.req.query("adminUserId");
    const action = c.req.query("action");
    const resourceType = c.req.query("resourceType");
    const resourceId = c.req.query("resourceId");
    const startDate = c.req.query("startDate") ? new Date(c.req.query("startDate")!) : undefined;
    const endDate = c.req.query("endDate") ? new Date(c.req.query("endDate")!) : undefined;

    const result = await getAuditLogs({
      page,
      limit,
      adminUserId: adminUserId || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      resourceId: resourceId || undefined,
      startDate,
      endDate,
    });

    return c.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin audit log error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch audit log", err.message), 500);
  }
});

// P1-10.1: Admin metrics endpoint
app.get("/admin/metrics", async (c) => {
  try {
    await requireAdminAuth(c);

    const startDateStr = c.req.query("startDate");
    const endDateStr = c.req.query("endDate");
    
    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const { getMetricsSummary } = await import("./services/v4-metrics");
    const metrics = await getMetricsSummary(startDate, endDate);

    return c.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      metrics,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin metrics error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch metrics", err.message), 500);
  }
});

// P1-10.2: Admin kill switches endpoint (view status)
app.get("/admin/kill-switches", async (c) => {
  try {
    await requireAdminAuth(c);

    const { getKillSwitchStatus } = await import("./services/v4-kill-switches");
    const status = getKillSwitchStatus();

    return c.json({
      killSwitches: status,
      note: "Kill switches are controlled via environment variables. Update environment and restart server to change.",
      envVars: {
        forceSilentMode: "KILL_SWITCH_FORCE_SILENT=true",
        premadeOnlyForFree: "KILL_SWITCH_PREMADE_ONLY_FREE=true",
        disabledVoices: "KILL_SWITCH_DISABLED_VOICES=voice1,voice2",
        disabledBrainTracks: "KILL_SWITCH_DISABLED_BRAIN_TRACKS=10,20,30",
        disabledBackgrounds: "KILL_SWITCH_DISABLED_BACKGROUNDS=bg1,bg2",
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin kill switches error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch kill switch status", err.message), 500);
  }
});

// Admin AI Sources
app.get("/admin/ai-sources", async (c) => {
  try {
    await requireAdminAuth(c);

    const templates = await getAISourceTemplates();
    return c.json({ templates });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    // If tables don't exist, return empty array instead of error
    if (err.message?.includes("does not exist") || err.message?.includes("Unknown model")) {
      return c.json({ templates: [] });
    }
    console.error("[API] Admin AI sources error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch AI sources", err.message), 500);
  }
});

app.get("/admin/ai-sources/:id", async (c) => {
  try {
    await requireAdminAuth(c);

    const template = await getAISourceTemplate(c.req.param("id"));
    if (!template) {
      return c.json(error("NOT_FOUND", "Template not found"), 404);
    }
    return c.json({ template });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    // If tables don't exist, return not found
    if (err.message?.includes("does not exist") || err.message?.includes("Unknown model")) {
      return c.json(error("NOT_FOUND", "AI Sources feature not available (migration may not be run)"), 404);
    }
    console.error("[API] Admin AI source detail error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch AI source", err.message), 500);
  }
});

app.post("/admin/ai-sources", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const template = await createAISourceTemplate({
      name: body.name,
      description: body.description,
    });

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "ai_source.create",
      resourceType: "AISourceTemplate",
      resourceId: template.id,
      details: { name: template.name },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ template });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin create AI source error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to create AI source", err.message), 500);
  }
});

app.post("/admin/ai-sources/:id/versions", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const version = await createAISourceVersion({
      promptTemplateId: c.req.param("id"),
      name: body.name,
      content: body.content,
      model: body.model,
      voice: body.voice,
      cachingPolicy: body.cachingPolicy,
      createdBy: admin.adminUserId,
    });

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "ai_source.version.create",
      resourceType: "AISourceVersion",
      resourceId: version.id,
      details: { templateId: c.req.param("id"), version: version.version },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ version });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin create AI source version error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to create version", err.message), 500);
  }
});

app.patch("/admin/ai-sources/versions/:id", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const version = await updateAISourceVersion(c.req.param("id"), body);

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "ai_source.version.update",
      resourceType: "AISourceVersion",
      resourceId: version.id,
      details: { changes: body },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ version });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin update AI source version error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to update version", err.message), 500);
  }
});

app.post("/admin/ai-sources/versions/:id/activate", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const rolloutPercent = body.rolloutPercent || 100;
    const version = await activateAISourceVersion(c.req.param("id"), rolloutPercent);

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: "ai_source.version.activate",
      resourceType: "AISourceVersion",
      resourceId: version.id,
      details: { rolloutPercent, templateId: version.promptTemplateId },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ version });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin activate AI source version error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to activate version", err.message), 500);
  }
});

// Admin Moderation
app.get("/admin/moderation/stats", async (c) => {
  try {
    await requireAdminAuth(c);

    const stats = await getModerationStats();
    return c.json({ stats });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin moderation stats error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch moderation stats", err.message), 500);
  }
});

app.get("/admin/moderation/flagged", async (c) => {
  try {
    await requireAdminAuth(c);

    const page = parseInt(c.req.query("page") || "1", 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), MAX_PAGE_LIMIT);

    const result = await getFlaggedSessions({ page, limit });
    return c.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }
    console.error("[API] Admin flagged sessions error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch flagged sessions", err.message), 500);
  }
});

app.post("/admin/moderation/affirmations/:id", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const action = body.action; // "approve" | "reject" | "flag" | "edit"
    const editedText = body.editedText;
    const reason = body.reason;

    if (!["approve", "reject", "flag", "edit"].includes(action)) {
      return c.json(error("INVALID_ACTION", "Action must be approve, reject, flag, or edit"), 400);
    }

    const affirmation = await moderateAffirmationAction(
      c.req.param("id"),
      action,
      admin.adminUserId,
      editedText,
      reason
    );

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: `affirmation.${action}`,
      resourceType: "SessionAffirmation",
      resourceId: affirmation.id,
      details: {
        sessionId: affirmation.sessionId,
        originalText: affirmation.originalText || affirmation.text,
        editedText: editedText,
        reason,
      },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ affirmation });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin moderate affirmation error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to moderate affirmation", err.message), 500);
  }
});

app.post("/admin/moderation/affirmations/bulk", async (c) => {
  try {
    const admin = await requireAdminRole(c, "OPERATOR");

    const body = await c.req.json();
    const affirmationIds = body.affirmationIds;
    const action = body.action; // "approve" | "reject"
    const reason = body.reason;

    if (!Array.isArray(affirmationIds) || affirmationIds.length === 0) {
      return c.json(error("INVALID_INPUT", "affirmationIds must be a non-empty array"), 400);
    }

    if (!["approve", "reject"].includes(action)) {
      return c.json(error("INVALID_ACTION", "Action must be approve or reject"), 400);
    }

    const result = await bulkModerateAffirmations(affirmationIds, action, admin.adminUserId, reason);

    await createAuditLog({
      adminUserId: admin.adminUserId,
      action: `affirmation.bulk_${action}`,
      resourceType: "SessionAffirmation",
      details: {
        count: result.count,
        affirmationIds,
        reason,
      },
      ipAddress: admin.ipAddress,
      userAgent: admin.userAgent,
    });

    return c.json({ success: true, count: result.count });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return c.json(error(err.message, "Permission denied"), err.message === "UNAUTHORIZED" ? 401 : 403);
    }
    console.error("[API] Admin bulk moderate error:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to bulk moderate", err.message), 500);
  }
});

// ===== DATA STRATEGY ENDPOINTS =====
// DATA_STRATEGY.md: Acquisition-ready data strategy implementation

// POST /v4/me/consent - Record consent toggle change
app.post("/v4/me/consent", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const body = await c.req.json();
    const { recordConsentChange } = await import("./services/data-strategy/consent-ledger");
    
    await recordConsentChange(userId, {
      toggleName: body.toggleName,
      toggleValue: body.toggleValue,
      consentCopyId: body.consentCopyId,
      consentVersionId: body.consentVersionId,
      appVersion: body.appVersion,
      locale: body.locale,
      timezoneOffsetMinutes: body.timezoneOffsetMinutes,
    });

    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    console.error("[API] Error recording consent:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to record consent"), 500);
  }
});

// GET /v4/me/consent - Get current consent state
app.get("/v4/me/consent", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const { getCurrentConsentState } = await import("./services/data-strategy/consent-ledger");
    const state = await getCurrentConsentState(userId);

    return c.json({ state }, 200);
  } catch (err: unknown) {
    console.error("[API] Error fetching consent:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to fetch consent"), 500);
  }
});

// DELETE /v4/me/memory - Clear user memory
app.delete("/v4/me/memory", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) {
      return c.json(error("UNAUTHORIZED", "Authentication required"), 401);
    }

    const { clearUserMemory } = await import("./services/data-strategy/memory-distillation");
    await clearUserMemory(userId);

    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    console.error("[API] Error clearing memory:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to clear memory"), 500);
  }
});

// GET /v4/cold-start - Get cold start recommendations
app.get("/v4/cold-start", async (c) => {
  try {
    const userId = await getUserId(c);
    const message = c.req.query("message");

    if (!message) {
      return c.json(error("VALIDATION_ERROR", "message query parameter required"), 400);
    }

    const { getColdStartRecommendation } = await import("./services/data-strategy/cold-start");
    const recommendation = await getColdStartRecommendation(userId, message);

    return c.json(recommendation, 200);
  } catch (err: unknown) {
    console.error("[API] Error getting cold start:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to get cold start recommendation"), 500);
  }
});

// GET /admin/data-strategy/ontology - Export intent ontology
app.get("/admin/data-strategy/ontology", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const version = parseInt(c.req.query("version") || "1");
    const { exportOntology } = await import("./services/data-strategy/intent-ontology");
    const ontology = await exportOntology(version);

    return c.json(ontology, 200);
  } catch (err: unknown) {
    console.error("[API] Error exporting ontology:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to export ontology"), 500);
  }
});

// GET /admin/data-strategy/efficacy-map - Get efficacy map
app.get("/admin/data-strategy/efficacy-map", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const startDate = c.req.query("startDate") ? new Date(c.req.query("startDate")!) : undefined;
    const endDate = c.req.query("endDate") ? new Date(c.req.query("endDate")!) : undefined;
    const minimumN = parseInt(c.req.query("minimumN") || "50");

    const { getEfficacyMap } = await import("./services/data-strategy/efficacy-map");
    const map = await getEfficacyMap(startDate, endDate, minimumN);

    return c.json({ map }, 200);
  } catch (err: unknown) {
    console.error("[API] Error getting efficacy map:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to get efficacy map"), 500);
  }
});

// GET /admin/data-strategy/reason-heatmap - Get reason code heatmap
app.get("/admin/data-strategy/reason-heatmap", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const startDate = c.req.query("startDate") ? new Date(c.req.query("startDate")!) : undefined;
    const endDate = c.req.query("endDate") ? new Date(c.req.query("endDate")!) : undefined;
    const minimumN = parseInt(c.req.query("minimumN") || "50");

    const { getReasonCodeHeatmap } = await import("./services/data-strategy/reason-code-heatmap");
    const heatmap = await getReasonCodeHeatmap(startDate, endDate, minimumN);

    return c.json({ heatmap }, 200);
  } catch (err: unknown) {
    console.error("[API] Error getting reason heatmap:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to get reason heatmap"), 500);
  }
});

// GET /admin/data-strategy/event-catalog - Get event schema catalog
app.get("/admin/data-strategy/event-catalog", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const { getEventCatalog } = await import("./services/data-strategy/event-catalog");
    const catalog = getEventCatalog();

    return c.json(catalog, 200);
  } catch (err: unknown) {
    console.error("[API] Error getting event catalog:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to get event catalog"), 500);
  }
});

// GET /admin/data-strategy/cold-start-rules - Export cold start rules
app.get("/admin/data-strategy/cold-start-rules", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const { exportColdStartRules } = await import("./services/data-strategy/cold-start");
    const rules = exportColdStartRules();

    return c.json(rules, 200);
  } catch (err: unknown) {
    console.error("[API] Error exporting cold start rules:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to export cold start rules"), 500);
  }
});

// GET /admin/data-strategy/reason-codes - Get reason code taxonomy
app.get("/admin/data-strategy/reason-codes", async (c) => {
  try {
    await requireAdminRole(c, "READ_ONLY");

    const { getReasonCodeTaxonomy } = await import("./services/data-strategy/reason-code-heatmap");
    const taxonomy = getReasonCodeTaxonomy();

    return c.json(taxonomy, 200);
  } catch (err: unknown) {
    console.error("[API] Error getting reason codes:", err);
    return c.json(error("INTERNAL_ERROR", "Failed to get reason codes"), 500);
  }
});

export default app;

// Bun entrypoint with static file serving (simple)
if (import.meta.main) {
  const port = getPort();
  console.log(`[api] listening on http://localhost:${port}`);
  console.log(`[api] Environment: ${config.env}`);
  console.log(`[api] Clerk configured: ${config.clerkConfigured}`);
  console.log(`[api] RevenueCat configured: ${config.revenueCatConfigured}`);
  console.log(`[api] S3 configured: ${config.s3Configured}`);
  console.log(`[api] Job worker enabled: ${config.jobWorkerEnabled}`);

  // Register job processors
  const { registerJobProcessor } = await import("./services/jobs");
  const { processEnsureAudioJob } = await import("./services/audio/generation");
  registerJobProcessor("ensure-audio", processEnsureAudioJob);

  // Start job worker loop (restart-safe, picks up pending jobs)
  if (config.jobWorkerEnabled) {
    const { startJobWorker } = await import("./services/jobs");
    await startJobWorker(2000); // Poll every 2 seconds
  }

  // Helper function to serve files with Range request support (required for iOS .m4a streaming)
  // Bun's serveStatic doesn't support Range requests, so we implement it manually
  // Also supports HEAD requests (required for iOS AVPlayer)
  const serveRangedFile = async (c: any, baseDir: string, enableCors: boolean = false) => {
    const url = new URL(c.req.url);
    const pathPrefix = url.pathname.startsWith("/storage/") ? "/storage/" : "/assets/";
    let requestPath = url.pathname.replace(pathPrefix, "");
    
    // Decode URL-encoded path segments for assets (e.g., "Babbling%20Brook.m4a" -> "Babbling Brook.m4a")
    if (pathPrefix === "/assets/") {
      requestPath = decodeURIComponent(requestPath);
    }
    
    const filePath = path.resolve(baseDir, requestPath);
    const isHead = c.req.method === "HEAD";
    
    try {
      const file = Bun.file(filePath);
      const exists = await file.exists();
      
      if (!exists) {
        if (pathPrefix === "/storage/") {
          return c.json(error("NOT_FOUND", `File not found: ${requestPath}`), 404);
        } else {
          return c.notFound();
        }
      }
      
      const stats = await file.stat();
      const fileSize = stats.size;
      const range = c.req.header("range");
      
      // Set proper Content-Type based on file extension
      if (filePath.endsWith(".m4a")) {
        c.header("Content-Type", "audio/mp4");
      } else if (filePath.endsWith(".mp3")) {
        c.header("Content-Type", "audio/mpeg");
      }
      
      // Set CORS headers for audio assets (required for mobile app)
      if (enableCors) {
        c.header("Access-Control-Allow-Origin", "*");
        c.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        c.header("Access-Control-Allow-Headers", "Range");
        c.header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
      }
      
      // Support Range requests (required for iOS AVPlayer)
      // RFC 7233 formats: bytes=start-end, bytes=start-, bytes=-suffix
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const startStr = parts[0];
        const endStr = parts[1];
        
        let start: number;
        let end: number;
        
        if (!startStr && endStr) {
          // Suffix format: bytes=-suffix (e.g., bytes=-500 for last 500 bytes)
          const suffixLength = parseInt(endStr, 10);
          if (isNaN(suffixLength) || suffixLength <= 0) {
            c.status(400);
            return c.json(error("VALIDATION_ERROR", "Invalid Range header suffix"));
          }
          start = Math.max(0, fileSize - suffixLength);
          end = fileSize - 1;
        } else if (startStr && !endStr) {
          // Prefix format: bytes=start- (from start to end of file)
          start = parseInt(startStr, 10);
          if (isNaN(start) || start < 0) {
            c.status(400);
            return c.json(error("VALIDATION_ERROR", "Invalid Range header start"));
          }
          end = fileSize - 1;
        } else if (startStr && endStr) {
          // Full range: bytes=start-end
          start = parseInt(startStr, 10);
          end = parseInt(endStr, 10);
          if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
            c.status(400);
            return c.json(error("VALIDATION_ERROR", "Invalid Range header"));
          }
        } else {
          // Both empty - invalid
          c.status(400);
          return c.json(error("VALIDATION_ERROR", "Invalid Range header"));
        }
        
        const chunkSize = end - start + 1;
        
        // Validate range
        if (start >= fileSize || end >= fileSize || start > end) {
          c.status(416); // Range Not Satisfiable
          c.header("Content-Range", `bytes */${fileSize}`);
          return c.body(null);
        }
        
        // Return 206 Partial Content with Range headers
        c.header("Content-Range", `bytes ${start}-${end}/${fileSize}`);
        c.header("Content-Length", chunkSize.toString());
        c.header("Accept-Ranges", "bytes");
        
        // For HEAD requests, return headers without body
        if (isHead) {
          return c.body(null, 206);
        }
        
        // Stream only the requested byte range without loading entire file into memory
        const slicedFile = file.slice(start, end + 1);
        const response = new Response(slicedFile, { status: 206 });
        // Copy headers from context
        c.res.headers.forEach((value: string, key: string) => {
          response.headers.set(key, value);
        });
        return response;
      } else {
        // No Range header - return full file
        c.header("Content-Length", fileSize.toString());
        c.header("Accept-Ranges", "bytes");
        
        // For HEAD requests, return headers without body
        if (isHead) {
          return c.body(null, 200);
        }
        
        // Create Response with proper headers
        const response = new Response(file);
        // Copy headers from context
        c.res.headers.forEach((value: string, key: string) => {
          response.headers.set(key, value);
        });
        return response;
      }
    } catch (err: unknown) {
      console.error(`[API] Error serving file from ${pathPrefix}:`, err);
      const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
      if (pathPrefix === "/storage/") {
        return c.json(error("INTERNAL_ERROR", "Failed to serve file", errorMessage), 500);
      } else {
        return c.text(errorMessage, 500);
      }
    }
  };
  
  // Serve /storage/* files (generated audio)
  app.on(["GET", "HEAD"], "/storage/*", (c) => 
    serveRangedFile(c, path.resolve(process.cwd(), "storage"), false)
  );
  
  // Serve /assets/* files (static audio assets)
  // Go up two levels: apps/api -> apps -> project root
  const projectRoot = path.resolve(process.cwd(), "..", "..");
  const assetsDir = fs.existsSync(path.resolve(projectRoot, "apps", "assets"))
    ? path.resolve(projectRoot, "apps", "assets")
    : path.resolve(projectRoot, "assets");
  console.log(`[api] Serving assets from: ${assetsDir}`);
  app.on(["GET", "HEAD"], "/assets/*", (c) => 
    serveRangedFile(c, assetsDir, true)
  );

  // Explicitly bind to all interfaces (0.0.0.0) to ensure accessibility from iOS simulator
  // By default Bun.serve binds to 0.0.0.0, but being explicit helps with network debugging
  Bun.serve({ 
    port, 
    hostname: '0.0.0.0', // Listen on all interfaces
    fetch: app.fetch 
  });
  
  console.log(`[api] Server accessible at:`);
  console.log(`[api]   - http://localhost:${port}`);
  console.log(`[api]   - http://127.0.0.1:${port}`);
}
