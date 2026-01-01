/**
 * V4 Chat Service
 * Handles chat turn processing, plan preview generation, and conversation flow
 * 
 * GUARDRAIL COMPLIANCE (mistakes-to-avoid-for-v4.md):
 * - #7: Daily plan limit ONLY counts on Start Session (commitPlan), NOT on preview
 * - #13: Free tier tries premade matching first before generating (cost control)
 * - Regenerates do NOT consume daily limit until Start is tapped
 */

import { prisma } from "../lib/db";
import { generateAffirmations } from "./affirmation-generator";
import { moderateAffirmation } from "./moderation";
import { classifyRisk, getValidationModeTemplates, getCrisisResources, type RiskLevel, type RiskClassification } from "./v4-risk-classifier";
import { getEntitlementV4, enforceEntitlement } from "./v4-entitlements";
import { recordUsageEvent, getUsageSummary, getDateKey } from "./v4-usage";
import { handleV4Error } from "./v4-errors";
import { isPremadeOnlyForFreeForced, isVoiceDisabled } from "./v4-kill-switches";
import { getUserId } from "../lib/auth";
import type { ChatTurnV4, ChatTurnResponseV4, PlanCommitV4, PlanCommitResponseV4 } from "@ab/contracts";
import crypto from "crypto";

export interface ChatThread {
  id: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Process a chat turn - single deterministic pipeline
 * REFACTOR: Tightened into one orchestration function with extracted helpers
 */
export async function processChatTurn(
  userId: string | null,
  turn: ChatTurnV4
): Promise<ChatTurnResponseV4> {
  return processChatTurnPipeline(userId, turn);
}

/**
 * Single deterministic pipeline for chat turn processing
 * Everything in one sequence: validate → rate limit → thread/ownership → persist user msg → risk classify → build response → persist assistant msg → return
 */
async function processChatTurnPipeline(
  userId: string | null,
  turn: ChatTurnV4
): Promise<ChatTurnResponseV4> {
  const { threadId, message, locale, clientContext } = turn;
  const timezoneOffsetMinutes = clientContext?.timezoneOffsetMinutes;

  // A) Thread: create or load, then enforce ownership
  let thread;
  if (threadId) {
    thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new Error("Thread not found");
    }
    // Strict ownership check
    if (userId && thread.userId !== userId) {
      throw new Error("Unauthorized: Thread does not belong to user");
    }
  } else {
    // Create new thread
    thread = await prisma.chatThread.create({
      data: {
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        clientDeviceId: clientContext?.platform,
        status: "active",
      },
    });
  }

