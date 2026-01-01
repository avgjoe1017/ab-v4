/**
 * Gain Smoothing
 * One-pole smoothing with separate attack/release times
 * Prevents zipper noise and volume steps
 */

export interface GainSmootherConfig {
    attackMs: number;
    releaseMs: number;
}

export class GainSmoother {
    private current: number = 0;
    private target: number = 0;
    private config: GainSmootherConfig;

    constructor(config: GainSmootherConfig) {
        this.config = config;
    }

    /**
     * Set target gain (0..1)
     */
    setTarget(target: number): void {
        this.target = Math.max(0, Math.min(1, target));
    }

    /**
     * Get current smoothed gain
     */
    getCurrent(): number {
        return this.current;
    }

    /**
     * Update smoother based on elapsed time
     * Returns new current value
     */
    update(dtMs: number): number {
        const diff = this.target - this.current;
        
        if (Math.abs(diff) < 0.001) {
            // Close enough, snap to target
            this.current = this.target;
            return this.current;
        }

        // Choose attack or release time constant
        const tauMs = diff > 0 ? this.config.attackMs : this.config.releaseMs;
        
        // One-pole smoothing: alpha = 1 - exp(-dt / tau)
        const alpha = 1 - Math.exp(-dtMs / tauMs);
        this.current += diff * alpha;

        return this.current;
    }

    /**
     * Reset to a specific value immediately
     */
    reset(value: number): void {
        this.current = value;
        this.target = value;
    }
}
