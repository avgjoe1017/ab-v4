/**
 * Voice Activity Ducking
 * Uses server-computed voice activity segments to duck background/binaural during speech
 */

export interface VoiceActivitySegment {
    startMs: number;
    endMs: number;
}

export interface DuckingConfig {
    lookaheadMs: number;      // Start ducking slightly before speech
    attackMs: number;         // Attack time for ducking
    releaseMs: number;        // Release time after speech ends
    minDuckIntervalMs: number; // Ignore micro-blips shorter than this
    backgroundDuckDb: number;  // Background duck amount in dB
    binauralDuckDb: number;   // Binaural duck amount in dB
}

const DEFAULT_CONFIG: DuckingConfig = {
    lookaheadMs: 80,
    attackMs: 90,
    releaseMs: 350,
    minDuckIntervalMs: 120,
    backgroundDuckDb: -4,  // -4 dB for background
    binauralDuckDb: -2,    // -2 dB for binaural
};

export class VoiceActivityDucker {
    private segments: VoiceActivitySegment[];
    private config: DuckingConfig;
    private backgroundMultiplier: number = 1.0;
    private binauralMultiplier: number = 1.0;
    private currentSegmentIndex: number = 0; // Pointer optimization: O(1) instead of O(n)

    constructor(segments: VoiceActivitySegment[] = [], config: Partial<DuckingConfig> = {}) {
        // Sort segments by start time for pointer optimization
        this.segments = [...segments].sort((a, b) => a.startMs - b.startMs);
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        // Convert dB to linear multipliers
        // -4 dB = 10^(-4/20) ≈ 0.63
        // -2 dB = 10^(-2/20) ≈ 0.79
        const bgTarget = Math.pow(10, this.config.backgroundDuckDb / 20);
        const binTarget = Math.pow(10, this.config.binauralDuckDb / 20);
        
        // Initialize multipliers (will be smoothed)
        this.backgroundMultiplier = 1.0;
        this.binauralMultiplier = 1.0;
        this.currentSegmentIndex = 0;
    }

    /**
     * Check if voice is active at given position (with lookahead)
     * Optimized: Uses pointer to avoid linear scan (O(1) average case instead of O(n))
     */
    private isVoiceActive(positionMs: number): boolean {
        const checkPos = positionMs + this.config.lookaheadMs;
        
        // Advance pointer past segments we've already passed
        while (this.currentSegmentIndex < this.segments.length) {
            const segment = this.segments[this.currentSegmentIndex];
            
            // If we're past this segment, move to next
            if (checkPos > segment.endMs) {
                this.currentSegmentIndex++;
                continue;
            }
            
            // If we're before this segment, no match yet
            if (checkPos < segment.startMs) {
                return false;
            }
            
            // We're inside this segment
            if (checkPos >= segment.startMs && checkPos <= segment.endMs) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Update ducking multipliers based on current position
     * Returns multipliers for background and binaural
     */
    update(positionMs: number, dtMs: number): { background: number; binaural: number } {
        const isActive = this.isVoiceActive(positionMs);
        
        // Target multipliers
        const bgTarget = isActive 
            ? Math.pow(10, this.config.backgroundDuckDb / 20)  // Duck to -4 dB
            : 1.0;
        const binTarget = isActive
            ? Math.pow(10, this.config.binauralDuckDb / 20)    // Duck to -2 dB
            : 1.0;

        // Smooth toward targets
        const tauMs = isActive ? this.config.attackMs : this.config.releaseMs;
        const alpha = 1 - Math.exp(-dtMs / tauMs);
        
        this.backgroundMultiplier += (bgTarget - this.backgroundMultiplier) * alpha;
        this.binauralMultiplier += (binTarget - this.binauralMultiplier) * alpha;

        return {
            background: this.backgroundMultiplier,
            binaural: this.binauralMultiplier,
        };
    }

    /**
     * Reset ducking state
     */
    reset(): void {
        this.backgroundMultiplier = 1.0;
        this.binauralMultiplier = 1.0;
        this.currentSegmentIndex = 0; // Reset pointer
    }
}