  // Ensure user exists if authenticated
  if (userId) {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `user-${userId}@example.com`,
      },
    });
  }

  // B) Persist user message immediately (auditability + crash safety)
  const userMsg = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "user",
      content: message,
      safetyFlags: null,
    },
  });

  // C) Safety lane: classify risk BEFORE any generation
  const risk = classifyRisk(message);

  // D) Crisis lane: resources only (no plan draft, no chips, no upsell)
  if (risk.level === "crisis") {
    const crisisText = getCrisisResources();
    const crisisMsg = await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        role: "assistant",
        content: crisisText,
        safetyFlags: JSON.stringify(["crisis"]),
      },
    });

    return {
      threadId: thread.id,
      assistantMessages: [{
        id: crisisMsg.id,
        text: crisisText,
        timestamp: crisisMsg.createdAt.toISOString(),
      }],
      suggestedChips: [],
      planPreview: undefined,
    };
  }

  // E) Get entitlement and check preview eligibility
  const entitlement = await getEntitlementV4(userId);
  const eligibleForPreview = shouldCreatePlanPreview({
    message,
    riskLevel: risk.level,
    userTier: entitlement.plan,
  });

  // F) Build assistant reply + optional plan preview (PlanDraft)
  let assistantText = "";
  let planPreview: { planDraftId: string; title: string; affirmations: string[]; intent?: string } | undefined = undefined;

  // F1) Distress lane: validation-mode response + validation templates for preview
  if (risk.level === "distress") {
    const assistantResponse = await generateAssistantResponse(message, userId, risk);
    assistantText = assistantResponse.text;

    if (eligibleForPreview) {
      const templates = getValidationModeTemplates(message);
      const draft = await prisma.planDraft.create({
        data: {
          ...(userId ? { user: { connect: { id: userId } } } : {}),
          thread: { connect: { id: thread.id } },
          state: "ready",
          affirmations: JSON.stringify(templates),
          intentSummary: message.substring(0, 200),
          affirmationCount: templates.length,
          voiceMode: "male",
          brainTrackMode: "default",
          rerollCount: 0,
        },
      });

      planPreview = {
        planDraftId: draft.id,
        title: extractTitle(message),
        affirmations: templates,
        intent: message.substring(0, 200),
      };
    }
  }

  // F2) Normal lane: premade match (esp. Free tier), else generate
  if (risk.level === "none" || risk.level === "normal") {
    const assistantResponse = await generateAssistantResponse(message, userId, risk);
    assistantText = assistantResponse.text;

    if (eligibleForPreview) {
      const tier = entitlement.plan;
      const premadeOnlyForced = isPremadeOnlyForFreeForced();

      // Cost control path: premade-first for Free (and optionally forced premade-only)
      let premade = null;
      if (tier === "free") {
        premade = await tryMatchPremadePlan(message);
        if (premade) {
          console.log("[V4 Chat] Premade match successful", {
            userId,
            threadId: thread.id,
            matchedCluster: premade.matchedCluster,
            matchScore: premade.matchScore,
            chosenPlanId: premade.chosenPlanId,
          });
        }
      }

      if (premade) {
        const draft = await prisma.planDraft.create({
          data: {
            ...(userId ? { user: { connect: { id: userId } } } : {}),
            thread: { connect: { id: thread.id } },
            state: "ready",
            affirmations: JSON.stringify(premade.affirmations),
            intentSummary: message.substring(0, 200),
            affirmationCount: premade.affirmations.length,
            voiceMode: "male",
            brainTrackMode: "default",
            rerollCount: 0,
          },
        });

        planPreview = {
          planDraftId: draft.id,
          title: premade.title,
          affirmations: premade.affirmations,
          intent: message.substring(0, 200),
        };
      } else if (tier === "free" && premadeOnlyForced) {
        // Forced premade-only: if no match, return no preview (keeps costs safe)
        planPreview = undefined;
      } else {
        // Generation path (Paid always allowed, Free allowed if not forced premade-only)
        const generated = await generatePlanPreview({
          userId,
          message,
          threadId: thread.id,
          entitlement,
        });

        if (generated) {
          planPreview = generated;
        }
      }
    }
  }

  // G) Build suggested chips based on lane
  const suggestedChips = buildSuggestedChips({
    lane: risk.level === "crisis" ? "crisis" : risk.level === "distress" ? "distress" : "normal",
    tier: entitlement.plan,
  });

  // H) Persist assistant message last (includes safety flags)
  const assistantMsg = await prisma.chatMessage.create({
    data: {
      threadId: thread.id,
      role: "assistant",
      content: assistantText,
      safetyFlags: risk.level === "none" || risk.level === "normal" ? null : JSON.stringify([risk.level]),
    },
  });

  // I) Return contract response
  return {
    threadId: thread.id,
    assistantMessages: [{
      id: assistantMsg.id,
      text: assistantText,
      timestamp: assistantMsg.createdAt.toISOString(),
    }],
    suggestedChips,
    planPreview,
  };
}

/**
 * Commit a plan - creates the actual Plan record and enforces entitlements
 * P0.4: Now creates Plan record from PlanDraft with full enforcement
 * GUARDRAIL #7: Daily limit ONLY counts here (when user taps Start Session), NOT on preview
 */
