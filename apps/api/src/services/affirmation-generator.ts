/**
 * Affirmation Generation Service
 * Uses OpenAI Chat Completions API with Prompt Caching to generate personalized affirmations
 * 
 * Phase 1.1: Core AI Pipeline
 * Phase 1.2: Prompt Caching Implementation (2025-01-14)
 * 
 * Note: OpenAI automatically caches prompts >= 1024 tokens. We structure our prompts
 * to maximize cache hits by placing static content (rules, schema, examples) first
 * and dynamic content (struggle, session type, goal) last.
 */

import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";

export interface AffirmationGenerationRequest {
  sessionType: string; // "Focus", "Sleep", "Meditate", etc.
  struggle?: string; // Optional: what user is working on
  goal?: string; // User's written goal/intention for this specific session (e.g., "Morning Confidence", "I want to feel more confident at work")
  count?: number; // Number of affirmations to generate (default: 4)
}

export interface AffirmationGenerationResponse {
  affirmations: string[];
  reasoning?: string; // Optional explanation of generation choices
}

// Cache performance metrics
interface CacheMetrics {
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cacheHit: boolean;
}

// Prompt template version - bump this when static prefix changes
// v1: Basic rules and examples
// v2: Neuroscience-based rules with 5 Linguistic Commandments and 3 Frameworks
// v2.1: Added variety and concreteness constraints to reduce templated output
const PROMPT_TEMPLATE_VERSION = "v2";

// Model configuration
// Models supporting prompt caching: gpt-4o, gpt-4.1, gpt-4.1-mini
// Set OPENAI_MODEL in .env to change (default: gpt-4.1-mini for cost efficiency)
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// JSON Schema for structured output
const AFFIRMATIONS_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "affirmations_response",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        affirmations: {
          type: "array",
          items: { type: "string" },
          description: "Array of affirmations, each 5-12 words, first-person present tense, action-oriented"
        }
      },
      required: ["affirmations"]
    }
  }
};

// Load static prompt prefix from file (cached portion)
let STATIC_INSTRUCTIONS: string | null = null;
let STATIC_PREFIX_HASH: string | null = null;

function loadStaticInstructions(): string {
  if (STATIC_INSTRUCTIONS) {
    return STATIC_INSTRUCTIONS;
  }

  try {
    // Get prompt file path relative to API src directory
    // process.cwd() is apps/api when running the API server
    const promptPath = join(process.cwd(), "src", "prompts", `affirmations.generator.${PROMPT_TEMPLATE_VERSION}.txt`);
    
    let content = readFileSync(promptPath, "utf-8").trim();
    
    // Split at "DYNAMIC INPUT FOLLOWS" marker - everything BEFORE this is cached
    const dynamicMarker = "DYNAMIC INPUT FOLLOWS";
    const markerIndex = content.indexOf(dynamicMarker);
    
    if (markerIndex === -1) {
      console.warn("[AffirmationGenerator] No 'DYNAMIC INPUT FOLLOWS' marker found, using entire file as static");
      STATIC_INSTRUCTIONS = content;
    } else {
      // Extract everything up to and including the marker line
      const staticPart = content.substring(0, markerIndex + dynamicMarker.length).trim();
      STATIC_INSTRUCTIONS = staticPart;
    }
    
    // Compute hash for integrity checking
    STATIC_PREFIX_HASH = computeHash(STATIC_INSTRUCTIONS);
    
    console.log(`[AffirmationGenerator] Loaded static prompt template v${PROMPT_TEMPLATE_VERSION} (${STATIC_INSTRUCTIONS.length} chars, hash: ${STATIC_PREFIX_HASH})`);
    return STATIC_INSTRUCTIONS;
  } catch (error) {
    console.error("[AffirmationGenerator] Failed to load prompt template, using fallback:", error);
    // Fallback to inline template if file read fails (v2 neuroscience-based rules)
    STATIC_INSTRUCTIONS = `You are an expert in neuroscience-based affirmation generation, grounded in Self-Affirmation Theory, neuroplasticity, and cognitive restructuring. Your goal is to create affirmations that maintain global self-integrity and drive neuroplastic change.

## The 5 Linguistic Commandments

1. **Cognitive Now (Present Tense)**: NEVER use future tense. The subconscious processes immediate reality.
2. **Exclusive Positivity**: Frame ONLY around desired state, never the problem. No negative words (not, stop, don't).
3. **Verbs Over Adjectives**: Use dynamic verbs rather than static adjectives. Verbs are instructions; adjectives are rejectable labels.
4. **Brevity and Rhythm**: Keep affirmations 5-12 words. Create cadence easy to chant or loop mentally.
5. **Specificity and Plausibility**: Avoid vague generalizations. Claims must be plausible to avoid cognitive dissonance.

## The 3 Frameworks

- **Bridge** (for anxiety/low confidence): Use progressive verbs (learning, becoming, willing, capable of)
- **Value Anchor** (for identity/resilience): Tie to core values (value, honor, respect, trust)
- **Power Statement** (for performance/goals): Use strong action verbs (building, creating, taking, focusing)

## Quality Control

1. Is it Sticky? (5-12 words, rhythmic)
2. Is it Emotional? (evokes feeling)
3. Is it Believable? (stretches without breaking)
4. Is it in the Now? (no future tense)
5. Is it Positive? (no negative words)
6. Is it Action-Oriented? (verbs over adjectives)
7. Is it Varied? (don't start all with "I am...", vary structures)
8. Is it Concrete? (use real verbs: begin, continue, return, complete)

## Output Format

Respond with valid JSON only. No commentary, no markdown.
Schema: { "affirmations": string[] } - Array of 3-16 affirmations, each 5-12 words.

DYNAMIC INPUT FOLLOWS`;
    STATIC_PREFIX_HASH = computeHash(STATIC_INSTRUCTIONS);
    return STATIC_INSTRUCTIONS;
  }
}

