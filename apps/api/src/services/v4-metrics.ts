/**
 * V4 Metrics Service
 * P1-10.1: Key Metrics Tracking
 * 
 * Tracks:
 * - Time to first playback
 * - % sessions voice_pending/silent
 * - Cap hit rate (Free users hitting 5-minute limit)
 * - Save attempts (Free users trying to save)
 * - Reroll rate and abandon after premade match
 * - Playback errors by type
 */

import { prisma } from "../lib/db";

export type PlaybackMode = "full" | "voice_pending" | "silent";
export type PlaybackErrorType = "voice_load_failed" | "background_load_failed" | "brain_load_failed" | "network_error" | "unknown";

export interface PlaybackStartEvent {
  planId: string;
  sessionId: string;
  userId: string | null;
  fallbackMode: PlaybackMode;
  bundleFetchedAt: Date;
  playbackStartedAt: Date;
  timeToFirstPlaybackMs: number;
}

export interface CapHitEvent {
  planId: string;
  sessionId: string;
  userId: string | null;
  totalPlaybackTimeMs: number;
  capMs: number;
  occurredAt: Date;
}

export interface SaveAttemptEvent {
  planId: string;
  userId: string | null;
  isFreeUser: boolean;
  succeeded: boolean;
  occurredAt: Date;
}

export interface RerollEvent {
  planDraftId: string;
  userId: string | null;
  isPremadeMatch: boolean;
  occurredAt: Date;
}

export interface PlaybackErrorEvent {
  planId: string;
  sessionId: string;
  userId: string | null;
  errorType: PlaybackErrorType;
  errorMessage: string;
  occurredAt: Date;
}

/**
 * Record playback start event (for time to first playback metric)
 */
export async function recordPlaybackStart(
  planId: string,
  sessionId: string,
  userId: string | null,
  fallbackMode: PlaybackMode,
  bundleFetchedAt: Date,
  playbackStartedAt: Date
): Promise<void> {
  const timeToFirstPlaybackMs = playbackStartedAt.getTime() - bundleFetchedAt.getTime();

  // Store in UsageLedger with metadata
  if (userId) {
    await prisma.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey: getDateKey(new Date()),
        eventType: "PLAY_START",
        refId: planId,
        metadata: JSON.stringify({
          planId,
          sessionId,
          fallbackMode,
          timeToFirstPlaybackMs,
          bundleFetchedAt: bundleFetchedAt.toISOString(),
          playbackStartedAt: playbackStartedAt.toISOString(),
        }),
      },
    });
  }

  // Also log for analytics
  console.log(`[Metrics] Playback start: planId=${planId}, userId=${userId}, fallbackMode=${fallbackMode}, timeToFirstPlayback=${timeToFirstPlaybackMs}ms`);
}

/**
 * Record cap hit event (Free users hitting 5-minute limit)
 */
export async function recordCapHit(
  planId: string,
  sessionId: string,
  userId: string | null,
  totalPlaybackTimeMs: number,
  capMs: number
): Promise<void> {
  if (userId) {
    await prisma.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey: getDateKey(new Date()),
        eventType: "CAP_HIT",
        refId: planId,
        metadata: JSON.stringify({
          planId,
          sessionId,
          totalPlaybackTimeMs,
          capMs,
          occurredAt: new Date().toISOString(),
        }),
      },
    });
  }

  console.log(`[Metrics] Cap hit: planId=${planId}, userId=${userId}, totalTime=${totalPlaybackTimeMs}ms, cap=${capMs}ms`);
}

/**
 * Record save attempt (for Free user save attempts metric)
 */
export async function recordSaveAttempt(
  planId: string,
  userId: string | null,
  isFreeUser: boolean,
  succeeded: boolean
): Promise<void> {
  if (userId) {
    await prisma.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey: getDateKey(new Date()),
        eventType: "SAVE_ATTEMPT",
        refId: planId,
        metadata: JSON.stringify({
          planId,
          isFreeUser,
          succeeded,
          occurredAt: new Date().toISOString(),
        }),
      },
    });
  }

  console.log(`[Metrics] Save attempt: planId=${planId}, userId=${userId}, isFreeUser=${isFreeUser}, succeeded=${succeeded}`);
}

