/**
 * Script to seed beginner affirmation sessions and generate their audio
 * Run this after ensuring TTS_PROVIDER=elevenlabs and ELEVENLABS_API_KEY are set
 */

import { prisma } from "../src/lib/db";
import { processEnsureAudioJob } from "../src/services/audio/generation";

const BEGINNER_SESSION_IDS = [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // EASE IN
    "f1e2d3c4-b5a6-9876-5432-10fedcba0987", // CALM DOWN FAST (fixed: was duplicate of seed.ts Anxiety Relief)
    "c3d4e5f6-a7b8-9012-cdef-123456789012", // HARD DAY, STRONG ME
    "d4e5f6a7-b8c9-0123-defa-234567890123", // DO THE NEXT RIGHT THING
];

async function main() {
    console.log("🎙️  Generating audio for beginner affirmation sessions...");
    console.log("⚠️  Make sure TTS_PROVIDER=elevenlabs and ELEVENLABS_API_KEY are set in .env");

    for (const sessionId of BEGINNER_SESSION_IDS) {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { 
                audio: true,
                affirmations: { orderBy: { idx: "asc" } },
            },
        });

        if (!session) {
            console.log(`❌ Session ${sessionId} not found. Run seed first.`);
            continue;
        }

        if (session.audio) {
            console.log(`✅ ${session.title} - Audio already exists, skipping`);
            continue;
        }

        console.log(`\n🎤 Generating audio for: ${session.title}`);
        console.log(`   Session ID: ${sessionId}`);
        console.log(`   Affirmations: ${session.affirmations.length} (will be processed)`);
        console.log(`   Voice: ${session.voiceId}`);

        try {
            await processEnsureAudioJob({ sessionId });
            console.log(`✅ ${session.title} - Audio generation complete`);
        } catch (error: any) {
            console.error(`❌ ${session.title} - Failed:`, error.message);
            console.error(`   Error details:`, error);
        }
    }

    console.log("\n✅ All beginner sessions processed");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
