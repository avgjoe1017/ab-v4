/**
 * Fix S3 Bucket Policy for public read access
 * 
 * Since the bucket has "Block Public Access" enabled, we need to use a bucket policy
 * instead of object ACLs.
 * 
 * Run with: bun scripts/fix-s3-bucket-policy.ts
 */

import { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand, GetPublicAccessBlockCommand, PutPublicAccessBlockCommand } from "@aws-sdk/client-s3";

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

  console.log(`Configuring bucket: ${bucketName} in region: ${region}`);

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  // Step 1: Check current public access block settings
  console.log("\n=== Step 1: Checking Public Access Block settings ===");
  try {
    const publicAccessBlock = await s3Client.send(new GetPublicAccessBlockCommand({
      Bucket: bucketName,
    }));
    console.log("Current settings:", JSON.stringify(publicAccessBlock.PublicAccessBlockConfiguration, null, 2));
    
    const config = publicAccessBlock.PublicAccessBlockConfiguration;
    if (config?.BlockPublicPolicy || config?.RestrictPublicBuckets) {
      console.log("\n⚠️  Public Access Block is preventing bucket policies.");
      console.log("We need to disable some of these settings to allow public read access.");
      
      // Disable the settings that block bucket policies
      console.log("\nUpdating Public Access Block settings...");
      await s3Client.send(new PutPublicAccessBlockCommand({
        Bucket: bucketName,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true, // Keep ACLs blocked (we use bucket policy instead)
          IgnorePublicAcls: true, // Keep ACLs ignored
          BlockPublicPolicy: false, // Allow bucket policies
          RestrictPublicBuckets: false, // Allow public access via policy
        },
      }));
      console.log("✅ Updated Public Access Block settings");
    }
  } catch (error: any) {
    if (error.name === "NoSuchPublicAccessBlockConfiguration") {
      console.log("No Public Access Block configuration found (bucket allows public access)");
    } else {
      console.error("Error checking public access block:", error.message);
    }
  }

  // Step 2: Get current bucket policy
  console.log("\n=== Step 2: Checking current bucket policy ===");
  try {
    const policyResponse = await s3Client.send(new GetBucketPolicyCommand({
      Bucket: bucketName,
    }));
    console.log("Current policy:", policyResponse.Policy);
  } catch (error: any) {
    if (error.name === "NoSuchBucketPolicy") {
      console.log("No bucket policy exists");
    } else {
      console.error("Error getting policy:", error.message);
    }
  }

  // Step 3: Create a bucket policy for public read access to audio files
  console.log("\n=== Step 3: Creating bucket policy for public audio access ===");
  
  const bucketPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadAudio",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${bucketName}/audio/*`,
      },
    ],
  };

  try {
    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    }));
    console.log("✅ Bucket policy created successfully!");
    console.log("Policy:", JSON.stringify(bucketPolicy, null, 2));
  } catch (error: any) {
    console.error("❌ Failed to create bucket policy:", error.message);
    console.error("\nYou may need to manually configure the bucket in AWS Console:");
    console.error("1. Go to S3 > ab-v3 > Permissions");
    console.error("2. Edit 'Block public access' and uncheck 'Block public and cross-account access to buckets and objects through any public bucket or access point policies'");
    console.error("3. Add the following bucket policy:");
    console.error(JSON.stringify(bucketPolicy, null, 2));
    process.exit(1);
  }

  // Step 4: Test public access
  console.log("\n=== Step 4: Testing public access ===");
  const testKey = "audio/affirmationMerged/5ff4cc9249e72e67e126dff92f47c094106e42a9d4ce394f11f1e3843c682971.m4a";
  const testUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${testKey}`;
  
  console.log(`Testing URL: ${testUrl}`);
  
  try {
    const response = await fetch(testUrl, { method: "HEAD" });
    if (response.ok) {
      console.log(`✅ Public access works! Status: ${response.status}`);
      console.log(`   Content-Type: ${response.headers.get("content-type")}`);
      console.log(`   Content-Length: ${response.headers.get("content-length")}`);
    } else {
      console.log(`❌ Public access failed. Status: ${response.status}`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to test URL:`, error.message);
  }
}

main().catch(console.error);

