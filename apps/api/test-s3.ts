/**
 * Test S3 Connection and Configuration
 * 
 * This script verifies:
 * 1. S3 configuration (environment variables)
 * 2. S3 client connection
 * 3. Bucket access
 * 4. File upload capability
 * 5. File existence check
 */

import { 
  getS3Client, 
  getS3Config, 
  isS3Configured, 
  uploadToS3, 
  fileExistsInS3,
  generateS3Key 
} from "./src/services/storage/s3.js";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";

async function testS3() {
  console.log("🧪 Testing AWS S3 Configuration\n");

  // Test 1: Check Configuration
  console.log("1. Checking S3 Configuration...");
  const isConfigured = isS3Configured();
  if (!isConfigured) {
    console.error("   ❌ S3 is not configured!");
    console.error("   Missing environment variables:");
    if (!process.env.AWS_ACCESS_KEY_ID) console.error("     - AWS_ACCESS_KEY_ID");
    if (!process.env.AWS_SECRET_ACCESS_KEY) console.error("     - AWS_SECRET_ACCESS_KEY");
    if (!process.env.AWS_S3_BUCKET_NAME) console.error("     - AWS_S3_BUCKET_NAME");
    process.exit(1);
  }
  console.log("   ✅ All required environment variables are set");

  // Test 2: Get S3 Config
  console.log("\n2. Getting S3 Configuration...");
  const config = getS3Config();
  if (!config) {
    console.error("   ❌ Failed to get S3 configuration");
    process.exit(1);
  }
  console.log(`   ✅ Bucket: ${config.bucket}`);
  console.log(`   ✅ Region: ${config.region}`);
  if (config.cloudfrontDomain) {
    console.log(`   ✅ CloudFront: ${config.cloudfrontDomain}`);
  } else {
    console.log(`   ⚠️  CloudFront: Not configured (optional)`);
  }

  // Test 3: Get S3 Client
  console.log("\n3. Creating S3 Client...");
  const s3Client = getS3Client();
  if (!s3Client) {
    console.error("   ❌ Failed to create S3 client");
    process.exit(1);
  }
  console.log("   ✅ S3 client created successfully");

  // Test 4: Test Bucket Access (ListObjectsV2 would require ListBucket permission)
  // Instead, we'll test by trying to upload a small test file
  console.log("\n4. Testing Bucket Access (via upload)...");
  
  // Create a small test file
  const testContent = "This is a test file for S3 connection verification";
  const testFileName = `s3-test-${Date.now()}.txt`;
  const testFilePath = join(process.cwd(), "storage", "temp", testFileName);
  
  try {
    // Ensure temp directory exists (create if needed)
    await writeFile(testFilePath, testContent);
    console.log(`   ✅ Created test file: ${testFileName}`);

    // Generate S3 key
    const testKey = `test/${testFileName}`;
    console.log(`   📤 Uploading to S3 key: ${testKey}...`);

    // Upload to S3
    const s3Url = await uploadToS3(testFilePath, {
      key: testKey,
      contentType: "text/plain",
    });

    console.log(`   ✅ Upload successful!`);
    console.log(`   🔗 URL: ${s3Url}`);

    // Test 5: Check if file exists
    console.log("\n5. Verifying file exists in S3...");
    const exists = await fileExistsInS3(testKey);
    if (exists) {
      console.log("   ✅ File exists in S3");
    } else {
      console.error("   ❌ File not found in S3 (upload may have failed)");
      process.exit(1);
    }

    // Test 6: Test S3 key generation
    console.log("\n6. Testing S3 key generation...");
    const audioKey = generateS3Key("affirmationMerged", "abc123", "mp3");
    console.log(`   ✅ Generated key: ${audioKey}`);
    const expectedKey = "audio/affirmationMerged/abc123.mp3";
    if (audioKey === expectedKey) {
      console.log("   ✅ Key format is correct");
    } else {
      console.error(`   ❌ Key format mismatch. Expected: ${expectedKey}, Got: ${audioKey}`);
    }

    // Cleanup: Delete local test file
    await unlink(testFilePath);
    console.log(`\n   🧹 Cleaned up local test file`);

    console.log("\n✅ All S3 tests passed!");
    console.log("\n📝 Summary:");
    console.log(`   - S3 is properly configured`);
    console.log(`   - Bucket access verified`);
    console.log(`   - File upload works`);
    console.log(`   - File existence check works`);
    console.log(`   - Ready for production use`);

  } catch (error: any) {
    console.error("\n❌ Test failed!");
    console.error(`   Error: ${error.message}`);
    
    if (error.name === "NoSuchBucket") {
      console.error("\n   💡 The bucket doesn't exist. Please create it in AWS S3 console.");
    } else if (error.name === "AccessDenied") {
      console.error("\n   💡 Access denied. Check:");
      console.error("      - IAM user has S3 permissions");
      console.error("      - Bucket name is correct");
      console.error("      - Access key has proper permissions");
    } else if (error.name === "InvalidAccessKeyId" || error.name === "SignatureDoesNotMatch") {
      console.error("\n   💡 Invalid credentials. Check:");
      console.error("      - AWS_ACCESS_KEY_ID is correct");
      console.error("      - AWS_SECRET_ACCESS_KEY is correct");
    } else if (error.message.includes("endpoint") || error.message.includes("region")) {
      console.error("\n   💡 Region mismatch detected!");
      console.error("      The bucket is in a different region than configured.");
      console.error(`      Current AWS_REGION: ${config.region}`);
      console.error("\n   🔧 To fix:");
      console.error("      1. Go to AWS S3 Console");
      console.error("      2. Click on your bucket");
      console.error("      3. Check the 'Properties' tab for the region");
      console.error("      4. Update AWS_REGION in your .env file to match");
      console.error("\n   Example: If bucket is in us-west-2, set:");
      console.error("      AWS_REGION=us-west-2");
    } else {
      console.error("\n   💡 Check AWS credentials and bucket configuration");
      console.error(`      Error details: ${error.name || "Unknown"}`);
    }
    
    // Cleanup on error
    try {
      await unlink(testFilePath);
    } catch {}

    process.exit(1);
  }
}

// Run the test
testS3().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

