/**
 * Remove specific catalog sessions from database
 * Removes: "Focus Boost", "Sleep & Relax", "Morning Affirmations"
 */

import { prisma } from "../src/lib/db.js";

const SESSIONS_TO_REMOVE = [
  "Focus Boost",
  "Sleep & Relax", 
  "Morning Affirmations"
];

async function removeSessions() {
  console.log("🗑️  Removing sessions from database...\n");

  for (const title of SESSIONS_TO_REMOVE) {
    console.log(`Looking for session: "${title}"`);
    
    // Find sessions by title (SQLite doesn't support case-insensitive, so we'll filter manually)
    const allSessions = await prisma.session.findMany({
      include: {
        affirmations: true,
        audio: true
      }
    });
    
    // Filter case-insensitively
    const sessions = allSessions.filter(s => 
      s.title.toLowerCase().includes(title.toLowerCase())
    );

    if (sessions.length === 0) {
      console.log(`   ⚠️  No sessions found with title "${title}"`);
    } else {
      for (const session of sessions) {
        console.log(`   Found: ${session.title} (ID: ${session.id})`);
        
        // Delete session (cascades to affirmations and audio)
        await prisma.session.delete({
          where: { id: session.id }
        });
        
        console.log(`   ✅ Deleted session: ${session.title}`);
      }
    }
  }

  // Also check for sessions with matching goalTags if titles don't match
  const goalTagsToCheck = ["focus", "sleep", "morning", "wake-up"];
  console.log("\nChecking for sessions with goalTags: focus, sleep, morning, wake-up");
  
  for (const goalTag of goalTagsToCheck) {
    const sessions = await prisma.session.findMany({
      where: {
        goalTag: goalTag,
        source: "catalog"
      },
      include: {
        affirmations: true,
        audio: true
      }
    });

    if (sessions.length > 0) {
      console.log(`\nFound ${sessions.length} catalog session(s) with goalTag "${goalTag}":`);
      for (const session of sessions) {
        // Check if title matches what we want to remove
        const shouldRemove = SESSIONS_TO_REMOVE.some(removeTitle => 
          session.title.toLowerCase().includes(removeTitle.toLowerCase()) ||
          (goalTag === "focus" && session.title.toLowerCase().includes("focus")) ||
          (goalTag === "sleep" && (session.title.toLowerCase().includes("sleep") || session.title.toLowerCase().includes("relax"))) ||
          (goalTag === "morning" || goalTag === "wake-up") && (session.title.toLowerCase().includes("morning") || session.title.toLowerCase().includes("wake"))
        );

        if (shouldRemove) {
          console.log(`   Deleting: ${session.title} (ID: ${session.id})`);
          await prisma.session.delete({
            where: { id: session.id }
          });
          console.log(`   ✅ Deleted`);
        } else {
          console.log(`   Keeping: ${session.title} (doesn't match removal criteria)`);
        }
      }
    }
  }

  console.log("\n✅ Session removal complete!");
}

removeSessions()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

