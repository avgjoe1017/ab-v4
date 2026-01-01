/**
 * Script to remove test sessions from the database
 * Deletes all sessions with title starting with "Test" or goalTag "General"
 */

import { prisma } from "../src/lib/db";

async function main() {
    console.log("🧹 Cleaning up test sessions...");

    // Find all test sessions
    const testSessions = await prisma.session.findMany({
        where: {
            OR: [
                { title: { startsWith: "Test" } },
                { goalTag: "General" },
            ],
        },
        select: {
            id: true,
            title: true,
            goalTag: true,
        },
    });

    console.log(`Found ${testSessions.length} test sessions to delete:`);
    testSessions.forEach(s => {
        console.log(`  - ${s.title} (${s.goalTag})`);
    });

    if (testSessions.length === 0) {
        console.log("✅ No test sessions found to delete");
        return;
    }

    // Delete test sessions (cascade will handle related records)
    const result = await prisma.session.deleteMany({
        where: {
            OR: [
                { title: { startsWith: "Test" } },
                { goalTag: "General" },
            ],
        },
    });

    console.log(`✅ Deleted ${result.count} test sessions`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