export async function commitPlan(
  userId: string | null,
  commit: PlanCommitV4
): Promise<PlanCommitResponseV4> {
  if (!userId) {
    throw new Error("Authentication required");
  }

  // Get plan draft from database
  const planDraft = await prisma.planDraft.findUnique({
    where: { id: commit.planDraftId },
  });

  if (!planDraft) {
    throw new Error("Plan draft not found");
  }

  // P0 GAP FIX: Strict ownership check
  if (planDraft.userId !== userId) {
    throw new Error("Unauthorized: Plan draft does not belong to user");
  }

  // P0 GAP FIX: Idempotent commit - check if draft already committed using sourceDraftId
  const existingPlan = await prisma.plan.findUnique({
    where: { sourceDraftId: commit.planDraftId },
  });
  
  if (existingPlan) {
    // Already committed - return existing plan (idempotent)
    return { planId: existingPlan.id };
  }

  // P1-3.2: Draft lifecycle rules - cannot commit if already committed or abandoned
  if (planDraft.state === "committed") {
    // Should be caught by idempotency check above, but handle gracefully
    throw new Error("This plan has already been started.");
  }

  if (planDraft.state === "abandoned") {
    throw new Error("Cannot start an abandoned plan. Please create a new plan.");
  }

  if (planDraft.state !== "ready") {
    throw new Error(`Cannot start a plan in ${planDraft.state} state. Please create a new plan.`);
  }

  // Enforce entitlements before committing
  const affirmations = JSON.parse(planDraft.affirmations) as string[];
  let voiceId = commit.selections?.voiceId || planDraft.voiceMode;
  
  // P1-10.2: Check if voice is disabled by kill switch - fallback to default
  if (isVoiceDisabled(voiceId)) {
    console.warn(`[V4 Chat] Voice ${voiceId} is disabled by kill switch, falling back to default`);
    voiceId = "male"; // Default fallback
  }
  
  const affirmationCount = commit.selections?.affirmationCount || planDraft.affirmationCount;

  const entitlementError = await enforceEntitlement(userId, {
    type: "COMMIT_PLAN",
    affirmationCount,
    voiceId,
  });

  if (entitlementError) {
    throw new Error(entitlementError);
  }

  // P0 GAP FIX: Extract timezone from client context if available
  // For now, use UTC (can be extended to accept from commit request)
  const timezoneOffsetMinutes = undefined; // TODO: Add to PlanCommitV4 schema

  // Create Plan record in transaction with usage ledger entry
  const result = await prisma.$transaction(async (tx) => {
    // P0 GAP FIX: Create Plan with sourceDraftId for idempotency
    const plan = await tx.plan.create({
      data: {
        user: { connect: { id: userId } },
        source: "generated",
        sourceDraftId: planDraft.id, // Unique constraint prevents duplicate commits
        title: planDraft.intentSummary ? extractTitle(planDraft.intentSummary) : "Personal Plan",
        intentSummary: planDraft.intentSummary,
        affirmationCount,
        affirmations: JSON.stringify(affirmations),
        voiceConfig: JSON.stringify({
          voiceId,
          pace: "slow",
        }),
        audioConfig: JSON.stringify({
          brainTrackMode: commit.selections?.brainTrackMode || planDraft.brainTrackMode,
          brainTrackId: commit.selections?.binauralHz 
            ? commit.selections.binauralHz.toString()
            : commit.selections?.solfeggioHz?.toString() || planDraft.brainTrackId,
          backgroundId: commit.selections?.backgroundId || planDraft.backgroundId,
        }),
      },
    });

    // P0 GAP FIX: Record usage event with timezone-aware dateKey
    const dateKey = getDateKey(new Date(), timezoneOffsetMinutes);
    await tx.usageLedger.create({
      data: {
        user: { connect: { id: userId } },
        dateKey,
        eventType: "PLAN_COMMIT",
        refId: planDraft.id,
        metadata: JSON.stringify({ planId: plan.id }),
      },
    });

    // Update plan draft state to committed
    await tx.planDraft.update({
      where: { id: planDraft.id },
      data: { state: "committed" },
    });

    return plan;
  });

  // DATA STRATEGY: Record efficacy event and apply memory distillation
  try {
    // Map intent if not already mapped
    const { mapIntent } = await import("./data-strategy/intent-ontology");
    const intentMapping = await mapIntent(userId, planDraft.intentSummary || "", planDraft.threadId || undefined, result.id);
    
    // Record efficacy event for plan committed
    const { recordEfficacyEvent } = await import("./data-strategy/efficacy-map");
    const audioConfigJson = JSON.parse(result.audioConfig || "{}") as {
      brainTrackMode?: string;
      brainTrackId?: string;
      backgroundId?: string;
    };
    await recordEfficacyEvent({
      userId,
      planId: result.id,
      topicId: intentMapping.topicId,
      toneClass: audioConfigJson.brainTrackMode || undefined,
      intensityBand: undefined, // Can be derived from affirmations if needed
      promptVersion: undefined, // Can be tracked from AISourceVersion if needed
      generationStrategy: "chat", // V4 uses chat-first generation
      outcomeType: "completion", // Plan committed is a completion event
      outcomeValue: 1.0,
    });

    // Apply memory distillation
    const { applyMemoryDelta } = await import("./data-strategy/memory-distillation");
    const voiceConfigJson = JSON.parse(result.voiceConfig || "{}") as { voiceId?: string; pace?: string };
    await applyMemoryDelta({
      userId,
      deltaJson: {
        lastIntent: intentMapping.topicId,
        lastPlanSettings: {
          voiceId: voiceConfigJson.voiceId,
          brainTrackMode: audioConfigJson.brainTrackMode,
          backgroundId: audioConfigJson.backgroundId,
          affirmationCount: planDraft.affirmationCount,
        },
      },
      sourceEvent: "plan_committed",
      sourceEventId: result.id,
    });
  } catch (dataStrategyError) {
    // Don't fail plan commit if data strategy fails - log and continue
    console.error("[V4 Chat] Data strategy integration error:", dataStrategyError);
  }

  // Trigger audio generation job (async, don't block)
  let audioJobId: string | undefined;
  try {
    const { findOrCreateJobForSession } = await import("./jobs");
    // Create a Session for backward compatibility with audio generation
    const session = await prisma.session.create({
      data: {
        ownerUser: { connect: { id: userId } },
        source: "user",
        title: result.title,
        goalTag: result.intentSummary || undefined,
        voiceId,
        pace: "slow",
        affirmationsHash: crypto.createHash("sha256").update(affirmations.join("|")).digest("hex"),
        v4Plan: { connect: { id: result.id } }, // Link to V4 Plan
        affirmations: {
          create: affirmations.map((text, idx) => ({
            text,
            idx,
          })),
        },
      },
    });

    const job = await findOrCreateJobForSession("ensure-audio", session.id, { sessionId: session.id });
    audioJobId = job.id;
  } catch (jobError) {
    console.error("[V4 Chat] Failed to create audio generation job:", jobError);
    // Continue - audio can be generated later
  }

  return {
    planId: result.id,
    audioJobId,
  };
}