/**
 * Record reroll event (for reroll rate metric)
 */
export async function recordReroll(
  planDraftId: string,
  userId: string | null,
  isPremadeMatch: boolean
): Promise<void> {
  if (userId) {
    await prisma.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey: getDateKey(new Date()),
        eventType: "REROLL",
        refId: planDraftId,
        metadata: JSON.stringify({
          planDraftId,
          isPremadeMatch,
          occurredAt: new Date().toISOString(),
        }),
      },
    });
  }

  console.log(`[Metrics] Reroll: planDraftId=${planDraftId}, userId=${userId}, isPremadeMatch=${isPremadeMatch}`);
}

/**
 * Record playback error (for error tracking by type)
 */
export async function recordPlaybackError(
  planId: string,
  sessionId: string,
  userId: string | null,
  errorType: PlaybackErrorType,
  errorMessage: string
): Promise<void> {
  if (userId) {
    await prisma.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey: getDateKey(new Date()),
        eventType: "PLAYBACK_ERROR",
        refId: planId,
        metadata: JSON.stringify({
          planId,
          sessionId,
          errorType,
          errorMessage,
          occurredAt: new Date().toISOString(),
        }),
      },
    });
  }

  console.log(`[Metrics] Playback error: planId=${planId}, userId=${userId}, errorType=${errorType}, error=${errorMessage}`);
}

/**
 * Get aggregated metrics for a date range
 */
