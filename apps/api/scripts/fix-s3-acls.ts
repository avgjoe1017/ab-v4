/**
 * Fix S3 ACLs for existing audio files
 * 
 * This script updates all audio files in S3 to have public-read ACL
 * Run with: bun scripts/fix-s3-acls.ts
 */

import { S3Client, ListObjectsV2Command, PutObjectAclCommand } from "@aws-sdk/client-s3";

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

  console.log(`Fixing ACLs for bucket: ${bucketName} in region: ${region}`);

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // List all objects in the audio/ prefix
  let continuationToken: string | undefined;
  let totalFixed = 0;
  let totalErrors = 0;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: "audio/",
      ContinuationToken: continuationToken,
    });

    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    console.log(`Found ${objects.length} objects in this batch`);

    for (const obj of objects) {
      if (!obj.Key) continue;

      try {
        const aclCommand = new PutObjectAclCommand({
          Bucket: bucketName,
          Key: obj.Key,
          ACL: "public-read",
        });

        await s3Client.send(aclCommand);
        console.log(`✅ Fixed ACL for: ${obj.Key}`);
        totalFixed++;
      } catch (error: any) {
        console.error(`❌ Failed to fix ACL for ${obj.Key}:`, error.message);
        totalErrors++;
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  console.log("\n=== Summary ===");
  console.log(`Total fixed: ${totalFixed}`);
  console.log(`Total errors: ${totalErrors}`);

  // Test one of the files
  if (totalFixed > 0) {
    console.log("\nTesting public access...");
    const testUrl = `https://${bucketName}.s3.${region}.amazonaws.com/audio/affirmationMerged/`;
    console.log(`You can test by accessing files at: ${testUrl}<hash>.m4a`);
  }
}

main().catch(console.error);