/**
 * Determine if we should create a plan preview on this turn
 * REFACTOR: Centralizes "substantial message" logic so it can't drift across lanes
 */
function shouldCreatePlanPreview({
  message,
  riskLevel,
  userTier,
}: {
  message: string;
  riskLevel: RiskLevel;
  userTier: "free" | "paid";
}): boolean {
  // Message must be substantial (more than 10 characters)
  if (message.length <= 10) {
    return false;
  }

  // Crisis and distress lanes handle preview eligibility separately
  // This function is primarily for normal lane
  if (riskLevel === "crisis") {
    return false; // Never create preview in crisis
  }

  // For distress, preview is handled separately in the pipeline
  // This function returns true for normal lane with substantial messages
  return true;
}

/**
 * Build suggested chips based on lane and tier
 * REFACTOR: Server-owned chip generation for consistency
 */
function buildSuggestedChips({
  lane,
  tier,
}: {
  lane: "crisis" | "distress" | "normal";
  tier: "free" | "paid";
}): Array<{ id: string; text: string }> {
  // Crisis lane: no chips
  if (lane === "crisis") {
    return [];
  }

  // Distress lane: gentle, supportive chips
  if (lane === "distress") {
    return [
      { id: "grounding", text: "Help me feel grounded" },
      { id: "present", text: "Stay in the present moment" },
      { id: "gentle", text: "Something gentle" },
    ];
  }

  // Normal lane: standard suggestions
  const suggestions = [
    { id: "confident-work", text: "Confidence at work" },
    { id: "calm-anxiety", text: "Calm my anxiety" },
    { id: "sleep-tonight", text: "Sleep tonight" },
    { id: "stop-overthinking", text: "Stop overthinking" },
  ];

  return suggestions;
}

/**
 * Generate a plan preview (creates PlanDraft and returns preview)
 * REFACTOR: Extracted plan generation logic into single function
 */
