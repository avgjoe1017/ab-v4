/**
 * Check S3 Files Status
 * 
 * This script checks:
 * 1. What audio files are in the database
 * 2. What files are actually in S3
 * 3. Which files need to be migrated
 */

import { getS3Client, getS3Config, isS3Configured } from "./src/services/storage/s3.js";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { prisma } from "./src/lib/db.js";

async function checkS3Files() {
  console.log("🔍 Checking S3 Files Status\n");

  // Check S3 configuration
  if (!isS3Configured()) {
    console.error("❌ S3 is not configured!");
    process.exit(1);
  }
  console.log("✅ S3 is configured\n");

  const config = getS3Config();
  const s3Client = getS3Client();
  
  if (!config || !s3Client) {
    console.error("❌ Failed to get S3 configuration or client");
    process.exit(1);
  }

  // 1. Check database for audio assets
  console.log("1. Checking database for audio assets...");
  const audioAssets = await prisma.audioAsset.findMany({
    where: {
      kind: "affirmationMerged"
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  console.log(`   Found ${audioAssets.length} merged audio assets in database\n`);

  let s3Count = 0;
  let localCount = 0;
  const s3Urls: string[] = [];
  const localPaths: string[] = [];

  audioAssets.forEach((asset, index) => {
    const isS3 = asset.url.startsWith("http://") || asset.url.startsWith("https://");
    if (isS3) {
      s3Count++;
      s3Urls.push(asset.url);
      console.log(`   ${index + 1}. ✅ S3: ${asset.url}`);
    } else {
      localCount++;
      localPaths.push(asset.url);
      console.log(`   ${index + 1}. 📁 Local: ${asset.url}`);
    }
  });

  console.log(`\n   Summary: ${s3Count} in S3, ${localCount} local files\n`);

  // 2. Check S3 bucket for actual files
  console.log("2. Checking S3 bucket for files...");
  let s3Files: any[] = [];
  try {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: "audio/affirmationMerged/",
    });

    const response = await s3Client.send(command);
    s3Files = response.Contents || [];

    console.log(`   Found ${s3Files.length} files in S3 bucket\n`);

    if (s3Files.length > 0) {
      console.log("   S3 Files:");
      s3Files.slice(0, 10).forEach((file, index) => {
        const sizeKB = ((file.Size || 0) / 1024).toFixed(2);
        const lastModified = file.LastModified?.toLocaleString() || "Unknown";
        console.log(`   ${index + 1}. ${file.Key} (${sizeKB} KB, modified: ${lastModified})`);
      });
      if (s3Files.length > 10) {
        console.log(`   ... and ${s3Files.length - 10} more files`);
      }
    } else {
      console.log("   ⚠️  No files found in S3 bucket");
      console.log("   This means no audio has been uploaded to S3 yet");
    }
  } catch (error: any) {
    console.error(`   ❌ Error listing S3 files: ${error.message}`);
    s3Files = [];
  }

  // 3. Compare database vs S3
  console.log("\n3. Analysis:");
  console.log(`   Database has ${audioAssets.length} audio assets`);
  console.log(`   - ${s3Count} with S3 URLs`);
  console.log(`   - ${localCount} with local paths`);
  console.log(`   S3 bucket has ${s3Files.length} files`);

  if (localCount > 0) {
    console.log(`\n   ⚠️  ${localCount} files need to be migrated to S3`);
    console.log("   These will be automatically migrated when:");
    console.log("   - The session audio is regenerated");
    console.log("   - Or you can manually trigger migration");
  }

  if (s3Count > 0 && s3Files.length === 0) {
    console.log("\n   ⚠️  Database has S3 URLs but S3 bucket is empty");
    console.log("   This might indicate a configuration issue");
  }

  if (s3Count > 0 && s3Files.length > 0) {
    console.log("\n   ✅ S3 integration is working!");
    console.log("   Files are being uploaded to S3 successfully");
  }

  console.log("\n✅ Check Complete!");
}

checkS3Files().catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});

