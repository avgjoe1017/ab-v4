/**
 * Content Moderation Service
 * Integrates with OpenAI Moderation API to automatically flag harmful content
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ModerationResult {
  flagged: boolean;
  categories: {
    hate: boolean;
    "hate/threatening": boolean;
    "self-harm": boolean;
    sexual: boolean;
    "sexual/minors": boolean;
    violence: boolean;
    "violence/graphic": boolean;
  };
  categoryScores: Record<string, number>;
  reason?: string;
}

/**
 * Check content using OpenAI Moderation API
 * Returns moderation result with flagged status and categories
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  try {
    const moderation = await openai.moderations.create({
      input: text,
    });

    const result = moderation.results[0];
    if (!result) {
      return {
        flagged: false,
        categories: {
          hate: false,
          "hate/threatening": false,
          "self-harm": false,
          sexual: false,
          "sexual/minors": false,
          violence: false,
          "violence/graphic": false,
        },
        categoryScores: {},
      };
    }

    // Build reason string from flagged categories
    const flaggedCategories: string[] = [];
    if (result.categories.hate) flaggedCategories.push("hate");
    if (result.categories["hate/threatening"]) flaggedCategories.push("hate/threatening");
    if (result.categories["self-harm"]) flaggedCategories.push("self-harm");
    if (result.categories.sexual) flaggedCategories.push("sexual");
    if (result.categories["sexual/minors"]) flaggedCategories.push("sexual/minors");
    if (result.categories.violence) flaggedCategories.push("violence");
    if (result.categories["violence/graphic"]) flaggedCategories.push("violence/graphic");

    return {
      flagged: result.flagged,
      categories: result.categories,
      categoryScores: result.category_scores,
      reason: flaggedCategories.length > 0 ? flaggedCategories.join(", ") : undefined,
    };
  } catch (error) {
    console.error("[Moderation] OpenAI moderation API error:", error);
    // Fail open - don't block content if moderation service is down
    return {
      flagged: false,
      categories: {
        hate: false,
        "hate/threatening": false,
        "self-harm": false,
        sexual: false,
        "sexual/minors": false,
        violence: false,
        "violence/graphic": false,
      },
      categoryScores: {},
    };
  }
}

/**
 * Check if content is negative (simple heuristic for non-flagged but still problematic content)
 */
export function isNegativeContent(text: string): boolean {
  const negativePatterns = [
    /\b(?:hate|despise|loathe|disgust|disgusting|awful|terrible|horrible|worst|failure|fail|loser|stupid|idiot|dumb|worthless|useless|pathetic|weak|weakness)\b/gi,
    /\b(?:I (?:am|feel|can't|cannot) (?:not|never|no|bad|terrible|awful|horrible|worthless|useless|pathetic|weak|stupid|dumb|failure|loser))\b/gi,
    /\b(?:nothing|nobody|no one|never|can't|won't|don't|doesn't|isn't|aren't|wasn't|weren't)\b.*\b(?:good|right|better|improve|success|succeed|happy|positive|confident|strong)\b/gi,
  ];

  return negativePatterns.some((pattern) => pattern.test(text));
}

/**
 * Comprehensive moderation check combining OpenAI API and heuristics
 */
export async function moderateAffirmation(text: string): Promise<{
  shouldFlag: boolean;
  reason?: string;
  autoFlagged: boolean;
}> {
  // First check OpenAI moderation API
  const moderationResult = await moderateContent(text);

  if (moderationResult.flagged) {
    return {
      shouldFlag: true,
      reason: moderationResult.reason || "Flagged by automated moderation",
      autoFlagged: true,
    };
  }

  // Then check for negative content (heuristic)
  if (isNegativeContent(text)) {
    return {
      shouldFlag: true,
      reason: "negative",
      autoFlagged: true,
    };
  }

  return {
    shouldFlag: false,
    autoFlagged: false,
  };
}