async function generatePlanPreview({
  userId,
  message,
  threadId,
  entitlement,
}: {
  userId: string | null;
  message: string;
  threadId: string;
  entitlement: Awaited<ReturnType<typeof getEntitlementV4>>;
}): Promise<{ planDraftId: string; title: string; affirmations: string[]; intent?: string } | undefined> {
  try {
    // Generate affirmations
    const affirmationsResult = await generateAffirmations({
      sessionType: "Meditate",
      goal: message,
      count: Array.isArray(entitlement.limits.affirmationCountsAllowed)
        ? entitlement.limits.affirmationCountsAllowed[0]
        : 6,
    });

    // Moderate affirmations
    const moderatedAffirmations: string[] = [];
    const targetCount = Array.isArray(entitlement.limits.affirmationCountsAllowed)
      ? entitlement.limits.affirmationCountsAllowed[0]
      : 6;

    const SAFE_FALLBACK_AFFIRMATIONS = [
      "I am capable of achieving my goals",
      "I trust in my ability to grow and learn",
      "I am worthy of love and respect",
      "I choose to focus on what I can control",
      "I am resilient and can handle challenges",
      "I am grateful for the opportunities in my life",
    ];

    for (const aff of affirmationsResult.affirmations) {
      const moderated = await moderateAffirmation(aff);
      if (!moderated.shouldFlag) {
        moderatedAffirmations.push(aff);
      } else {
        console.warn(`[V4 Chat] Affirmation flagged by moderation: "${aff.substring(0, 50)}..." - reason: ${moderated.reason || 'unknown'}`);
        const fallbackIndex = moderatedAffirmations.length % SAFE_FALLBACK_AFFIRMATIONS.length;
        moderatedAffirmations.push(SAFE_FALLBACK_AFFIRMATIONS[fallbackIndex]);
      }
    }

    // Ensure we have exactly the target count
    while (moderatedAffirmations.length < targetCount) {
      const fallbackIndex = moderatedAffirmations.length % SAFE_FALLBACK_AFFIRMATIONS.length;
      moderatedAffirmations.push(SAFE_FALLBACK_AFFIRMATIONS[fallbackIndex]);
    }

    if (moderatedAffirmations.length >= targetCount) {
      const draft = await prisma.planDraft.create({
        data: {
          ...(userId ? { user: { connect: { id: userId } } } : {}),
          thread: { connect: { id: threadId } },
          state: "ready",
          intentSummary: message.substring(0, 200),
          affirmationCount: moderatedAffirmations.length,
          affirmations: JSON.stringify(moderatedAffirmations),
          voiceMode: "male",
          brainTrackMode: "default",
          rerollCount: 0,
        },
      });

      return {
        planDraftId: draft.id,
        title: extractTitle(message),
        affirmations: moderatedAffirmations,
        intent: message.substring(0, 200),
      };
    }
  } catch (error) {
    console.error("[V4 Chat] Failed to generate plan preview:", error);
    // Don't break the chat - just return undefined
  }

  return undefined;
}

/**
 * Generate assistant response based on user message
 */
