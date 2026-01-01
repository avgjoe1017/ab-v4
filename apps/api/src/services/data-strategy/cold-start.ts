/**
 * Cold Start Personalization Engine
 * DATA_STRATEGY.md Section 2.4: Rules engine for first-session personalization
 * 
 * Option A: Rules Engine (recommended first)
 * Provides strong defaults in first session without requiring deep history.
 */

import { getUserMemory } from "./memory-distillation";
import { mapIntent } from "./intent-ontology";
import { prisma } from "../../lib/db";

export interface ColdStartRecommendation {
  topicId: string;
  toneClass: string;
  intensityBand: string;
  voiceId: string;
  brainTrackMode: string;
  backgroundId?: string;
  affirmationCount: number;
  confidence: number;
  reasoning: string[];
}

/**
 * Get cold start recommendations for a user
 * Uses rules engine to provide strong defaults without requiring history
 */
export async function getColdStartRecommendation(
  userId: string | null,
  userMessage: string
): Promise<ColdStartRecommendation> {
  const reasoning: string[] = [];
  
  // Step 1: Map intent from message
  const intentMapping = await mapIntent(userId, userMessage);
  reasoning.push(`Mapped intent: ${intentMapping.topicId} (confidence: ${intentMapping.confidence.toFixed(2)})`);
  
  // Step 2: Check if user has memory (if authenticated)
  let userMemory = null;
  if (userId) {
    userMemory = await getUserMemory(userId);
    if (userMemory) {
      reasoning.push("Found existing user memory");
    }
  }
  
  // Step 3: Apply cold start rules
  const rules = getColdStartRules();
  
  // Find matching rule
  let matchedRule = null;
  for (const rule of rules) {
    if (rule.topicPattern.test(intentMapping.topicId)) {
      matchedRule = rule;
      reasoning.push(`Matched rule: ${rule.name}`);
      break;
    }
  }
  
  // Default rule if no match
  if (!matchedRule) {
    matchedRule = rules.find((r) => r.name === "default") || rules[0];
    if (!matchedRule) {
      throw new Error("No cold-start rules available");
    }
    reasoning.push(`Using default rule: ${matchedRule.name}`);
  }
  
  // Step 4: Override with user memory if available
  const recommendation: ColdStartRecommendation = {
    topicId: intentMapping.topicId,
    toneClass: userMemory?.preferredTone || matchedRule.defaultTone,
    intensityBand: userMemory?.preferredIntensity || matchedRule.defaultIntensity,
    voiceId: userMemory?.lastPlanSettings?.voiceId || matchedRule.defaultVoice,
    brainTrackMode: userMemory?.lastPlanSettings?.brainTrackMode || matchedRule.defaultBrainTrack,
    backgroundId: userMemory?.lastPlanSettings?.backgroundId || matchedRule.defaultBackground,
    affirmationCount: userMemory?.lastPlanSettings?.affirmationCount || matchedRule.defaultAffirmationCount,
    confidence: intentMapping.confidence,
    reasoning,
  };
  
  if (userMemory) {
    reasoning.push("Applied user memory preferences");
  }
  
  return recommendation;
}

interface ColdStartRule {
  name: string;
  topicPattern: RegExp;
  defaultTone: string;
  defaultIntensity: string;
  defaultVoice: string;
  defaultBrainTrack: string;
  defaultBackground?: string;
  defaultAffirmationCount: number;
}

/**
 * Cold start rules (can be loaded from JSON file in production)
 */
function getColdStartRules(): ColdStartRule[] {
  return [
    {
      name: "confidence_work",
      topicPattern: /confidence\.work/i,
      defaultTone: "energetic",
      defaultIntensity: "medium",
      defaultVoice: "energetic-male",
      defaultBrainTrack: "binaural",
      defaultBackground: "ocean",
      defaultAffirmationCount: 6,
    },
    {
      name: "anxiety_calm",
      topicPattern: /anxiety\.calm/i,
      defaultTone: "calm",
      defaultIntensity: "low",
      defaultVoice: "calm-female",
      defaultBrainTrack: "binaural",
      defaultBackground: "rain",
      defaultAffirmationCount: 6,
    },
    {
      name: "sleep_rest",
      topicPattern: /sleep\.rest/i,
      defaultTone: "calm",
      defaultIntensity: "low",
      defaultVoice: "calm-male",
      defaultBrainTrack: "binaural",
      defaultBackground: "rain",
      defaultAffirmationCount: 6,
    },
    {
      name: "focus_concentration",
      topicPattern: /focus\.concentration/i,
      defaultTone: "energetic",
      defaultIntensity: "medium",
      defaultVoice: "energetic-male",
      defaultBrainTrack: "binaural",
      defaultBackground: "forest",
      defaultAffirmationCount: 6,
    },
    {
      name: "default",
      topicPattern: /.*/,
      defaultTone: "calm",
      defaultIntensity: "medium",
      defaultVoice: "calm-female",
      defaultBrainTrack: "binaural",
      defaultBackground: "ocean",
      defaultAffirmationCount: 6,
    },
  ];
}

/**
 * Export cold start rules as JSON (for data room)
 */
export function exportColdStartRules(): {
  version: string;
  rules: Array<{
    name: string;
    topicPattern: string;
    defaults: Omit<ColdStartRule, "name" | "topicPattern">;
  }>;
} {
  const rules = getColdStartRules();
  
  return {
    version: "v1.0.0",
    rules: rules.map((rule) => ({
      name: rule.name,
      topicPattern: rule.topicPattern.source,
      defaults: {
        defaultTone: rule.defaultTone,
        defaultIntensity: rule.defaultIntensity,
        defaultVoice: rule.defaultVoice,
        defaultBrainTrack: rule.defaultBrainTrack,
        defaultBackground: rule.defaultBackground,
        defaultAffirmationCount: rule.defaultAffirmationCount,
      },
    })),
  };
}
