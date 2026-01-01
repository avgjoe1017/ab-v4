/**
 * Database Migration Script: SQLite → Postgres
 * 
 * Phase 6.2: Migrate data from SQLite to Postgres
 * 
 * Usage:
 * 1. Set DATABASE_URL_POSTGRES environment variable
 * 2. Keep DATABASE_URL pointing to SQLite
 * 3. Run: bun apps/api/prisma/migrate-to-postgres.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientPostgres } from "@prisma/client";

// SQLite connection (current)
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "file:./dev.db",
    },
  },
});

// Postgres connection (target)
const postgresUrl = process.env.DATABASE_URL_POSTGRES;
if (!postgresUrl) {
  console.error("❌ DATABASE_URL_POSTGRES environment variable is required");
  console.error("Example: DATABASE_URL_POSTGRES=postgresql://user:password@host:5432/database");
  process.exit(1);
}

const postgresClient = new PrismaClient({
  datasources: {
    db: {
      url: postgresUrl,
    },
  },
});

async function migrateTable<T>(
  tableName: string,
  sqliteData: T[],
  insertFn: (data: T) => Promise<any>
): Promise<number> {
  console.log(`\n📦 Migrating ${tableName}...`);
  console.log(`   Found ${sqliteData.length} records`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const record of sqliteData) {
    try {
      await insertFn(record);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Error migrating record:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`   ✅ Migrated ${successCount} records`);
  if (errorCount > 0) {
    console.log(`   ⚠️  ${errorCount} errors`);
  }
  
  return successCount;
}

async function main() {
  console.log("🚀 Starting database migration: SQLite → Postgres");
  console.log(`📊 Source: SQLite (${process.env.DATABASE_URL})`);
  console.log(`📊 Target: Postgres (${postgresUrl?.replace(/:[^:@]+@/, ":****@")})`);
  
  try {
    // Test connections
    console.log("\n🔌 Testing connections...");
    await sqliteClient.$connect();
    console.log("   ✅ SQLite connected");
    await postgresClient.$connect();
    console.log("   ✅ Postgres connected");
    
    // Migrate Users
    const users = await sqliteClient.user.findMany();
    await migrateTable("User", users, async (user) => {
      await postgresClient.user.upsert({
        where: { id: user.id },
        update: user,
        create: user,
      });
    });
    
    // Migrate Sessions
    const sessions = await sqliteClient.session.findMany();
    await migrateTable("Session", sessions, async (session) => {
      await postgresClient.session.upsert({
        where: { id: session.id },
        update: session,
        create: session,
      });
    });
    
    // Migrate SessionAffirmations
    const affirmations = await sqliteClient.sessionAffirmation.findMany();
    await migrateTable("SessionAffirmation", affirmations, async (affirmation) => {
      await postgresClient.sessionAffirmation.upsert({
        where: { id: affirmation.id },
        update: affirmation,
        create: affirmation,
      });
    });
    
    // Migrate UserValues
    const userValues = await sqliteClient.userValue.findMany();
    await migrateTable("UserValue", userValues, async (userValue) => {
      await postgresClient.userValue.upsert({
        where: { id: userValue.id },
        update: userValue,
        create: userValue,
      });
    });
    
    // Migrate AudioAssets
    const audioAssets = await sqliteClient.audioAsset.findMany();
    await migrateTable("AudioAsset", audioAssets, async (asset) => {
      await postgresClient.audioAsset.upsert({
        where: { kind_hash: { kind: asset.kind, hash: asset.hash } },
        update: asset,
        create: asset,
      });
    });
    
    // Migrate SessionAudio
    const sessionAudios = await sqliteClient.sessionAudio.findMany();
    await migrateTable("SessionAudio", sessionAudios, async (sessionAudio) => {
      await postgresClient.sessionAudio.upsert({
        where: { sessionId: sessionAudio.sessionId },
        update: sessionAudio,
        create: sessionAudio,
      });
    });
    
    // Migrate Jobs
    const jobs = await sqliteClient.job.findMany();
    await migrateTable("Job", jobs, async (job) => {
      await postgresClient.job.upsert({
        where: { id: job.id },
        update: job,
        create: job,
      });
    });
    
    // Verify counts
    console.log("\n✅ Migration complete! Verifying...");
    const sqliteCounts = {
      users: await sqliteClient.user.count(),
      sessions: await sqliteClient.session.count(),
      affirmations: await sqliteClient.sessionAffirmation.count(),
      userValues: await sqliteClient.userValue.count(),
      audioAssets: await sqliteClient.audioAsset.count(),
      sessionAudios: await sqliteClient.sessionAudio.count(),
      jobs: await sqliteClient.job.count(),
    };
    
    const postgresCounts = {
      users: await postgresClient.user.count(),
      sessions: await postgresClient.session.count(),
      affirmations: await postgresClient.sessionAffirmation.count(),
      userValues: await postgresClient.userValue.count(),
      audioAssets: await postgresClient.audioAsset.count(),
      sessionAudios: await postgresClient.sessionAudio.count(),
      jobs: await postgresClient.job.count(),
    };
    
    console.log("\n📊 Record Counts:");
    console.log("   Table          | SQLite | Postgres | Match");
    console.log("   ---------------|--------|----------|------");
    for (const [table, sqliteCount] of Object.entries(sqliteCounts)) {
      const postgresCount = postgresCounts[table as keyof typeof postgresCounts];
      const match = sqliteCount === postgresCount ? "✅" : "❌";
      console.log(`   ${table.padEnd(14)} | ${String(sqliteCount).padStart(6)} | ${String(postgresCount).padStart(8)} | ${match}`);
    }
    
    console.log("\n🎉 Migration completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sqliteClient.$disconnect();
    await postgresClient.$disconnect();
  }
}

main();

