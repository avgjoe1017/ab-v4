import { UUID } from "@ab/contracts";
import crypto from "crypto";
import { prisma } from "../src/lib/db";
import { pregenerateSilenceChunks } from "../src/services/audio/generation";
import { getFrequencyForGoalTag } from "@ab/contracts";

// Helper to compute affirmations hash (consistent with API logic)
function computeAffirmationsHash(affirmations: readonly string[]): string {
    return crypto.createHash("sha256").update(affirmations.join("|")).digest("hex");
}

// Helper to flatten session structure from JSON (opener, beginner_ramp, core, closing)
function flattenAffirmations(session: {
    opener: string[];
    beginner_ramp: [string, string][];
    core: [string, string][];
    closing: string[];
}): string[] {
    const affirmations: string[] = [];
    
    // Add opener
    affirmations.push(...session.opener);
    
    // Add beginner_ramp (each pair becomes two affirmations)
    for (const [a, b] of session.beginner_ramp) {
        affirmations.push(a, b);
    }
    
    // Add core (each pair becomes two affirmations)
    for (const [a, b] of session.core) {
        affirmations.push(a, b);
    }
    
    // Add closing
    affirmations.push(...session.closing);
    
    return affirmations;
}

// Phase 3.1: Catalog Content - All 8 session types from roadmap
const CATALOG_SESSIONS = [
    // 1. Wake Up (14-20 Hz Beta) - Energy, intention, capability
    {
        title: "Wake Up",
        id: "1c261e4b-7009-482a-928e-5b1b46700c99", // Fixed UUID
        affirmations: [
            "I am ready to seize the day with energy and intention.",
            "I have the capability to accomplish what matters to me.",
            "Today is full of opportunity, and I am prepared to meet it.",
            "I wake up with clarity and purpose.",
        ],
        voiceId: "alloy",
        goalTag: "wake-up",
    },
    // 2. Meditate (7-8 Hz Alpha) - Presence, peace, awareness
    {
        title: "Meditate",
        id: "2d372f5c-8110-593b-a39f-6c2c57811d00", // Fixed UUID
        affirmations: [
            "I am present in this moment, fully aware and at peace.",
            "My mind settles into stillness and clarity.",
            "I observe my thoughts without judgment or attachment.",
            "I find peace within myself, right here and now.",
        ],
        voiceId: "shimmer",
        goalTag: "meditate",
    },
    // 3. Focus (12-15 Hz SMR) - Clarity, concentration, flow
    {
        title: "Focus",
        id: "9e5c6020-0063-41ec-b8f4-604719b48f61", // Fixed UUID
        affirmations: [
            "I am sharp and focused, distractions fall away naturally.",
            "My concentration deepens as I engage with my work.",
            "I enter a state of flow where clarity and ease meet.",
            "I accomplish my goals with sustained attention and precision.",
        ],
        voiceId: "onyx",
        goalTag: "focus",
    },
    // 4. Sleep (2-4 Hz Delta) - Release, safety, rest
    {
        title: "Sleep",
        id: "5b53366c-48e8-4672-a420-9430c4436577", // Fixed UUID
        affirmations: [
            "I am letting go of the day, releasing all that no longer serves me.",
            "My mind is at peace, and my body feels safe and supported.",
            "I sleep deeply and soundly, restoring my body and mind.",
            "I drift into restful sleep, knowing I am safe and cared for.",
        ],
        voiceId: "shimmer",
        goalTag: "sleep",
    },
    // 5. Pre-Performance (10-12 Hz Alpha) - Confidence, readiness, calm
    {
        title: "Pre-Performance",
        id: "6c64477d-59f9-6843-b531-7654d5547688", // Fixed UUID
        affirmations: [
            "I am confident in my abilities and ready to perform.",
            "I feel calm and prepared, trusting my preparation and skill.",
            "I channel my energy into focused, confident action.",
            "I step forward with readiness and self-assurance.",
        ],
        voiceId: "alloy",
        goalTag: "pre-performance",
    },
    // 6. Anxiety Relief (10 Hz Alpha) - Safety, grounding, control
    {
        title: "Anxiety Relief",
        id: "b2c3d4e5-f6a7-8901-bcde-f12345678901", // Fixed UUID
        affirmations: [
            "I am safe in this moment, grounded and present.",
            "I can name what I feel without feeding my anxiety.",
            "I have control over my response, even when I feel uncertain.",
            "I breathe into calm, releasing tension and worry.",
        ],
        voiceId: "alloy",
        goalTag: "anxiety",
    },
    // 7. Creativity (6-10 Hz Theta-Alpha) - Openness, curiosity, expression
    {
        title: "Creativity",
        id: "7d75588e-6a0a-7954-c642-8765e6658799", // Fixed UUID
        affirmations: [
            "I am open to new ideas and creative possibilities.",
            "My curiosity guides me to explore and express freely.",
            "I trust my creative intuition and let inspiration flow.",
            "I express myself authentically, without fear or judgment.",
        ],
        voiceId: "nova",
        goalTag: "creativity",
    },
    // 8. Coffee Replacement (18-25 Hz Beta) - Alertness, energy, vitality
    {
        title: "Coffee Replacement",
        id: "8e86699f-7b1b-8a65-d753-9876f7769800", // Fixed UUID
        affirmations: [
            "I feel alert and energized, naturally awake and vital.",
            "My mind is sharp and clear, ready for the day ahead.",
            "I have the energy I need to accomplish what matters.",
            "I am fully present and engaged, feeling vibrant and alive.",
        ],
        voiceId: "onyx",
        goalTag: "coffee-replacement",
    },
] as const;

async function main() {
    console.log("🌱 Starting seed process...");

    // V3 Compliance: Pre-generate silence chunks first
    await pregenerateSilenceChunks();

    console.log("🌱 Seeding catalog sessions...");

    for (const s of CATALOG_SESSIONS) {
        const existing = await prisma.session.findUnique({ where: { id: s.id } });
        if (!existing) {
            console.log(`Creating: ${s.title}`);
            
            // V3 Compliance: Compute real hash, enforce pace="slow", remove durationSec/affirmationSpacingMs
            const affirmationsHash = computeAffirmationsHash([...s.affirmations]);
            
            // Phase 4.1: Get frequency info for this session type
            const frequencyInfo = getFrequencyForGoalTag(s.goalTag);
            
            await prisma.session.create({
                data: {
                    id: s.id,
                    title: s.title,
                    source: "catalog",
                    ownerUserId: null,
                    durationSec: null, // V3: Infinite sessions (no fixed duration)
                    voiceId: s.voiceId,
                    pace: "slow", // V3: pace is always "slow"
                    affirmationSpacingMs: null, // V3: Fixed internally, not user-controlled
                    goalTag: s.goalTag,
                    affirmationsHash, // Real computed hash
                    frequencyHz: frequencyInfo.frequencyHz,
                    brainwaveState: frequencyInfo.brainwaveState,
                    // Create SessionAffirmations for completeness
                    affirmations: {
                        create: s.affirmations.map((text, idx) => ({
                            idx,
                            text,
                        })),
                    },
                },
            });
        } else {
            console.log(`Skipping (exists): ${s.title}`);
        }
    }

    console.log("✅ Seeding complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
