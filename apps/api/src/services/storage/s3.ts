/**
 * AWS S3 Storage Service
 * 
 * Phase 6.4: Upload audio files to S3 and serve via CloudFront CDN
 * 
 * To use:
 * 1. Install: pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * 2. Set environment variables:
 *    - AWS_ACCESS_KEY_ID=...
 *    - AWS_SECRET_ACCESS_KEY=...
 *    - AWS_S3_BUCKET_NAME=...
 *    - AWS_REGION=us-east-1
 *    - CLOUDFRONT_DOMAIN=d1234abcdef.cloudfront.net
 * 3. Update audio generation to use uploadToS3()
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface S3UploadOptions {
  key: string; // S3 object key (path)
  contentType?: string; // MIME type (default: audio/mpeg)
  cacheControl?: string; // Cache control header (default: public, max-age=31536000)
}

export interface S3Config {
  bucket: string;
  region: string;
  cloudfrontDomain?: string;
}

/**
 * Get S3 client instance
 * 
 * @returns S3 client (or null if not configured)
 */
export function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  
  if (!accessKeyId || !secretAccessKey) {
    return null;
  }
  
  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Get S3 configuration
 * 
 * @returns S3 config or null if not configured
 */
export function getS3Config(): S3Config | null {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || "us-east-1";
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  
  if (!bucket) {
    return null;
  }
  
  return {
    bucket,
    region,
    cloudfrontDomain,
  };
}

/**
 * Detect the actual region of an S3 bucket
 * 
 * @param bucketName - Name of the S3 bucket
 * @returns The region where the bucket is located, or null if detection fails
 */
export async function detectBucketRegion(bucketName: string): Promise<string | null> {
  const s3Client = getS3Client();
  if (!s3Client) {
    return null;
  }

  try {
    // Use us-east-1 as default region for GetBucketLocation (it's a special endpoint)
    const locationClient = new S3Client({
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const command = new GetBucketLocationCommand({ Bucket: bucketName });
    const response = await locationClient.send(command);
    
    // AWS returns null for us-east-1, empty string for some regions
    const locationConstraint = response.LocationConstraint;
    if (!locationConstraint || String(locationConstraint) === "") {
      return "us-east-1";
    }
    return locationConstraint;
  } catch (error) {
    console.error("Failed to detect bucket region:", error);
    return null;
  }
}

/**
 * Check if S3 is configured
 * 
 * @returns true if all required environment variables are set
 */
export function isS3Configured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  );
}

/**
 * Upload file to S3
 * 
 * @param filePath - Local file path to upload
 * @param options - Upload options (key, contentType, etc.)
 * @returns S3 URL (CloudFront URL if configured, otherwise S3 URL)
 */
export async function uploadToS3(
  filePath: string,
  options: S3UploadOptions
): Promise<string> {
  const s3Client = getS3Client();
  const config = getS3Config();
  
  if (!s3Client || !config) {
    throw new Error("S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME");
  }
  
  const fs = await import("fs-extra");
  const fileBuffer = await fs.readFile(filePath);
  
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: options.key,
    Body: fileBuffer,
    ContentType: options.contentType || "audio/mpeg",
    CacheControl: options.cacheControl || "public, max-age=31536000",
    ACL: "public-read", // Make objects publicly accessible
  });
  
  await s3Client.send(command);
  
  // Return CloudFront URL if configured, otherwise S3 URL
  if (config.cloudfrontDomain) {
    return `https://${config.cloudfrontDomain}/${options.key}`;
  }
  
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${options.key}`;
}

/**
 * Check if file exists in S3
 * 
 * @param key - S3 object key
 * @returns true if file exists
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  const s3Client = getS3Client();
  const config = getS3Config();
  
  if (!s3Client || !config) {
    return false;
  }
  
  try {
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Get S3 URL for a file (CloudFront if configured, otherwise S3)
 * 
 * @param key - S3 object key
 * @returns Full URL to the file
 */
export function getS3Url(key: string): string {
  const config = getS3Config();
  
  if (!config) {
    throw new Error("S3 is not configured");
  }
  
  // Prefer CloudFront URL if configured
  if (config.cloudfrontDomain) {
    return `https://${config.cloudfrontDomain}/${key}`;
  }
  
  // Fallback to S3 URL
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Generate S3 key for audio file
 * 
 * @param kind - Audio asset kind (affirmationMerged, affirmationChunk, etc.)
 * @param hash - File hash
 * @param extension - File extension (default: mp3)
 * @returns S3 key
 */
export function generateS3Key(kind: string, hash: string, extension: string = "mp3"): string {
  // Organize by kind and hash for better performance
  // Format: audio/{kind}/{hash}.{extension}
  return `audio/${kind}/${hash}.${extension}`;
}