export async function getMetricsSummary(
  startDate: Date,
  endDate: Date
): Promise<{
  timeToFirstPlayback: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    count: number;
  };
  fallbackModeDistribution: {
    full: number;
    voice_pending: number;
    silent: number;
  };
  capHitRate: {
    freeUsers: number;
    totalFreeSessions: number;
    rate: number;
  };
  saveAttempts: {
    freeUserAttempts: number;
    totalFreeUsers: number;
  };
  rerollRate: {
    totalRerolls: number;
    totalPlans: number;
    rate: number;
    premadeMatchAbandons: number;
  };
  playbackErrors: {
    byType: Record<PlaybackErrorType, number>;
    total: number;
  };
}> {
  const startDateKey = getDateKey(startDate);
  const endDateKey = getDateKey(endDate);

  // Get all relevant events
  const events = await prisma.usageLedger.findMany({
    where: {
      dateKey: {
        gte: startDateKey,
        lte: endDateKey,
      },
      eventType: {
        in: ["PLAY_START", "CAP_HIT", "SAVE_ATTEMPT", "REROLL", "PLAYBACK_ERROR"],
      },
    },
  });

  // Parse and aggregate
  const playbackStarts = events
    .filter((e) => e.eventType === "PLAY_START")
    .map((e) => {
      const meta = JSON.parse(e.metadata || "{}");
      return {
        timeToFirstPlaybackMs: meta.timeToFirstPlaybackMs as number,
        fallbackMode: meta.fallbackMode as PlaybackMode,
      };
    });

  const capHits = events.filter((e) => e.eventType === "CAP_HIT");
  const saveAttempts = events
    .filter((e) => e.eventType === "SAVE_ATTEMPT")
    .map((e) => {
      const meta = JSON.parse(e.metadata || "{}");
      return {
        isFreeUser: meta.isFreeUser as boolean,
        succeeded: meta.succeeded as boolean,
      };
    });
  const rerolls = events
    .filter((e) => e.eventType === "REROLL")
    .map((e) => {
      const meta = JSON.parse(e.metadata || "{}");
      return {
        isPremadeMatch: meta.isPremadeMatch as boolean,
      };
    });
  const playbackErrors = events
    .filter((e) => e.eventType === "PLAYBACK_ERROR")
    .map((e) => {
      const meta = JSON.parse(e.metadata || "{}");
      return {
        errorType: meta.errorType as PlaybackErrorType,
      };
    });

  // Calculate time to first playback stats
  const timeToFirstPlaybackValues = playbackStarts.map((s) => s.timeToFirstPlaybackMs).sort((a, b) => a - b);
  const avgTimeToFirstPlayback = timeToFirstPlaybackValues.length > 0
    ? timeToFirstPlaybackValues.reduce((a, b) => a + b, 0) / timeToFirstPlaybackValues.length
    : 0;
  const p50TimeToFirstPlayback = timeToFirstPlaybackValues.length > 0
    ? timeToFirstPlaybackValues[Math.floor(timeToFirstPlaybackValues.length * 0.5)]
    : 0;
  const p95TimeToFirstPlayback = timeToFirstPlaybackValues.length > 0
    ? timeToFirstPlaybackValues[Math.floor(timeToFirstPlaybackValues.length * 0.95)]
    : 0;

  // Calculate fallback mode distribution
  const fallbackModeCounts = playbackStarts.reduce(
    (acc, s) => {
      acc[s.fallbackMode] = (acc[s.fallbackMode] || 0) + 1;
      return acc;
    },
    { full: 0, voice_pending: 0, silent: 0 } as Record<PlaybackMode, number>
  );

  // Calculate cap hit rate (Free users only)
  const freeCapHits = capHits.length; // All cap hits are from Free users
  const totalFreeSessions = playbackStarts.length; // Approximate (could be more precise with entitlement check)
  const capHitRate = totalFreeSessions > 0 ? freeCapHits / totalFreeSessions : 0;

  // Calculate save attempts (Free users)
  const freeSaveAttempts = saveAttempts.filter((a) => a.isFreeUser).length;
  const uniqueFreeUsersWithSaveAttempts = new Set(
    events
      .filter((e) => e.eventType === "SAVE_ATTEMPT")
      .map((e) => {
        const meta = JSON.parse(e.metadata || "{}");
        return meta.isFreeUser ? e.userId : null;
      })
      .filter((id): id is string => id !== null)
  ).size;

  // Calculate reroll rate
  const totalRerolls = rerolls.length;
  const totalPlans = events.filter((e) => e.eventType === "PLAN_COMMIT").length;
  const rerollRate = totalPlans > 0 ? totalRerolls / totalPlans : 0;
  const premadeMatchAbandons = rerolls.filter((r) => r.isPremadeMatch).length;

  // Calculate playback errors by type
  const errorsByType = playbackErrors.reduce(
    (acc, e) => {
      acc[e.errorType] = (acc[e.errorType] || 0) + 1;
      return acc;
    },
    {
      voice_load_failed: 0,
      background_load_failed: 0,
      brain_load_failed: 0,
      network_error: 0,
      unknown: 0,
    } as Record<PlaybackErrorType, number>
  );

  return {
    timeToFirstPlayback: {
      avgMs: Math.round(avgTimeToFirstPlayback),
      p50Ms: Math.round(p50TimeToFirstPlayback),
      p95Ms: Math.round(p95TimeToFirstPlayback),
      count: timeToFirstPlaybackValues.length,
    },
    fallbackModeDistribution: {
      full: fallbackModeCounts.full,
      voice_pending: fallbackModeCounts.voice_pending,
      silent: fallbackModeCounts.silent,
    },
    capHitRate: {
      freeUsers: freeCapHits,
      totalFreeSessions,
      rate: Math.round(capHitRate * 100) / 100,
    },
    saveAttempts: {
      freeUserAttempts: freeSaveAttempts,
      totalFreeUsers: uniqueFreeUsersWithSaveAttempts,
    },
    rerollRate: {
      totalRerolls,
      totalPlans,
      rate: Math.round(rerollRate * 100) / 100,
      premadeMatchAbandons,
    },
    playbackErrors: {
      byType: errorsByType,
      total: playbackErrors.length,
    },
  };
}

/**
 * Helper: Get date key (YYYY-MM-DD)
 */
function getDateKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
