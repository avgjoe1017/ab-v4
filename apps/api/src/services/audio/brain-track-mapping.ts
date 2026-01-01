/**
 * Brain Track Mapping Rules
 * 
 * Maps session types and intents to appropriate binaural beats or solfeggio frequencies.
 * Based on neuroscience research documented in Brain/affirmation_research.md
 */

export interface BrainTrackMapping {
  hz: number;
  mode: "binaural" | "solfeggio";
  rationale: string;
}

/**
 * Primary binaural beat mappings by session type.
 * Based on brainwave entrainment research.
 */
const BINAURAL_MAPPINGS: Record<string, BrainTrackMapping> = {
  // Sleep: Delta waves (0.5-4 Hz) promote deep, dreamless sleep
  sleep: { hz: 2, mode: "binaural", rationale: "Delta 2Hz promotes deep slow-wave sleep" },
  
  // Focus: SMR (12-15 Hz) provides calm concentration without agitation
  focus: { hz: 13.5, mode: "binaural", rationale: "SMR 13.5Hz for calm, focused attention" },
  work: { hz: 13.5, mode: "binaural", rationale: "SMR 13.5Hz for sustained concentration" },
  study: { hz: 13.5, mode: "binaural", rationale: "SMR 13.5Hz for learning and retention" },
  
  // Meditation: Alpha (8-12 Hz) is relaxed but alert awareness
  meditate: { hz: 10, mode: "binaural", rationale: "Alpha 10Hz for relaxed awareness" },
  meditation: { hz: 10, mode: "binaural", rationale: "Alpha 10Hz for mindfulness" },
  
  // Anxiety Relief: Theta (4-7 Hz) calms the mind, reduces rumination
  anxiety: { hz: 7, mode: "binaural", rationale: "Theta 7Hz calms anxious thinking" },
  calm: { hz: 7, mode: "binaural", rationale: "Theta 7Hz promotes calm" },
  stress: { hz: 7, mode: "binaural", rationale: "Theta 7Hz reduces stress response" },
  
  // Wake Up / Energy: Beta (13-30 Hz) for alertness
  "wake up": { hz: 20, mode: "binaural", rationale: "Beta 20Hz for morning alertness" },
  wakeup: { hz: 20, mode: "binaural", rationale: "Beta 20Hz for energy" },
  morning: { hz: 20, mode: "binaural", rationale: "Beta 20Hz to start the day" },
  energy: { hz: 20, mode: "binaural", rationale: "Beta 20Hz for vitality" },
  
  // Pre-Performance: High Alpha (10-12 Hz) for calm confidence
  performance: { hz: 12, mode: "binaural", rationale: "Alpha 12Hz for calm confidence" },
  confidence: { hz: 12, mode: "binaural", rationale: "Alpha 12Hz before challenges" },
  
  // Creativity: Theta (4-7 Hz) accesses subconscious, promotes insight
  creativity: { hz: 7, mode: "binaural", rationale: "Theta 7Hz for creative insight" },
  creative: { hz: 7, mode: "binaural", rationale: "Theta 7Hz opens the mind" },
  
  // Coffee Replacement: High Beta for caffeine-like alertness
  coffee: { hz: 21.5, mode: "binaural", rationale: "High Beta 21.5Hz mimics caffeine alertness" },
  alertness: { hz: 21.5, mode: "binaural", rationale: "High Beta 21.5Hz for quick energy" },
};

/**
 * Solfeggio frequency mappings by session type.
 * Based on traditional associations and limited research on 528Hz.
 */
const SOLFEGGIO_MAPPINGS: Record<string, BrainTrackMapping> = {
  // Sleep: 528 Hz "Miracle Tone" - studies show reduced cortisol
  sleep: { hz: 528, mode: "solfeggio", rationale: "528Hz reduces cortisol, promotes rest" },
  
  // Focus: 741 Hz for mental clarity
  focus: { hz: 741, mode: "solfeggio", rationale: "741Hz for mental clarity and expression" },
  work: { hz: 741, mode: "solfeggio", rationale: "741Hz for problem-solving" },
  
  // Meditation: 432 Hz for peaceful harmony
  meditate: { hz: 432, mode: "solfeggio", rationale: "432Hz for harmonic, grounding meditation" },
  meditation: { hz: 432, mode: "solfeggio", rationale: "432Hz promotes inner peace" },
  
  // Anxiety: 396 Hz releases fear and guilt
  anxiety: { hz: 396, mode: "solfeggio", rationale: "396Hz liberates fear and guilt" },
  calm: { hz: 396, mode: "solfeggio", rationale: "396Hz for emotional release" },
  stress: { hz: 396, mode: "solfeggio", rationale: "396Hz clears negative energy" },
  
  // Wake Up: 417 Hz facilitates change
  "wake up": { hz: 417, mode: "solfeggio", rationale: "417Hz for new beginnings" },
  wakeup: { hz: 417, mode: "solfeggio", rationale: "417Hz clears the slate" },
  morning: { hz: 417, mode: "solfeggio", rationale: "417Hz for fresh starts" },
  
  // Creativity: 852 Hz for intuition
  creativity: { hz: 852, mode: "solfeggio", rationale: "852Hz awakens intuition" },
  creative: { hz: 852, mode: "solfeggio", rationale: "852Hz for spiritual awareness" },
  
  // Performance/Confidence: 639 Hz for harmony and relationships
  performance: { hz: 639, mode: "solfeggio", rationale: "639Hz for harmonious confidence" },
  confidence: { hz: 639, mode: "solfeggio", rationale: "639Hz balances emotions" },
};

