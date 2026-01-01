/**
 * Authentication Middleware for Hono
 * 
 * Phase 6.1: Middleware to protect routes that require authentication
 */

import type { Context, Next } from "hono";
import { getUserId } from "../lib/auth";

/**
 * Error response helper
 */
function errorResponse(code: string, message: string, details?: string) {
  return {
    code,
    message,
    details,
  };
}

/**
 * Middleware to require authentication
 * 
 * Adds userId to context variables
 * Returns 401 if not authenticated
 */
export async function requireAuthMiddleware(c: Context, next: Next) {
  const userId = await getUserId(c);
  
  if (!userId) {
    return c.json(
      errorResponse("UNAUTHORIZED", "Authentication required", "Please log in to access this resource"),
      401
    );
  }
  
  // Add userId to context for use in handlers
  c.set("userId", userId);
  
  await next();
}

/**
 * Middleware to optionally extract user ID
 * 
 * Adds userId to context if authenticated, but doesn't fail if not
 * Useful for endpoints that work differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const userId = await getUserId(c);
  
  if (userId) {
    c.set("userId", userId);
  }
  
  await next();
}

