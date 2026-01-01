/**
 * V4 Entitlements Service
 * P0.2: Server-enforced entitlements with strict enforcement
 */

import { getEntitlement } from "./entitlements";
import { getUsageSummary, hasRemainingDailyPlans, hasRemainingRerolls } from "./v4-usage";
import { isDevelopment } from "../lib/config";
import type { EntitlementV4 } from "@ab/contracts";

/**
 * Get V4 entitlements with usage-derived limits
 * 
 * NOTE: In development mode, returns unlimited limits for easier testing
 */
export async function getEntitlementV4(userId: string | null): Promise<EntitlementV4> {
  const v3Ent = await getEntitlement(userId);
  const usage = await getUsageSummary(userId);

  // In development, return unlimited entitlements for easier testing
  if (isDevelopment()) {
    return {
      schemaVersion: 4,
      plan: v3Ent.plan,
      status: v3Ent.status,
      renewsAt: v3Ent.renewsAt,
      source: v3Ent.source,
      limits: {
        dailyPlans: "unlimited",
        maxSessionDurationMs: "unlimited",
        affirmationCountsAllowed: [6, 12, 18, 24],
        canSave: true,
        voicesAllowed: "all",
        canPickBrainTrack: true,
        canPickBackground: true,
        canWriteOwnAffirmations: true,
      },
      canCreatePlan: true,
      remainingPlansToday: "unlimited",
    };
  }

  const isFree = v3Ent.plan === "free";
  const dailyPlansLimit = isFree ? 1 : "unlimited";
  const rerollsLimit = isFree ? 2 : "unlimited";
  const maxSessionDurationMs = isFree ? 300000 : "unlimited"; // Free: 5 minutes (300,000ms), Paid: unlimited

  // Calculate remaining plans (only for free)
  const remainingPlansToday =
    dailyPlansLimit === "unlimited"
      ? "unlimited"
      : Math.max(0, dailyPlansLimit - usage.plansCommitted);

  return {
    schemaVersion: 4,
    plan: v3Ent.plan,
    status: v3Ent.status,
    renewsAt: v3Ent.renewsAt,
    source: v3Ent.source,
    limits: {
      dailyPlans: dailyPlansLimit,
      maxSessionDurationMs: maxSessionDurationMs,
      affirmationCountsAllowed: isFree ? [6] : [6, 12, 18, 24],
      canSave: !isFree,
      voicesAllowed: isFree ? ["male", "female"] : "all",
      canPickBrainTrack: !isFree,
      canPickBackground: !isFree,
      canWriteOwnAffirmations: !isFree,
    },
    canCreatePlan:
      dailyPlansLimit === "unlimited" || remainingPlansToday > 0,
    remainingPlansToday,
  };
}

/**
 * Enforce entitlement checks before allowing an action
 * Returns error message if action is not allowed, null if allowed
 * 
 * NOTE: In development mode, all limits are bypassed for easier testing
 */
export async function enforceEntitlement(
  userId: string | null,
  action:
    | { type: "COMMIT_PLAN"; affirmationCount?: number; voiceId?: string }
    | { type: "REROLL"; planDraftId: string }
    | { type: "SAVE_PLAN" }
    | { type: "CUSTOM_VOICE" }
    | { type: "CUSTOM_BACKGROUND" }
    | { type: "CUSTOM_BRAIN_TRACK" }
): Promise<string | null> {
  // Bypass all limits in development mode
  if (isDevelopment()) {
    return null;
  }

  const entitlement = await getEntitlementV4(userId);

  switch (action.type) {
    case "COMMIT_PLAN": {
      // Check daily plan limit
      if (entitlement.limits.dailyPlans !== "unlimited") {
        const remaining = typeof entitlement.remainingPlansToday === "number"
          ? entitlement.remainingPlansToday
          : 0;
        if (remaining <= 0) {
          return "FREE_LIMIT_REACHED";
        }
      }

      // Check affirmation count
      if (action.affirmationCount) {
        if (!entitlement.limits.affirmationCountsAllowed.includes(action.affirmationCount)) {
          return "AFFIRMATION_COUNT_NOT_ALLOWED";
        }
      }

      // Check voice selection
      if (action.voiceId && entitlement.limits.voicesAllowed !== "all") {
        const allowed = entitlement.limits.voicesAllowed as string[];
        if (!allowed.includes(action.voiceId)) {
          return "VOICE_NOT_ALLOWED";
        }
      }

      return null; // All checks passed
    }

    case "REROLL": {
      const rerollLimit =
        entitlement.plan === "free" ? 2 : "unlimited";
      const hasRerolls = await hasRemainingRerolls(
        userId,
        rerollLimit === "unlimited" ? -1 : rerollLimit,
        action.planDraftId
      );
      if (!hasRerolls) {
        return "REROLL_LIMIT_REACHED";
      }
      return null;
    }

    case "SAVE_PLAN": {
      if (!entitlement.limits.canSave) {
        return "SAVE_NOT_ALLOWED";
      }
      return null;
    }

    case "CUSTOM_VOICE":
    case "CUSTOM_BACKGROUND":
    case "CUSTOM_BRAIN_TRACK": {
      // These are paid-only features
      if (entitlement.plan === "free") {
        return "FEATURE_REQUIRES_PAID";
      }
      return null;
    }

    default:
      return "UNKNOWN_ACTION";
  }
}
