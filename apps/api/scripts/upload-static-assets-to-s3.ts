/**
 * Upload static audio assets (binaural, background) to S3
 * 
 * This allows iOS to load them via HTTPS, avoiding ATS issues
 * 
 * Run with: bun scripts/upload-static-assets-to-s3.ts
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs-extra";
import path from "path";

async function main() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || "us-east-2";

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    console.error("Missing required environment variables:");
    console.error("  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME");
    process.exit(1);
  }

  console.log(`Uploading static assets to bucket: ${bucketName} in region: ${region}`);

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Assets directory (relative to apps/api)
  const assetsDir = path.resolve(process.cwd(), "..", "assets", "audio");
  console.log(`Assets directory: ${assetsDir}`);

  // Define assets to upload
  const assets = [
    // Binaural beats
    { localPath: "binaural/alpha_10hz_400_3min.m4a", s3Key: "audio/binaural/alpha_10hz_400_3min.m4a" },
    // Background music
    { localPath: "background/looped/Babbling Brook.m4a", s3Key: "audio/background/Babbling Brook.m4a" },
  ];

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const asset of assets) {
    const localPath = path.join(assetsDir, asset.localPath);
    const s3Key = asset.s3Key;

    console.log(`\nProcessing: ${asset.localPath}`);

    // Check if local file exists
    if (!await fs.pathExists(localPath)) {
      console.log(`  ❌ Local file not found: ${localPath}`);
      errors++;
      continue;
    }

    // Always upload (overwrite if exists) to ensure latest optimized version is used
    // Note: We could check file size/ETag to skip if identical, but for now we'll always upload

    // Upload to S3
    try {
      const fileBuffer = await fs.readFile(localPath);
      const stats = await fs.stat(localPath);
      
      console.log(`  📤 Uploading ${(stats.size / 1024 / 1024).toFixed(2)} MB...`);
      
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: "audio/mp4",
        CacheControl: "public, max-age=31536000",
      }));
      
      console.log(`  ✅ Uploaded to: s3://${bucketName}/${s3Key}`);
      uploaded++;
    } catch (error: any) {
      console.error(`  ❌ Upload failed:`, error.message);
      errors++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped (already exists): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (uploaded > 0 || skipped > 0) {
    console.log("\n=== URLs ===");
    for (const asset of assets) {
      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${asset.s3Key}`;
      console.log(`${asset.localPath}:`);
      console.log(`  ${url}`);
    }
  }
}

main().catch(console.error);

