/**
 * Script to generate catalog session affirmations using OpenAI
 * Run with: bun apps/api/prisma/generate-catalog-affirmations.ts
 */

import { generateAffirmations } from "../src/services/affirmation-generator";

const CATALOG_SESSION_TYPES = [
    {
        title: "Wake Up",
        goalTag: "wake-up",
        sessionType: "Wake Up",
        description: "Energy, intention, capability",
        binauralHz: "14-20 Hz (Beta)",
    },
    {
        title: "Meditate",
        goalTag: "meditate",
        sessionType: "Meditate",
        description: "Presence, peace, awareness",
        binauralHz: "7-8 Hz (Alpha)",
    },
    {
        title: "Focus",
        goalTag: "focus",
        sessionType: "Focus",
        description: "Clarity, concentration, flow",
        binauralHz: "12-15 Hz (SMR)",
    },
    {
        title: "Sleep",
        goalTag: "sleep",
        sessionType: "Sleep",
        description: "Release, safety, rest",
        binauralHz: "2-4 Hz (Delta)",
    },
    {
        title: "Pre-Performance",
        goalTag: "pre-performance",
        sessionType: "Pre-Performance",
        description: "Confidence, readiness, calm",
        binauralHz: "10-12 Hz (Alpha)",
    },
    {
        title: "Anxiety Relief",
        goalTag: "anxiety",
        sessionType: "Anxiety Relief",
        description: "Safety, grounding, control",
        binauralHz: "10 Hz (Alpha)",
    },
    {
        title: "Creativity",
        goalTag: "creativity",
        sessionType: "Creativity",
        description: "Openness, curiosity, expression",
        binauralHz: "6-10 Hz (Theta-Alpha)",
    },
    {
        title: "Coffee Replacement",
        goalTag: "coffee-replacement",
        sessionType: "Coffee Replacement",
        description: "Alertness, energy, vitality",
        binauralHz: "18-25 Hz (Beta)",
    },
] as const;

async function main() {
    console.log("🤖 Generating catalog affirmations with OpenAI...\n");

    const results: Array<{
        title: string;
        goalTag: string;
        affirmations: string[];
    }> = [];

    for (const session of CATALOG_SESSION_TYPES) {
        console.log(`Generating affirmations for: ${session.title} (${session.description})`);
        
        try {
            const result = await generateAffirmations({
                values: [], // Generic affirmations (no user values)
                sessionType: session.sessionType,
                count: 4, // 4 affirmations per session
            });

            results.push({
                title: session.title,
                goalTag: session.goalTag,
                affirmations: result.affirmations,
            });

            console.log(`  ✓ Generated ${result.affirmations.length} affirmations`);
            result.affirmations.forEach((aff, idx) => {
                console.log(`    ${idx + 1}. ${aff}`);
            });
            console.log();
        } catch (error) {
            console.error(`  ✗ Error generating affirmations for ${session.title}:`, error);
            console.log();
        }
    }

    console.log("\n📋 Generated Affirmations Summary:\n");
    console.log(JSON.stringify(results, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });

