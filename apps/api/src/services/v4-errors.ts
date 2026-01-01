/**
 * V4 Error Handling Service
 * P0.6: Comprehensive error handling with recovery paths
 * Never show raw errors, always provide calm recovery options
 */

export interface V4Error {
  code: string;
  message: string;
  userMessage: string; // Calm, supportive message for user
  recoveryActions: Array<{
    action: "retry" | "use_premade" | "continue_silent" | "try_again_later" | "contact_support";
    label: string;
    endpoint?: string;
  }>;
  details?: unknown;
}

/**
 * Map internal errors to user-friendly V4 errors with recovery paths
 */
export function handleV4Error(err: unknown, context: string): V4Error {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const lower = errorMessage.toLowerCase();

  // Chat turn errors
  if (context === "chat_turn") {
    if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
      return {
        code: "NETWORK_ERROR",
        message: errorMessage,
        userMessage: "Having trouble connecting. Let's try that again.",
        recoveryActions: [
          { action: "retry", label: "Try Again", endpoint: "/v4/chat/turn" },
          { action: "try_again_later", label: "Try Later" },
        ],
      };
    }

    if (lower.includes("generation") || lower.includes("openai")) {
      return {
        code: "GENERATION_ERROR",
        message: errorMessage,
        userMessage: "Something went wrong creating your plan. Let's try again.",
        recoveryActions: [
          { action: "retry", label: "Try Again", endpoint: "/v4/chat/turn" },
          { action: "use_premade", label: "Browse Premade Plans", endpoint: "/v4/library/premade" },
        ],
      };
    }
  }

  // Reroll errors
  if (context === "reroll") {
    if (lower.includes("reroll_limit") || lower.includes("quota")) {
      return {
        code: "REROLL_LIMIT_REACHED",
        message: errorMessage,
        userMessage: "You've used your rerolls for this plan. You can start this plan or create a new one.",
        recoveryActions: [
          { action: "try_again_later", label: "Create New Plan Tomorrow" },
        ],
      };
    }
  }

  // Commit errors
  if (context === "commit") {
    if (lower.includes("free_limit") || lower.includes("daily")) {
      return {
        code: "FREE_LIMIT_REACHED",
        message: errorMessage,
        userMessage: "You've used your free plan for today. Browse premade plans or upgrade for unlimited.",
        recoveryActions: [
          { action: "use_premade", label: "Browse Premade Plans", endpoint: "/v4/library/premade" },
          { action: "try_again_later", label: "Try Again Tomorrow" },
        ],
      };
    }

    if (lower.includes("affirmation_count") || lower.includes("not allowed")) {
      return {
        code: "AFFIRMATION_COUNT_NOT_ALLOWED",
        message: errorMessage,
        userMessage: "This affirmation count isn't available on your plan. Let's use 6 affirmations instead.",
        recoveryActions: [
          { action: "retry", label: "Create with 6 Affirmations" },
        ],
      };
    }

    if (lower.includes("voice") && lower.includes("not allowed")) {
      return {
        code: "VOICE_NOT_ALLOWED",
        message: errorMessage,
        userMessage: "This voice option isn't available on your plan. Let's use the default voice.",
        recoveryActions: [
          { action: "retry", label: "Continue with Default Voice" },
        ],
      };
    }
  }

  // Playback errors
  if (context === "playback") {
    if (lower.includes("not found") || lower.includes("missing")) {
      return {
        code: "PLAYBACK_NOT_READY",
        message: errorMessage,
        userMessage: "Audio is still preparing. Background music will start now, voice will join shortly.",
        recoveryActions: [
          { action: "continue_silent", label: "Start with Background Music" },
          { action: "retry", label: "Wait and Retry", endpoint: "/v4/plans/:id/playback-bundle" },
        ],
      };
    }

    if (lower.includes("network") || lower.includes("fetch")) {
      return {
        code: "PLAYBACK_NETWORK_ERROR",
        message: errorMessage,
        userMessage: "Having trouble loading audio. You can still listen to background music and view affirmations.",
        recoveryActions: [
          { action: "continue_silent", label: "Continue with Text Affirmations" },
          { action: "retry", label: "Try Loading Again" },
        ],
      };
    }
  }

  // Generic fallback
  return {
    code: "UNKNOWN_ERROR",
    message: errorMessage,
    userMessage: "Something unexpected happened. Let's try again or you can browse premade plans.",
    recoveryActions: [
      { action: "retry", label: "Try Again" },
      { action: "use_premade", label: "Browse Premade Plans", endpoint: "/v4/library/premade" },
      { action: "try_again_later", label: "Try Later" },
    ],
    details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
  };
}

/**
 * Check if error is recoverable (can show retry option)
 */
export function isRecoverableError(errorCode: string): boolean {
  const recoverableCodes = [
    "NETWORK_ERROR",
    "GENERATION_ERROR",
    "PLAYBACK_NOT_READY",
    "PLAYBACK_NETWORK_ERROR",
  ];
  return recoverableCodes.includes(errorCode);
}
