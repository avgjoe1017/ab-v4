/**
 * V4 Risk Classifier
 * P1-8.1: Classifies user messages for risk levels (none, distress, crisis)
 * P1-8.2: Provides validation mode templates for distress scenarios
 */

export type RiskLevel = 'none' | 'distress' | 'crisis';

export interface RiskClassification {
  level: RiskLevel;
  confidence: number; // 0-1
  indicators: string[]; // What triggered the classification
}

/**
 * Classify user message for risk level
 * P1-8.1: Detects distress and crisis indicators
 */
export function classifyRisk(userMessage: string): RiskClassification {
  const lower = userMessage.toLowerCase();
  const indicators: string[] = [];
  let crisisScore = 0;
  let distressScore = 0;

  // Crisis indicators (immediate safety concerns)
  const crisisPatterns = [
    { pattern: /\b(kill|suicide|end it|end my life|not want to live|want to die)\b/i, weight: 10 },
    { pattern: /\b(harm myself|hurt myself|self harm|cutting|cut myself)\b/i, weight: 10 },
    { pattern: /\b(overdose|poison|jump|hang|shoot)\b/i, weight: 8 },
    { pattern: /\b(emergency|urgent help|need help now|immediate help)\b/i, weight: 6 },
    { pattern: /\b(can't go on|can't take it|give up|hopeless|nothing matters)\b/i, weight: 7 },
  ];

  // Distress indicators (emotional distress, but not immediate crisis)
  const distressPatterns = [
    { pattern: /\b(overwhelmed|breaking down|falling apart|can't cope|can't handle)\b/i, weight: 5 },
    { pattern: /\b(panic|panic attack|hyperventilating|can't breathe)\b/i, weight: 5 },
    { pattern: /\b(depressed|depression|sad all the time|hopeless|worthless)\b/i, weight: 4 },
    { pattern: /\b(anxious|anxiety|worried|stressed|stressed out)\b/i, weight: 2 },
    { pattern: /\b(alone|lonely|isolated|no one|nobody cares)\b/i, weight: 3 },
    { pattern: /\b(struggling|struggle|difficult|hard time|tough)\b/i, weight: 2 },
  ];

  // Check for crisis indicators
  for (const { pattern, weight } of crisisPatterns) {
    if (pattern.test(lower)) {
      crisisScore += weight;
      indicators.push(`crisis: ${pattern.source}`);
    }
  }

  // Check for distress indicators (only if not crisis)
  if (crisisScore === 0) {
    for (const { pattern, weight } of distressPatterns) {
      if (pattern.test(lower)) {
        distressScore += weight;
        indicators.push(`distress: ${pattern.source}`);
      }
    }
  }

  // Determine risk level
  let level: RiskLevel = 'none';
  let confidence = 0;

  if (crisisScore >= 8) {
    level = 'crisis';
    confidence = Math.min(1, crisisScore / 15);
  } else if (distressScore >= 4 || crisisScore >= 4) {
    level = 'distress';
    confidence = Math.min(1, (distressScore + crisisScore) / 10);
  } else {
    level = 'none';
    confidence = 0;
  }

  return {
    level,
    confidence,
    indicators: indicators.slice(0, 5), // Limit to 5 indicators
  };
}

/**
 * Get validation mode affirmation templates for distress scenarios
 * P1-8.2: Grounded, safe, present-tense affirmations that avoid toxic positivity
 */
export function getValidationModeTemplates(intent: string): string[] {
  // Grounded, present-tense affirmations that acknowledge difficulty without grand promises
  const templates = [
    "I am here, right now, in this moment.",
    "I can take one breath at a time.",
    "This feeling is temporary, even if it doesn't feel that way.",
    "I have survived difficult moments before.",
    "I am doing the best I can with what I have right now.",
    "It's okay to not be okay.",
    "I can ask for help when I need it.",
    "I am safe in this moment.",
    "My feelings are valid, even the difficult ones.",
    "I can pause and breathe before responding.",
  ];

  // Return a subset based on intent (can be customized later)
  return templates.slice(0, 6); // Return 6 affirmations for distress mode
}

/**
 * Get crisis resources message
 * P1-8.1: Provides crisis resources without upsell
 */
export function getCrisisResources(): string {
  return `If you're in immediate danger, please call 988 (Suicide & Crisis Lifeline) or 911.

You're not alone, and there are people who want to help:
• 988 Suicide & Crisis Lifeline: Call or text 988
• Crisis Text Line: Text HOME to 741741
• National Alliance on Mental Illness: nami.org

I'm here to listen, but for immediate support, please reach out to a crisis helpline or mental health professional.`;
}