async function generateAssistantResponse(
  userMessage: string,
  userId: string | null,
  riskClassification?: RiskClassification
): Promise<{ text: string; shouldOfferPlan: boolean }> {
  const lower = userMessage.toLowerCase();

  // P1-8.1: Handle distress mode - validation style response, no plan generation
  if (riskClassification?.level === 'distress') {
    return {
      text: "I hear that you're going through a difficult time. It's okay to not be okay. Would you like some gentle, grounding affirmations to help you feel more present right now?",
      shouldOfferPlan: false, // P1-8.1: Don't offer plan in distress mode
    };
  }

  // Check for affirmative responses to plan offers (yes, sure, ok, please, etc.)
  const affirmativePatterns = /\b(yes|yeah|yep|sure|ok|okay|please|go ahead|let's do it|create|make|generate|do it)\b/i;
  const isAffirmativeResponse = affirmativePatterns.test(userMessage);
  
  // Simple heuristic-based responses (in production, use LLM)
  if (lower.includes("confident") || lower.includes("confidence")) {
    return {
      text: "I understand you're looking to build confidence. What situation would benefit most from feeling more confident right now?",
      shouldOfferPlan: false,
    };
  }

  if (lower.includes("anxious") || lower.includes("anxiety") || lower.includes("worried")) {
    return {
      text: "It sounds like anxiety is showing up. What's one thing that would help you feel a bit more grounded today?",
      shouldOfferPlan: false,
    };
  }

  if (lower.includes("sleep")) {
    return {
      text: "Sleep can be tricky. What's keeping you up, or what would help you rest better tonight?",
      shouldOfferPlan: false,
    };
  }

  // If user responds affirmatively, generate plan immediately
  if (isAffirmativeResponse) {
    return {
      text: "I'll create a personalized affirmation plan for you.",
      shouldOfferPlan: true,
    };
  }

  // Default: if message is substantial, offer plan directly (don't ask "would you like")
  if (userMessage.length > 20) {
    return {
      text: "I hear you. Let me create a personalized affirmation plan for this.",
      shouldOfferPlan: true,
    };
  }

  // Very short messages: ask for more info
  return {
    text: "Tell me more about what you're working through right now.",
    shouldOfferPlan: false,
  };
}

/**
 * Extract a title from user message
 */
function extractTitle(message: string): string {
  // Simple extraction - in production, use LLM or better heuristics
  const firstSentence = message.split(/[.!?]/)[0] || message.substring(0, 50);
  return firstSentence.trim().substring(0, 50) || "Personal Plan";
}


// Note: Chat message persistence would be handled by Prisma models in production
// For V4 MVP, messages are ephemeral (client-side only)

/**
 * Try to match user intent to a premade catalog plan (cost control for Free tier)
 * P0.7: Enhanced matching strategy with intent clusters
 * GUARDRAIL #13: Prefer premade matching for Free when possible
 * P0 GAP FIX: Returns instrumentation data for tracking match outcomes
 */
async function tryMatchPremadePlan(
  userMessage: string
): Promise<{ title: string; affirmations: string[]; matchedCluster: string; matchScore: number; chosenPlanId: string } | null> {
  try {
    const lower = userMessage.toLowerCase();
    
    // Intent clusters (common themes that map to premade plans)
    const intentClusters: Record<string, string[]> = {
      confidence: ["confident", "confidence", "self-esteem", "self-worth", "believe in myself"],
      anxiety: ["anxious", "anxiety", "worried", "worries", "stress", "stressed", "panic"],
      sleep: ["sleep", "sleeping", "insomnia", "rest", "restful", "tired", "exhausted"],
      focus: ["focus", "concentration", "distracted", "attention", "mindful", "present"],
      calm: ["calm", "peaceful", "relaxed", "serene", "tranquil", "centered"],
      motivation: ["motivated", "motivation", "energized", "driven", "ambitious"],
      self_love: ["self-love", "self-compassion", "love myself", "accept myself", "worthy"],
      work: ["work", "professional", "career", "job", "meeting", "presentation"],
    };

    // Detect intent cluster
    let detectedCluster: string | null = null;
    let clusterScore = 0;
    
    for (const [cluster, keywords] of Object.entries(intentClusters)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          score += 1;
        }
      }
      if (score > clusterScore) {
        clusterScore = score;
        detectedCluster = cluster;
      }
    }

    // Get catalog sessions (premade plans)
    const catalogSessions = await prisma.session.findMany({
      where: { source: "catalog" },
      include: { 
        affirmations: { 
          orderBy: { idx: "asc" },
        } 
      },
      take: 50, // Search more broadly
    });

    // Filter to 6-affirmation plans (Free tier standard)
    const sixAffirmationPlans = catalogSessions.filter(s => s.affirmations.length === 6);

    // Score plans based on intent cluster match and keyword overlap
    const scoredPlans: Array<{ session: typeof catalogSessions[0]; score: number }> = [];
    
    for (const session of sixAffirmationPlans) {
      const titleLower = session.title.toLowerCase();
      const goalTagLower = (session.goalTag || "").toLowerCase();
      const searchText = `${titleLower} ${goalTagLower}`;
      
      let score = 0;
      
      // Boost score if goalTag matches detected cluster
      if (detectedCluster && goalTagLower.includes(detectedCluster)) {
        score += 10;
      }
      
      // Boost score for keyword matches in title (stronger signal)
      for (const keyword of Object.values(intentClusters).flat()) {
        if (titleLower.includes(keyword)) {
          score += 3;
        }
        if (goalTagLower.includes(keyword)) {
          score += 2;
        }
      }
      
      // Direct word matches in user message
      const userWords = lower.split(/\s+/).filter(w => w.length > 3);
      for (const word of userWords) {
        if (searchText.includes(word)) {
          score += 1;
        }
      }
      
      if (score > 0) {
        scoredPlans.push({ session, score });
      }
    }

    // Sort by score and return best match if confidence is sufficient
    scoredPlans.sort((a, b) => b.score - a.score);
    
    // Confidence threshold: need at least 3 points to suggest a match
    const bestMatch = scoredPlans[0];
    if (bestMatch && bestMatch.score >= 3) {
      return {
        title: bestMatch.session.title,
        affirmations: bestMatch.session.affirmations.map(a => a.text),
        matchedCluster: detectedCluster || "unknown",
        matchScore: bestMatch.score,
        chosenPlanId: bestMatch.session.id,
      };
    }

    // P0 GAP FIX: Log no-match outcome for instrumentation
    console.log("[V4 Chat] Premade match failed", {
      detectedCluster,
      clusterScore,
      bestMatchScore: bestMatch?.score || 0,
      reason: bestMatch ? "below_threshold" : "no_matches",
    });

    return null;
  } catch (error) {
    console.error("[V4 Chat] Error matching premade plan:", error);
    return null; // Fail gracefully - will fall back to generation
  }
}

