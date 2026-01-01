/**
 * Backfill Session Frequencies
 * 
 * Phase 4.1: Update existing sessions with frequencyHz and brainwaveState
 * based on their goalTag
 */

import { prisma } from "../src/lib/db";
import { getFrequencyForGoalTag } from "@ab/contracts";

async function main() {
    console.log("🔄 Backfilling session frequencies...\n");

    const sessions = await prisma.session.findMany({
        where: {
            OR: [
                { frequencyHz: null },
                { brainwaveState: null },
            ],
        },
    });

    console.log(`Found ${sessions.length} sessions without frequency data\n`);

    let updated = 0;
    for (const session of sessions) {
        const frequencyInfo = getFrequencyForGoalTag(session.goalTag);
        
        await prisma.session.update({
            where: { id: session.id },
            data: {
                frequencyHz: frequencyInfo.frequencyHz,
                brainwaveState: frequencyInfo.brainwaveState,
            },
        });

        updated++;
        console.log(`✓ ${session.title}: ${frequencyInfo.brainwaveState} ${frequencyInfo.frequencyHz}Hz`);
    }

    console.log(`\n✅ Updated ${updated} sessions`);
}

main()
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

