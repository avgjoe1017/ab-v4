export type ApiErrorCode =
  | "INVALID_SESSION_ID"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "ENTITLEMENT_REQUIRED"
  | "FREE_LIMIT_REACHED"
  | "SESSION_TOO_LONG"
  | "AUDIO_NOT_READY"
  | "ASSET_ERROR"
  | "INTERNAL_ERROR"
  | "UNAUTHORIZED" // Phase 6.1: Authentication errors
  | "RATE_LIMITED";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};