/**
 * Extract keywords from user's written goal for mechanical enforcement
 */
function extractGoalKeywords(goal: string): string[] {
  // Simple keyword extraction: remove common words, keep meaningful terms
  const stopWords = new Set([
    "i", "am", "want", "to", "feel", "be", "the", "a", "an", "and", "or", "but", "in", "on", "at", "for", "with", "about",
    "more", "less", "better", "good", "well", "very", "really", "just", "only", "also", "too", "so", "as", "is", "are",
    "was", "were", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "can"
  ]);
  
  const words = goal.toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Return unique keywords, limit to most meaningful
  return Array.from(new Set(words)).slice(0, 10);
}

/**
 * Select framework based on session type and user context
 */
function selectFramework(sessionType: string, struggle?: string): "A" | "B" | "C" {
  const typeLower = sessionType.toLowerCase();
  const struggleLower = (struggle || "").toLowerCase();
  
  // Framework A: Bridge (for anxiety, depression, low confidence)
  if (typeLower.includes("anxiety") || typeLower.includes("calm") || 
      struggleLower.includes("anxiety") || struggleLower.includes("fear") || 
      struggleLower.includes("doubt") || struggleLower.includes("imposter")) {
    return "A";
  }
  
  // Framework C: Power Statement (for performance, focus, goals)
  if (typeLower.includes("focus") || typeLower.includes("work") || 
      typeLower.includes("wake") || typeLower.includes("energy")) {
    return "C";
  }
  
  // Framework B: Value Anchor (default for meditation, sleep, general)
  return "B";
}

/**
 * Build dynamic tail (user-specific content that changes per request)
 * This goes AFTER the static prefix to maximize cache hits
 */
function buildDynamicTail(
  request: AffirmationGenerationRequest,
  count: number
): string {
  // Extract goal keywords if goal is provided
  const goalKeywords = request.goal ? extractGoalKeywords(request.goal) : [];
  
  // Select framework
  const framework = selectFramework(request.sessionType, request.struggle);
  
  // Build structured dynamic input
  const parts: string[] = [];
  
  parts.push(`session_type: ${request.sessionType}`);
  parts.push(`framework: ${framework}`);
  parts.push(`n_affirmations: ${count}`);
  
  if (request.goal) {
    parts.push(`written_goal: "${request.goal}"`);
    if (goalKeywords.length > 0) {
      parts.push(`goal_keywords: [${goalKeywords.map(k => `"${k}"`).join(", ")}]`);
    }
  }
  
  if (request.struggle) {
    parts.push(`struggle: "${request.struggle}"`);
  }
  
  // Add mechanical constraint reminder
  if (request.goal && goalKeywords.length > 0) {
    parts.push(`\nREQUIREMENT: At least 70% of affirmations must contain one concept from goal_keywords (synonyms allowed).`);
  }
  
  return parts.join("\n");
}

