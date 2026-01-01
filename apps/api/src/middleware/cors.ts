/**
 * CORS Middleware
 * 
 * Phase 6: Production-ready CORS configuration
 */

import type { Context, Next } from "hono";
import { isProduction } from "../lib/config";

/**
 * CORS middleware for Hono
 * 
 * Allows requests from mobile app and configured origins
 */
export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header("Origin");
  
  // In production, check against allowed origins
  // In development, allow all origins (including admin UI)
  if (isProduction()) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
    
    if (origin && allowedOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
    }
  } else {
    // Development: allow all origins (including admin UI at localhost:3001)
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    } else {
      // If no origin header, allow all (but can't use credentials with *)
      c.header("Access-Control-Allow-Origin", "*");
    }
  }
  
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  c.header("Access-Control-Max-Age", "86400"); // 24 hours
  
  // Handle preflight requests
  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  
  await next();
}

