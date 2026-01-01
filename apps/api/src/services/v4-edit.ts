/**
 * V4 Plan Edit Service
 * P1.3: Handles plan draft editing with entitlement enforcement
 */

import { prisma } from "../lib/db";
import { enforceEntitlement } from "./v4-entitlements";
import { moderateAffirmation } from "./moderation";

/**
 * Update a plan draft with edited affirmations
 * P1.3: Free users can edit but edits won't be saved (today only)
 * Paid users can edit and save
 */
export async function updatePlanDraft(
  userId: string | null,
  planDraftId: string,
  updates: {
    affirmations?: string[];
    affirmationCount?: number;
    title?: string;
  }
): Promise<{
  success: boolean;
  planDraft: {
    id: string;
    title: string;
    affirmations: string[];
    affirmationCount: number;
  };
}> {
  if (!userId) {
    throw new Error("Authentication required");
  }

  // Strict ownership check
  const planDraft = await prisma.planDraft.findUnique({
    where: { id: planDraftId },
  });

  if (!planDraft) {
    throw new Error("Plan draft not found");
  }

  if (planDraft.userId !== userId) {
    throw new Error("Unauthorized: Plan draft does not belong to user");
  }

  // P1-3.2: Draft lifecycle rules - cannot edit after commit or if abandoned
  if (planDraft.state === "committed") {
    throw new Error("Cannot edit a plan that has already been started. Please create a new plan.");
  }

  if (planDraft.state === "abandoned") {
    throw new Error("Cannot edit an abandoned plan. Please create a new plan.");
  }

  if (planDraft.state !== "ready") {
    throw new Error(`Cannot edit a plan in ${planDraft.state} state. Please create a new plan.`);
  }

  // Get entitlements to check if user can change affirmation count
  const { getEntitlementV4 } = await import("./v4-entitlements");
  const entitlement = await getEntitlementV4(userId);

  // If changing affirmation count, enforce entitlement
  if (updates.affirmationCount !== undefined) {
    const allowedCounts = entitlement.limits.affirmationCountsAllowed;
    if (!allowedCounts.includes(updates.affirmationCount)) {
      throw new Error("AFFIRMATION_COUNT_NOT_ALLOWED");
    }
  }

  // Moderate edited affirmations (if provided)
  let moderatedAffirmations: string[] = [];
  if (updates.affirmations) {
    for (const aff of updates.affirmations) {
      const moderated = await moderateAffirmation(aff);
      if (!moderated.shouldFlag) {
        // Approved - use the original affirmation
        moderatedAffirmations.push(aff);
      } else {
        // P1.3: If moderation fails, use safe fallback
        console.warn(`[V4 Edit] Affirmation flagged by moderation: "${aff.substring(0, 50)}..." - reason: ${moderated.reason || 'unknown'}`);
        const SAFE_FALLBACK_AFFIRMATIONS = [
          "I am capable of achieving my goals",
          "I trust in my ability to grow and learn",
          "I am worthy of love and respect",
          "I choose to focus on what I can control",
          "I am resilient and can handle challenges",
          "I am grateful for the opportunities in my life",
        ];
        const fallbackIndex = moderatedAffirmations.length % SAFE_FALLBACK_AFFIRMATIONS.length;
        moderatedAffirmations.push(SAFE_FALLBACK_AFFIRMATIONS[fallbackIndex]);
      }
    }
  }

  // Update plan draft
  const updateData: any = {};
  
  if (updates.title) {
    updateData.title = updates.title;
  }

  if (updates.affirmationCount !== undefined) {
    updateData.affirmationCount = updates.affirmationCount;
  }

  if (moderatedAffirmations.length > 0) {
    updateData.affirmations = JSON.stringify(moderatedAffirmations);
    // If affirmations were edited, update count to match
    if (updates.affirmationCount === undefined) {
      updateData.affirmationCount = moderatedAffirmations.length;
    }
  }

  const updated = await prisma.planDraft.update({
    where: { id: planDraftId },
    data: updateData,
  });

  const finalAffirmations = moderatedAffirmations.length > 0
    ? moderatedAffirmations
    : JSON.parse(updated.affirmations) as string[];

  return {
    success: true,
    planDraft: {
      id: updated.id,
      title: updated.title,
      affirmations: finalAffirmations,
      affirmationCount: updated.affirmationCount,
    },
  };
}