/**
 * Generate personalized affirmations using OpenAI Chat Completions API with Prompt Caching
 * 
 * Requirements (per roadmap):
 * - First-person statements ("I am..." not "You are...")
 * - Present tense, believable stretch (not delusional)
 * - Appropriate for user's self-esteem level (avoid backfire effect)
 * - Each affirmation 5-12 words
 * 
 * Implementation uses Prompt Caching:
 * - Static prefix (rules, schema, examples) placed in system message
 * - Dynamic tail (struggle, session type, goal) placed in user message
 * - OpenAI automatically caches prompts >= 1024 tokens
 * - Cache metrics available in response.usage.prompt_tokens_details.cached_tokens
 */
export async function generateAffirmations(
  request: AffirmationGenerationRequest
): Promise<AffirmationGenerationResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured. Add OPENAI_API_KEY to the root .env file");
  }

  const count = request.count ?? 4; // Default to 4 affirmations (3-6 range per roadmap)
  
  // Load static instructions (cached prefix)
  const staticInstructions = loadStaticInstructions();
  
  // Build dynamic tail (user-specific, not cached)
  const dynamicInput = buildDynamicTail(request, count);

  const client = new OpenAI({ apiKey });

  const startTime = Date.now();

  try {
    // Use Chat Completions API with structured output
    // OpenAI automatically caches prompts >= 1024 tokens
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: staticInstructions // Static prefix - cached for subsequent requests
        },
        {
          role: "user",
          content: dynamicInput // Dynamic tail - changes per request
        }
      ],
      response_format: AFFIRMATIONS_SCHEMA,
      max_tokens: 450, // Enough for 16 affirmations
      temperature: 0.7, // Some creativity, but not too random
    });

    const latencyMs = Date.now() - startTime;

    // Extract cache metrics from usage details
    // Note: cached_tokens is available in prompt_tokens_details for models that support caching
    const usage = response.usage;
    const promptTokensDetails = usage?.prompt_tokens_details as { cached_tokens?: number } | undefined;
    const cachedTokens = promptTokensDetails?.cached_tokens ?? 0;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;
    const cacheHit = cachedTokens > 0;

    // Log cache performance
    const metrics: CacheMetrics = {
      cachedTokens,
      inputTokens,
      outputTokens,
      latencyMs,
      cacheHit
    };

    logCachePerformance(metrics, request, staticInstructions, dynamicInput);

    // Parse structured output
    let affirmations: string[] = [];
    let reasoning: string | undefined;

    try {
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        console.error("[AffirmationGenerator] No content in response");
        throw new Error("No content returned from OpenAI");
      }

      // Parse JSON content
      const parsed = JSON.parse(content);
      affirmations = Array.isArray(parsed.affirmations) ? parsed.affirmations : [];
    } catch (parseError) {
      console.error("[AffirmationGenerator] Failed to parse JSON response:", parseError);
      console.error("[AffirmationGenerator] Raw content:", response.choices[0]?.message?.content);
      throw new Error("Failed to parse affirmations from OpenAI response");
    }

    if (affirmations.length === 0) {
      throw new Error("No affirmations returned from OpenAI");
    }

    // Limit to requested count
    if (affirmations.length > count) {
      affirmations = affirmations.slice(0, count);
    }

    // Post-validate against rules
    const validationResult = validateAffirmations(affirmations, request, count);
    
    if (!validationResult.valid) {
      // Only log as warning if retryable is false (meaning retry won't help)
      // Otherwise, log at debug level since we'll retry automatically
      if (!validationResult.retryable) {
        console.warn(`[AffirmationGenerator] Validation failed (non-retryable): ${validationResult.errors.join(", ")}`);
      } else {
        // Log at debug level - this is expected behavior and will be automatically retried
        console.debug(`[AffirmationGenerator] Validation failed (will retry): ${validationResult.errors.join(", ")}`);
      }
      
      // Retry once with lower temperature if validation fails
      if (validationResult.retryable) {
        console.debug("[AffirmationGenerator] Retrying with lower temperature...");
        try {
          const retryResponse = await client.chat.completions.create({
            model: MODEL,
            messages: [
              { role: "system", content: staticInstructions },
              { role: "user", content: dynamicInput }
            ],
            response_format: AFFIRMATIONS_SCHEMA,
            max_tokens: 450,
            temperature: 0.3, // Lower temperature for more consistent output
          });
          
          const retryContent = retryResponse.choices[0]?.message?.content;
          if (retryContent) {
            const retryParsed = JSON.parse(retryContent);
            const retryAffirmations = Array.isArray(retryParsed?.affirmations) ? retryParsed.affirmations : [];
            
            if (retryAffirmations.length > 0) {
              const retryValidation = validateAffirmations(retryAffirmations, request, count);
              if (retryValidation.valid || retryValidation.errors.length < validationResult.errors.length) {
                affirmations = retryAffirmations.slice(0, count);
                console.debug("[AffirmationGenerator] Retry successful");
              } else {
                console.warn(`[AffirmationGenerator] Retry still failed: ${retryValidation.errors.join(", ")}`);
              }
            }
          }
        } catch (retryError) {
          console.error("[AffirmationGenerator] Retry failed:", retryError);
        }
      }
    }

    return {
      affirmations,
      reasoning,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[AffirmationGenerator] Error generating affirmations (${latencyMs}ms):`, error);
    throw error;
  }
}

// Compute hash for debugging cache consistency
function computeHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Post-validation against prompt rules
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  retryable: boolean; // Whether a retry might help
}

function validateAffirmations(
  affirmations: string[],
  request: AffirmationGenerationRequest,
  expectedCount: number
): ValidationResult {
  const errors: string[] = [];
  let retryable = false;
  
  // Check count
  if (affirmations.length < 3 || affirmations.length > 16) {
    errors.push(`Count out of range: ${affirmations.length} (expected 3-16)`);
    retryable = true;
  }
  
  if (affirmations.length !== expectedCount) {
    errors.push(`Count mismatch: got ${affirmations.length}, expected ${expectedCount}`);
  }
  
  // Banned negative words (expanded list)
  const bannedWords = /\b(not|stop|don't|never|no longer|without|free of|avoid|quit|rid of)\b/i;
  
  // Future tense patterns
  const futureTense = /\b(will|going to|I'll|I'm going|gonna)\b/i;
  
  // Banned vague verbs (unless user used them)
  const vagueVerbs = /\b(engage|embrace|embody|manifest|align)\b/i;
  const userText = (request.goal || request.struggle || "").toLowerCase();
  const userUsedVague = vagueVerbs.test(userText);
  
  // Count "I am" openers
  let iAmCount = 0;
  const iAmPattern = /^I am\s+/i;
  
  // Goal keyword coverage
  const goalKeywords = request.goal ? extractGoalKeywords(request.goal) : [];
  let goalCoverageCount = 0;
  
  // Check each affirmation
  for (let i = 0; i < affirmations.length; i++) {
    const aff = affirmations[i]?.trim();
    if (!aff) continue;
    const words = aff.split(/\s+/);
    
    // Word count (5-12)
    if (words.length < 5 || words.length > 12) {
      errors.push(`Affirmation ${i + 1}: word count ${words.length} (expected 5-12): "${aff}"`);
      retryable = true;
    }
    
    // Future tense
    if (futureTense.test(aff)) {
      errors.push(`Affirmation ${i + 1}: contains future tense: "${aff}"`);
      retryable = true;
    }
    
    // Banned negative words
    if (bannedWords.test(aff)) {
      errors.push(`Affirmation ${i + 1}: contains banned negative word: "${aff}"`);
      retryable = true;
    }
    
    // Banned vague verbs (unless user used them)
    if (!userUsedVague && vagueVerbs.test(aff)) {
      errors.push(`Affirmation ${i + 1}: uses banned vague verb: "${aff}"`);
    }
    
    // Count "I am" openers
    if (iAmPattern.test(aff)) {
      iAmCount++;
    }
    
    // Goal keyword coverage
    if (goalKeywords.length > 0) {
      const affLower = aff.toLowerCase();
      if (goalKeywords.some(keyword => affLower.includes(keyword))) {
        goalCoverageCount++;
      }
    }
    
    // Check for duplicates (exact and near)
    for (let j = i + 1; j < affirmations.length; j++) {
      const other = affirmations[j]?.trim();
      if (!other) continue;
      if (aff === other) {
        errors.push(`Affirmation ${i + 1} and ${j + 1} are exact duplicates`);
        retryable = true;
      } else {
        // Near duplicate check (simple word overlap)
        const affWords = new Set(aff.toLowerCase().split(/\s+/));
        const otherWords = new Set(other.toLowerCase().split(/\s+/));
        const overlap = [...affWords].filter(w => otherWords.has(w)).length;
        const similarity = overlap / Math.max(affWords.size, otherWords.size);
        if (similarity > 0.8) {
          errors.push(`Affirmation ${i + 1} and ${j + 1} are too similar (${(similarity * 100).toFixed(0)}% overlap)`);
        }
      }
    }
  }
  
  // Opener cap (max 4 "I am" openers)
  if (iAmCount > 4) {
    errors.push(`Too many "I am" openers: ${iAmCount} (max 4)`);
    retryable = true;
  }
  
  // Goal coverage (70% threshold)
  if (goalKeywords.length > 0 && affirmations.length > 0) {
    const coverage = goalCoverageCount / affirmations.length;
    if (coverage < 0.7) {
      errors.push(`Goal keyword coverage too low: ${(coverage * 100).toFixed(0)}% (required 70%)`);
      retryable = true;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    retryable,
  };
}

/**
 * Log cache performance metrics for monitoring
 */
function logCachePerformance(
  metrics: CacheMetrics, 
  request: AffirmationGenerationRequest,
  staticPrefix: string,
  dynamicTail: string
): void {
  const cacheHitRate = metrics.inputTokens > 0 
    ? ((metrics.cachedTokens / metrics.inputTokens) * 100).toFixed(1)
    : "0.0";

  const prefixHash = computeHash(staticPrefix);
  const prefixLength = staticPrefix.length;
  const tailLength = dynamicTail.length;
  
  // Prefix integrity check
  const expectedHash = STATIC_PREFIX_HASH || computeHash(staticPrefix);
  const hashMatch = prefixHash === expectedHash;
  
  if (!hashMatch) {
    console.error(`[AffirmationGenerator] ⚠️  PREFIX INTEGRITY CHECK FAILED!
      Expected hash: ${expectedHash}
      Actual hash: ${prefixHash}
      This indicates the static prefix changed unexpectedly. Cache hits will drop.`);
  }

  console.log(`[AffirmationGenerator] Cache Performance:
    - Cache Hit: ${metrics.cacheHit ? "✅" : "❌"} (${cacheHitRate}% of input tokens cached)
    - Cached Tokens: ${metrics.cachedTokens}
    - Input Tokens: ${metrics.inputTokens}
    - Output Tokens: ${metrics.outputTokens}
    - Latency: ${metrics.latencyMs}ms
    - Session Type: ${request.sessionType}
    - Count: ${request.count ?? 4}
    - Static Prefix Hash: ${prefixHash} ${hashMatch ? "✅" : "⚠️"}
    - Static Prefix Length: ${prefixLength} chars
    - Dynamic Tail Length: ${tailLength} chars
    - Dynamic Tail Preview: "${dynamicTail.substring(0, 100)}..."`);

  // Warn if cache hit rate is unexpectedly low after first request
  if (!metrics.cacheHit && metrics.inputTokens >= 1024) {
    console.warn(`[AffirmationGenerator] ⚠️  Cache miss detected despite >=1024 tokens. Check:
      1. Is the static prefix identical across requests?
      2. Are there any dynamic values in the static prefix?
      3. Is the model gpt-4o or newer?
      4. Prefix hash: ${prefixHash} (expected: ${expectedHash})`);
  }
  
  // Warn if partial cache hit (< 90%)
  const hitRate = metrics.inputTokens > 0 ? (metrics.cachedTokens / metrics.inputTokens) * 100 : 0;
  if (metrics.cacheHit && hitRate < 90 && hitRate > 0) {
    console.warn(`[AffirmationGenerator] ⚠️  Partial cache hit (${hitRate.toFixed(1)}%). 
      This usually means the dynamic tail length varies significantly between requests.
      OpenAI caches in 128-token chunks from the start of the prompt.`);
  }
}
