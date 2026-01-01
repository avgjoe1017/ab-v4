/**
 * V4 Plan Reroll Service
 * P0.4: Handles plan regeneration with entitlement enforcement
 */

import { prisma } from "../lib/db";
import { generateAffirmations } from "./affirmation-generator";
import { moderateAffirmation } from "./moderation";
import { enforceEntitlement } from "./v4-entitlements";
import { getDateKey, hasRemainingRerolls } from "./v4-usage";
import { recordReroll } from "./v4-metrics";
import type { PlanDraft } from "@prisma/client";

/**
 * Reroll a plan draft (regenerate affirmations)
 * GUARDRAIL: Rerolls do NOT consume daily plan limit, only reroll quota
 */
export async function rerollPlanDraft(
  userId: string | null,
  planDraftId: string
): Promise<PlanDraft> {
  if (!userId) {
    throw new Error("Authentication required");
  }

  // P0 GAP FIX: Strict ownership check
  const planDraft = await prisma.planDraft.findUnique({
    where: { id: planDraftId },
  });

  if (!planDraft) {
    throw new Error("Plan draft not found");
  }

  if (planDraft.userId !== userId) {
    throw new Error("Unauthorized: Plan draft does not belong to user");
  }

  // P1-3.2: Draft lifecycle rules - cannot reroll after commit or if abandoned
  if (planDraft.state === "committed") {
    throw new Error("Cannot reroll a plan that has already been started. Please create a new plan.");
  }

  if (planDraft.state === "abandoned") {
    throw new Error("Cannot reroll an abandoned plan. Please create a new plan.");
  }

  if (planDraft.state !== "ready") {
    throw new Error(`Cannot reroll a plan in ${planDraft.state} state. Please create a new plan.`);
  }

  // Enforce reroll entitlement
  const entitlementError = await enforceEntitlement(userId, {
    type: "REROLL",
    planDraftId,
  });

  if (entitlementError) {
    throw new Error(entitlementError);
  }

  // Generate new affirmations
  const affirmationsResult = await generateAffirmations({
    sessionType: "Meditate",
    goal: planDraft.intentSummary || "",
    count: planDraft.affirmationCount,
  });

  // Moderate affirmations
  const moderatedAffirmations: string[] = [];
  for (const aff of affirmationsResult.affirmations) {
    const moderated = await moderateAffirmation(aff);
    if (moderated.approved) {
      moderatedAffirmations.push(moderated.text);
    }
  }

  if (moderatedAffirmations.length < planDraft.affirmationCount) {
    throw new Error("Failed to generate enough moderated affirmations");
  }

  // Update plan draft and record reroll usage
  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.planDraft.update({
      where: { id: planDraftId },
      data: {
        affirmations: JSON.stringify(moderatedAffirmations),
        rerollCount: { increment: 1 },
      },
    });

    // Record reroll usage (in ledger)
    await tx.usageLedger.create({
      data: {
        userId,
        dateKey: getDateKey(),
        eventType: "REROLL",
        refId: planDraftId,
      },
    });

    return updated;
  });

  // P1-10.1: Track reroll event (check if this was a premade match)
  // Note: We can't easily determine if it was a premade match from the draft,
  // so we'll track all rerolls. This can be enhanced later with metadata.
  const isPremadeMatch = false; // TODO: Store in planDraft metadata if needed
  await recordReroll(planDraftId, userId, isPremadeMatch);

  return updated;
}
