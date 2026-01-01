/**
 * Debug Cache Service
 * DATA_STRATEGY.md Section 5.2: Encrypted short-TTL cache for debugging
 * 
 * Purpose: Reproduce issues and investigate bugs without keeping long-term content.
 * Rules: Encrypted payload, hard TTL (24-72 hours), audited reads, not used for analytics.
 */

import { prisma } from "../../lib/db";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.DEBUG_CACHE_ENCRYPTION_KEY || "default-key-change-in-production";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Encrypt payload for debug cache
 */
function encrypt(payload: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)), iv);
  
  let encrypted = cipher.update(payload, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Return: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt payload from debug cache
 */
function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32)),
    iv
  );
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Store data in debug cache
 */
export async function storeDebugCache(
  cacheKey: string,
  payload: Record<string, any>,
  userId: string | null = null,
  ttlHours: number = 24
): Promise<void> {
  const encryptedPayload = encrypt(JSON.stringify(payload));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.debugCache.create({
    data: {
      userId: userId || null,
      cacheKey,
      encryptedPayload,
      ttlHours,
      expiresAt,
    },
  });
}

/**
 * Retrieve data from debug cache (audits read)
 */
export async function getDebugCache(cacheKey: string): Promise<Record<string, any> | null> {
  const cache = await prisma.debugCache.findFirst({
    where: {
      cacheKey,
      expiresAt: {
        gt: new Date(), // Not expired
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!cache) {
    return null;
  }

  // Audit read
  await prisma.debugCache.update({
    where: { id: cache.id },
    data: {
      readCount: cache.readCount + 1,
      lastReadAt: new Date(),
    },
  });

  try {
    const decrypted = decrypt(cache.encryptedPayload);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("[DebugCache] Failed to decrypt cache:", error);
    return null;
  }
}

/**
 * Clean up expired cache entries (should be run periodically)
 */
export async function cleanupExpiredCache(): Promise<number> {
  const result = await prisma.debugCache.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get cache statistics (for monitoring)
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  totalReads: number;
  averageReadsPerEntry: number;
}> {
  const totalEntries = await prisma.debugCache.count();
  const expiredEntries = await prisma.debugCache.count({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  const allCaches = await prisma.debugCache.findMany({
    select: { readCount: true },
  });

  const totalReads = allCaches.reduce((sum, c) => sum + c.readCount, 0);
  const averageReadsPerEntry = totalEntries > 0 ? totalReads / totalEntries : 0;

  return {
    totalEntries,
    expiredEntries,
    totalReads,
    averageReadsPerEntry,
  };
}
