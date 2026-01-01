/**
 * Clerk Authentication Integration
 * 
 * Phase 6.1: Clerk backend SDK integration
 * 
 * To use:
 * 1. Install: pnpm add @clerk/backend
 * 2. Set environment variables:
 *    - CLERK_SECRET_KEY=sk_...
 * 3. Update getUserId() in auth.ts to use verifyToken()
 */

import { verifyToken } from "@clerk/backend";

/**
 * Verify Clerk JWT token and extract user ID
 * 
 * @param token - JWT token from Authorization header
 * @returns User ID if token is valid, null otherwise
 */
export async function verifyClerkToken(token: string): Promise<string | null> {
  if (!isClerkConfigured()) {
    return null;
  }
  
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    // Extract user ID from JWT payload (sub claim)
    const userId = payload.sub;
    return userId || null;
  } catch (error) {
    console.error("[Clerk] Token verification failed:", error);
    return null;
  }
}

/**
 * Check if Clerk is configured
 * 
 * @returns true if CLERK_SECRET_KEY is set
 */
export function isClerkConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY;
}

