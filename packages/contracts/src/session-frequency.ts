/**
 * Session Frequency Mapping
 * 
 * Shared logic for mapping session goalTag to appropriate binaural frequency and brainwave state.
 * This is a single source of truth used by both backend (API) and frontend (mobile app).
 */

export interface FrequencyInfo {
    frequencyHz: number;
    brainwaveState: "Delta" | "Theta" | "Alpha" | "SMR" | "Beta";
    description: string;
}

/**
 * Map goalTag to frequency and brainwave state
 * Based on roadmap Phase 3.1 session specifications
 */
export function getFrequencyForGoalTag(goalTag: string | null | undefined): FrequencyInfo {
    if (!goalTag) {
        // Default to Alpha 10Hz (most common)
        return {
            frequencyHz: 10,
            brainwaveState: "Alpha",
            description: "Relaxed alertness, calm focus",
        };
    }

    const normalizedTag = goalTag.toLowerCase();

    // Map goalTag to frequency based on roadmap
    switch (normalizedTag) {
        case "wake-up":
        case "coffee-replacement":
            return {
                frequencyHz: 17, // Beta Low (14-20 Hz range)
                brainwaveState: "Beta",
                description: "Wake up, alertness, energy",
            };

        case "meditate":
            return {
                frequencyHz: 7, // Theta (7-8 Hz)
                brainwaveState: "Theta",
                description: "Deep meditation, presence, awareness",
            };

        case "focus":
            return {
                frequencyHz: 13.5, // SMR (12-15 Hz)
                brainwaveState: "SMR",
                description: "Clarity, concentration, flow",
            };

        case "sleep":
            return {
                frequencyHz: 3, // Delta (2-4 Hz)
                brainwaveState: "Delta",
                description: "Deep sleep, release, rest",
            };

        case "pre-performance":
            return {
                frequencyHz: 12, // Alpha 12Hz (10-12 Hz)
                brainwaveState: "Alpha",
                description: "Confidence, readiness, calm",
            };

        case "anxiety":
        case "anxiety-relief":
            return {
                frequencyHz: 10, // Alpha 10Hz
                brainwaveState: "Alpha",
                description: "Safety, grounding, control",
            };

        case "creativity":
            return {
                frequencyHz: 7, // Theta-Alpha crossover (6-10 Hz)
                brainwaveState: "Theta",
                description: "Openness, curiosity, expression",
            };

        default:
            // Fallback to Alpha 10Hz
            return {
                frequencyHz: 10,
                brainwaveState: "Alpha",
                description: "Relaxed alertness, calm focus",
            };
    }
}

/**
 * Solfeggio frequency information
 */
export interface SolfeggioInfo {
    frequencyHz: number;
    description: string;
    traditionalUse: string;
}

/**
 * Map goalTag to appropriate solfeggio frequency
 * Based on research from affirmation_research.md use case mapping
 * 
 * Use Case Mapping:
 * - Focus & Concentration: 741 Hz (mental clarity, problem-solving)
 * - Relaxation & Stress Relief: 174 Hz (grounding) or 528 Hz (love frequency)
 * - Deep Sleep: 528 Hz (miracle tone, sleep support) or 417 Hz (emotional release)
 * - Anxiety Relief: 852 Hz (anxiety relief) or 396 Hz (fear/guilt release)
 * - Meditation & Mindfulness: 963 Hz (spiritual awakening) or 396 Hz (grounding)
 * - Energy Boost & Motivation: 396 Hz (liberation, motivation) or 741 Hz (creativity)
 */
export function getSolfeggioForGoalTag(goalTag: string | null | undefined): SolfeggioInfo | null {
    if (!goalTag) {
        return null; // Default to binaural if no goalTag
    }

    const normalizedTag = goalTag.toLowerCase();

    // Map goalTag to solfeggio frequency based on research
    switch (normalizedTag) {
        case "focus":
            return {
                frequencyHz: 741,
                description: "Mental clarity, problem-solving, self-expression",
                traditionalUse: "Awakening intuition & expression - the 'frequency of solutions'",
            };

        case "sleep":
            return {
                frequencyHz: 528,
                description: "Transformation & love - the 'Miracle Tone'",
                traditionalUse: "Deep sleep support, reduced cortisol, improved sleep quality",
            };

        case "anxiety":
        case "anxiety-relief":
            return {
                frequencyHz: 852,
                description: "Spiritual awareness & anxiety relief",
                traditionalUse: "Replacing negative thought patterns with positive ones, calming overactive mind",
            };

        case "meditate":
            return {
                frequencyHz: 963,
                description: "Divine consciousness & spiritual awakening",
                traditionalUse: "Deep meditation, pineal gland activation, unity with cosmos",
            };

        case "wake-up":
        case "coffee-replacement":
            return {
                frequencyHz: 396,
                description: "Liberation from fear & guilt",
                traditionalUse: "Motivational energy, dispelling fear-based emotions, courage and positivity",
            };

        case "creativity":
            return {
                frequencyHz: 741,
                description: "Awakening intuition & expression",
                traditionalUse: "Mental stimulation and creativity, clear communication",
            };

        case "pre-performance":
            return {
                frequencyHz: 528,
                description: "Transformation & love",
                traditionalUse: "Confidence, heart-opening feelings, deep serenity",
            };

        default:
            // For other goalTags, return null to use binaural beats (default behavior)
            return null;
    }
}

/**
 * Get human-readable frequency description
 */
export function getFrequencyDescription(frequencyHz: number, brainwaveState: string): string {
    return `${frequencyHz} Hz ${brainwaveState} waves`;
}

/**
 * Get human-readable solfeggio description
 */
export function getSolfeggioDescription(frequencyHz: number): string {
    const solfeggioMap: Record<number, string> = {
        174: "Foundation & Healing",
        285: "Tissue Restoration",
        396: "Liberation from Fear & Guilt",
        417: "Facilitating Change",
        528: "Transformation & Love (Miracle Tone)",
        639: "Harmonious Relationships",
        741: "Awakening Intuition & Expression",
        852: "Spiritual Awareness & Anxiety Relief",
        963: "Divine Consciousness",
        40: "Lower frequency",
    };
    
    return solfeggioMap[frequencyHz] || `${frequencyHz} Hz Solfeggio`;
}

