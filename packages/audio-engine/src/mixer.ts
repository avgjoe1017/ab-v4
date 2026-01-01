/**
 * Mix Controller
 * Single source of truth for computing target volumes
 * Combines user mix, state multipliers, ducking, automation, and safety ceilings
 */

import type { Mix } from "./types";

export interface MixerInputs {
    userMix: Mix;
    stateMultipliers: {
        affirmations: number;
        binaural: number;
        background: number;
    };
    duckingMultipliers: {
        background: number;
        binaural: number;
    };
    automationMultipliers: {
        affirmations: number;
        binaural: number;
        background: number;
    };
    safetyCeilings: {
        affirmations: number;
        binaural: number;
        background: number;
    };
}

export interface TargetVolumes {
    affirmations: number;
    binaural: number;
    background: number;
}

/**
 * Compute target volumes from all mixer inputs
 * Formula: target = clamp01(userMix * stateMult * duckMult * autoMult) * safetyCeiling
 */
export function computeTargetVolumes(inputs: MixerInputs): TargetVolumes {
    const { userMix, stateMultipliers, duckingMultipliers, automationMultipliers, safetyCeilings } = inputs;

    // Affirmations (no ducking)
    const affTarget = Math.max(0, Math.min(1,
        userMix.affirmations *
        stateMultipliers.affirmations *
        automationMultipliers.affirmations
    )) * safetyCeilings.affirmations;

    // Background (with ducking)
    const bgTarget = Math.max(0, Math.min(1,
        userMix.background *
        stateMultipliers.background *
        duckingMultipliers.background *
        automationMultipliers.background
    )) * safetyCeilings.background;

    // Binaural (with ducking)
    const binTarget = Math.max(0, Math.min(1,
        userMix.binaural *
        stateMultipliers.binaural *
        duckingMultipliers.binaural *
        automationMultipliers.binaural
    )) * safetyCeilings.binaural;

    return {
        affirmations: affTarget,
        binaural: binTarget,
        background: bgTarget,
    };
}

/**
 * Equal-power crossfade curve
 * Returns gain for main (0..1) and preroll (0..1) based on progress
 */
export function equalPowerCrossfade(progress: number): { main: number; preroll: number } {
    const p = Math.max(0, Math.min(1, progress));
    const mainGain = Math.sin(p * Math.PI / 2);
    const prerollGain = Math.cos(p * Math.PI / 2);
    return { main: mainGain, preroll: prerollGain };
}
