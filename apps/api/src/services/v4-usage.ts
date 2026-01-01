/**
 * V4 Usage Ledger Service
 * P0.3: Truth source for limits (daily + rerolls + save attempts)
 */

import { prisma } from "../lib/db";

export type UsageEventType = "PLAN_COMMIT" | "REROLL" | "SAVE_ATTEMPT" | "PLAY_START" | "CAP_HIT" | "PLAYBACK_ERROR";

export interface UsageSummary {
  plansCommitted: number;
  rerollsUsed: number;
  saveAttempts: number;
  playStarts: number;
}

/**
 * Get date key in user timezone (defaults to UTC if not provided)
 * Format: YYYY-MM-DD
 * 
 * P0 GAP FIX: Properly handle timezone for daily limit resets
 * Strategy: Use device timezone offset sent with requests (clientContext.timezoneOffset)
 * Fallback to UTC if not provided (prevents confusion for users in different timezones)
 */
export function getDateKey(date: Date = new Date(), timezoneOffsetMinutes?: number): string {
  // If timezone offset is provided (in minutes from UTC), use it
  // Otherwise default to UTC (safe fallback)
  let targetDate: Date;
  
  if (timezoneOffsetMinutes !== undefined) {
    // Convert UTC time to user's local time
    // timezoneOffsetMinutes: negative for ahead of UTC (e.g., -300 for EST = UTC-5)
    const utcTime = date.getTime();
    const localTime = utcTime + (timezoneOffsetMinutes * 60 * 1000);
    targetDate = new Date(localTime);
  } else {
    // Default to UTC (prevent confusion, deterministic)
    targetDate = date;
  }
  
  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get usage summary for a user on a specific date
 */
export async function getUsageSummary(
  userId: string | null,
  dateKey?: string,
  timezoneOffsetMinutes?: number
): Promise<UsageSummary> {
  if (!userId) {
    return {
      plansCommitted: 0,
      rerollsUsed: 0,
      saveAttempts: 0,
      playStarts: 0,
    };
  }

  const targetDateKey = dateKey || getDateKey(new Date(), timezoneOffsetMinutes);

  const events = await prisma.usageLedger.findMany({
    where: {
      userId,
      dateKey: targetDateKey,
    },
  });

  return {
    plansCommitted: events.filter((e) => e.eventType === "PLAN_COMMIT").length,
    rerollsUsed: events.filter((e) => e.eventType === "REROLL").length,
    saveAttempts: events.filter((e) => e.eventType === "SAVE_ATTEMPT").length,
    playStarts: events.filter((e) => e.eventType === "PLAY_START").length,
  };
}

/**
 * Record a usage event
 * GUARDRAIL: Daily limit only counts on Start Session (PLAN_COMMIT)
 */
export async function recordUsageEvent(
  userId: string | null,
  eventType: UsageEventType,
  refId?: string,
  metadata?: Record<string, unknown>,
  timezoneOffsetMinutes?: number
): Promise<void> {
  if (!userId) {
    // Anonymous usage can be tracked separately if needed
    return;
  }

  const dateKey = getDateKey(new Date(), timezoneOffsetMinutes);

  await prisma.usageLedger.create({
    data: {
      userId,
      dateKey,
      eventType,
      refId: refId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Check if user has remaining daily plans (for Free tier)
 */
export async function hasRemainingDailyPlans(
  userId: string | null,
  dailyLimit: number,
  timezoneOffsetMinutes?: number
): Promise<boolean> {
  if (dailyLimit <= 0) return true; // Unlimited
  if (!userId) return false;

  const summary = await getUsageSummary(userId, undefined, timezoneOffsetMinutes);
  return summary.plansCommitted < dailyLimit;
}

/**
 * Check if user has remaining rerolls for today
 */
export async function hasRemainingRerolls(
  userId: string | null,
  rerollLimit: number,
  planDraftId?: string,
  timezoneOffsetMinutes?: number
): Promise<boolean> {
  if (rerollLimit <= 0) return true; // Unlimited
  if (!userId) return false;

  const dateKey = getDateKey(new Date(), timezoneOffsetMinutes);
  
  // Count rerolls for this draft or all rerolls today
  const where: any = {
    userId,
    dateKey,
    eventType: "REROLL",
  };
  
  if (planDraftId) {
    where.refId = planDraftId;
  }

  const rerollCount = await prisma.usageLedger.count({ where });
  return rerollCount < rerollLimit;
}
