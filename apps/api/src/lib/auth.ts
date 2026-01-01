/**
 * Authentication Utilities
 * 
 * Phase 6.1: Foundation for authentication system
 * Currently uses default user ID, but structured for easy migration to Clerk/Supabase
 */

import type { Context } from "hono";
import { verifyClerkToken, isClerkConfigured } from "./clerk";
import { isProduction } from "./config";

/**
 * Extract user ID from request context
 * 
 * Priority:
 * 1. If Clerk is configured, verify Clerk JWT token
 * 2. Otherwise, return default user ID for development
 * 
 * @param c - Hono context
 * @returns User ID string or null if not authenticated
 */
export async function getUserId(c: Context): Promise<string | null> {
  // If Clerk is configured, try to use Clerk authentication
  if (isClerkConfigured()) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const userId = await verifyClerkToken(token);
      if (userId) {
        return userId;
      }
      // If token is invalid, fall through to default user ID for development
    }
    // If no token provided but Clerk is configured, allow dev fallback only
    if (isProduction()) {
      return null;
    }
  }
  
  // Development fallback: return default user ID
  if (isProduction()) {
    return null;
  }
  const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
  return DEFAULT_USER_ID;
}

/**
 * Require authentication middleware
 * 
 * Validates that the request is authenticated
 * Returns 401 if not authenticated
 * 
 * @param c - Hono context
 * @returns User ID string
 * @throws Returns 401 error response if not authenticated
 */
export async function requireAuth(c: Context): Promise<string> {
  const userId = await getUserId(c);
  
  if (!userId) {
    // TODO: Return proper error response
    throw new Error("UNAUTHORIZED");
  }
  
  return userId;
}

/**
 * Check if request is authenticated
 * 
 * @param c - Hono context
 * @returns Promise<boolean> - true if authenticated, false otherwise
 */
export async function isAuthenticated(c: Context): Promise<boolean> {
  const userId = await getUserId(c);
  return userId !== null;
}

