/**
 * Error Handling Middleware
 * 
 * Phase 6: Production-ready error handling
 */

import type { Context } from "hono";
import { isProduction } from "../lib/config";

/**
 * Standard error response format
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  // Only include stack trace in development
  stack?: string;
}

/**
 * Create error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  error?: Error
): ErrorResponse {
  const response: ErrorResponse = {
    code,
    message,
  };
  
  if (details !== undefined) {
    response.details = details;
  }
  
  // Only include stack trace in development
  if (!isProduction() && error?.stack) {
    response.stack = error.stack;
  }
  
  return response;
}

/**
 * Global error handler middleware
 * Hono error handler signature: (err, c) => Response
 */
export function errorHandler(error: Error, c: Context) {
  console.error("[API] Unhandled error:", error);
  
  // Check if it's a known error type
  if (error instanceof Error) {
    // Check for specific error codes
    if (error.message.includes("UNAUTHORIZED")) {
      return c.json(
        createErrorResponse("UNAUTHORIZED", "Authentication required", undefined, error),
        401
      );
    }
    
    if (error.message.includes("NOT_FOUND")) {
      return c.json(
        createErrorResponse("NOT_FOUND", "Resource not found", undefined, error),
        404
      );
    }
  }
  
  // Generic error response
  return c.json(
    createErrorResponse(
      "INTERNAL_ERROR",
      isProduction() ? "An unexpected error occurred" : error.message,
      undefined,
      error
    ),
    500
  );
}