/**
 * Intent keyword patterns that override session type
 */
const INTENT_OVERRIDES: Array<{
  patterns: RegExp;
  binaural: BrainTrackMapping;
  solfeggio: BrainTrackMapping;
}> = [
  {
    patterns: /\b(can'?t sleep|insomnia|sleepless|restless night)\b/i,
    binaural: { hz: 1, mode: "binaural", rationale: "Deep Delta 1Hz for severe insomnia" },
    solfeggio: { hz: 528, mode: "solfeggio", rationale: "528Hz calms for sleep" },
  },
  {
    patterns: /\b(panic|panicking|overwhelm|freaking out)\b/i,
    binaural: { hz: 4, mode: "binaural", rationale: "Deep Theta 4Hz for acute anxiety" },
    solfeggio: { hz: 396, mode: "solfeggio", rationale: "396Hz releases fear" },
  },
  {
    patterns: /\b(exam|test|presentation|interview|big meeting)\b/i,
    binaural: { hz: 12, mode: "binaural", rationale: "Alpha 12Hz for performance calm" },
    solfeggio: { hz: 639, mode: "solfeggio", rationale: "639Hz for confident connection" },
  },
  {
    patterns: /\b(deadline|crunch|rush|urgent)\b/i,
    binaural: { hz: 17, mode: "binaural", rationale: "Low Beta 17Hz for productive urgency" },
    solfeggio: { hz: 741, mode: "solfeggio", rationale: "741Hz for rapid clarity" },
  },
  {
    patterns: /\b(creative block|writer'?s block|stuck|no ideas)\b/i,
    binaural: { hz: 4, mode: "binaural", rationale: "Deep Theta 4Hz unlocks creativity" },
    solfeggio: { hz: 852, mode: "solfeggio", rationale: "852Hz for intuitive breakthroughs" },
  },
];

/**
 * Default fallback mappings
 */
const DEFAULT_BINAURAL: BrainTrackMapping = { 
  hz: 10, 
  mode: "binaural", 
  rationale: "Alpha 10Hz is universally calming and suitable for general use" 
};

const DEFAULT_SOLFEGGIO: BrainTrackMapping = { 
  hz: 432, 
  mode: "solfeggio", 
  rationale: "432Hz is harmonious and grounding, good for general wellbeing" 
};

/**
 * Get the recommended brain track for a session based on type and intent.
 * 
 * @param sessionType - The session type (e.g., "Focus", "Sleep", "Meditate")
 * @param intent - Optional user-provided intent/goal text
 * @param preferredMode - User's preferred mode (binaural or solfeggio), defaults to binaural
 * @returns BrainTrackMapping with hz, mode, and rationale
 */
export function getBrainTrackForSession(
  sessionType: string,
  intent?: string,
  preferredMode: "binaural" | "solfeggio" = "binaural"
): BrainTrackMapping {
  const mappings = preferredMode === "solfeggio" ? SOLFEGGIO_MAPPINGS : BINAURAL_MAPPINGS;
  const defaultMapping = preferredMode === "solfeggio" ? DEFAULT_SOLFEGGIO : DEFAULT_BINAURAL;
  
  // 1. Check intent overrides first (most specific)
  if (intent) {
    for (const override of INTENT_OVERRIDES) {
      if (override.patterns.test(intent)) {
        const mapping = preferredMode === "solfeggio" ? override.solfeggio : override.binaural;
        console.log(`[BrainTrack] Intent override matched: "${intent}" → ${mapping.hz}Hz (${mapping.rationale})`);
        return mapping;
      }
    }
  }
  
  // 2. Match session type (case-insensitive)
  const normalizedType = sessionType.toLowerCase().trim();
  
  // Try exact match first
  if (mappings[normalizedType]) {
    console.log(`[BrainTrack] Session type matched: "${sessionType}" → ${mappings[normalizedType].hz}Hz`);
    return mappings[normalizedType];
  }
  
  // Try partial matches
  for (const [key, mapping] of Object.entries(mappings)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      console.log(`[BrainTrack] Partial match: "${sessionType}" ~= "${key}" → ${mapping.hz}Hz`);
      return mapping;
    }
  }
  
  // 3. Check intent for keywords if no session type match
  if (intent) {
    const normalizedIntent = intent.toLowerCase();
    for (const [key, mapping] of Object.entries(mappings)) {
      if (normalizedIntent.includes(key)) {
        console.log(`[BrainTrack] Intent keyword matched: "${key}" in intent → ${mapping.hz}Hz`);
        return mapping;
      }
    }
  }
  
  // 4. Default fallback
  console.log(`[BrainTrack] No match for "${sessionType}", using default: ${defaultMapping.hz}Hz`);
  return defaultMapping;
}

/**
 * Get binaural beat Hz for a session type (convenience function).
 * Always returns binaural, not solfeggio.
 */
export function getDefaultBinauralHz(sessionType: string, intent?: string): number {
  const mapping = getBrainTrackForSession(sessionType, intent, "binaural");
  return mapping.hz;
}

/**
 * Get solfeggio Hz for a session type (convenience function).
 * Always returns solfeggio, not binaural.
 */
export function getDefaultSolfeggioHz(sessionType: string, intent?: string): number {
  const mapping = getBrainTrackForSession(sessionType, intent, "solfeggio");
  return mapping.hz;
}
