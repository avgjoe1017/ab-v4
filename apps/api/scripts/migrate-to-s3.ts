/**
 * Migration Script: Upload existing local audio files to S3
 * 
 * This script:
 * 1. Finds all audio assets with local file paths
 * 2. Uploads them to S3
 * 3. Updates database with S3 URLs
 * 4. Preserves local files as backup
 */

import { prisma } from "../src/lib/db.js";
import { uploadToS3, generateS3Key, isS3Configured, getS3Config } from "../src/services/storage/s3.js";
import fs from "fs-extra";
import path from "path";

async function migrateToS3() {
  console.log("🚀 Starting S3 Migration\n");

  // Check S3 configuration
  if (!isS3Configured()) {
    console.error("❌ S3 is not configured!");
    console.error("Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME");
    process.exit(1);
  }

  const config = getS3Config();
  if (!config) {
    console.error("❌ Failed to get S3 configuration");
    process.exit(1);
  }

  console.log(`✅ S3 configured: ${config.bucket} (${config.region})\n`);

  // Find all audio assets with local paths
  console.log("1. Finding local audio assets...");
  const audioAssets = await prisma.audioAsset.findMany({
    where: {
      kind: "affirmationMerged",
      url: {
        not: {
          startsWith: "http"
        }
      }
    }
  });

  console.log(`   Found ${audioAssets.length} local audio assets\n`);

  if (audioAssets.length === 0) {
    console.log("✅ No files to migrate!");
    return;
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Process each asset
  for (let i = 0; i < audioAssets.length; i++) {
    const asset = audioAssets[i];
    console.log(`\n[${i + 1}/${audioAssets.length}] Processing: ${asset.hash}`);

    // Check if file exists
    const filePath = asset.url;
    const fileExists = await fs.pathExists(filePath);

    if (!fileExists) {
      console.log(`   ⚠️  File not found: ${filePath}`);
      console.log(`   ⚠️  Skipping (file may have been deleted)`);
      skipCount++;
      continue;
    }

    // Check if already in S3 (shouldn't happen based on query, but double-check)
    if (asset.url.startsWith("http://") || asset.url.startsWith("https://")) {
      console.log(`   ⚏ Already in S3: ${asset.url}`);
      skipCount++;
      continue;
    }

    try {
      // Determine file extension from path
      const ext = path.extname(filePath).slice(1) || "mp3";
      
      // Generate S3 key
      const s3Key = generateS3Key("affirmationMerged", asset.hash, ext);
      console.log(`   📤 Uploading to S3: ${s3Key}`);

      // Upload to S3
      const s3Url = await uploadToS3(filePath, {
        key: s3Key,
        contentType: ext === "m4a" ? "audio/mp4" : "audio/mpeg",
        cacheControl: "public, max-age=31536000", // 1 year cache
      });

      console.log(`   ✅ Uploaded: ${s3Url}`);

      // Update database with S3 URL
      await prisma.audioAsset.update({
        where: { id: asset.id },
        data: { url: s3Url }
      });

      console.log(`   ✅ Database updated`);
      successCount++;

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
      
      // Continue with next file even if this one fails
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ⚏ Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📁 Total processed: ${audioAssets.length}`);
  console.log("=".repeat(50));

  if (successCount > 0) {
    console.log("\n✅ Migration complete!");
    console.log("\n📝 Next steps:");
    console.log("   - Verify files in S3 bucket");
    console.log("   - Test playback bundle URLs");
    console.log("   - (Optional) Clean up local files after verification");
  } else if (errorCount > 0) {
    console.log("\n⚠️  Migration completed with errors");
    console.log("   Check error messages above for details");
  }
}

migrateToS3()
  .catch((e) => {
    console.error("\n❌ Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

