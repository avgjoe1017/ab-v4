/**
 * Configuration Utilities
 * 
 * Phase 6: Centralized configuration management for production readiness
 */

/**
 * Get environment variable or throw error if required
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  
  if (value === undefined) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  return value;
}

/**
 * Get environment variable or return default (no error if missing)
 */
export function getEnvOptional(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
}

/**
 * Get API port
 */
export function getPort(): number {
  return parseInt(getEnvOptional("PORT", "8787") || "8787", 10);
}

/**
 * Get public base URL for asset links (optional, but recommended behind proxies)
 */
export function getPublicBaseUrl(): string | undefined {
  return getEnvOptional("API_PUBLIC_BASE_URL");
}

/**
 * Configuration object for easy access
 */
export const config = {
  // Environment
  env: process.env.NODE_ENV || "development",
  isProduction: isProduction(),
  isDevelopment: isDevelopment(),
  port: getPort(),
  publicBaseUrl: getPublicBaseUrl(),
  
  // Database
  databaseUrl: getEnvOptional("DATABASE_URL"),
  
  // Authentication (Clerk)
  // Note: CLERK_SECRET_KEY is for API backend, CLERK_PUBLISHABLE_KEY is for mobile app
  clerkSecretKey: getEnvOptional("CLERK_SECRET_KEY"),
  clerkPublishableKey: getEnvOptional("CLERK_PUBLISHABLE_KEY"), // Mobile app uses this
  clerkConfigured: !!process.env.CLERK_SECRET_KEY,
  
  // Payments (RevenueCat)
  revenueCatApiKey: getEnvOptional("REVENUECAT_API_KEY"),
  revenueCatConfigured: !!process.env.REVENUECAT_API_KEY,
  
  // Cloud Storage (AWS S3)
  awsAccessKeyId: getEnvOptional("AWS_ACCESS_KEY_ID"),
  awsSecretAccessKey: getEnvOptional("AWS_SECRET_ACCESS_KEY"),
  awsS3BucketName: getEnvOptional("AWS_S3_BUCKET_NAME"),
  awsRegion: getEnvOptional("AWS_REGION", "us-east-1"),
  cloudfrontDomain: getEnvOptional("CLOUDFRONT_DOMAIN"),
  s3Configured: !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET_NAME
  ),
  
  // TTS
  ttsProvider: getEnvOptional("TTS_PROVIDER", "beep"),
  openaiApiKey: getEnvOptional("OPENAI_API_KEY"),
  elevenlabsApiKey: getEnvOptional("ELEVENLABS_API_KEY"),

  // Jobs
  jobWorkerEnabled: getEnvOptional("JOB_WORKER_ENABLED", "true") !== "false",
} as const;

