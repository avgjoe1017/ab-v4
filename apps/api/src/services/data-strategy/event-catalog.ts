/**
 * Event Schema Catalog
 * DATA_STRATEGY.md Section 9.1: Standard event schemas for integration readiness
 * 
 * Versioned event schemas with backwards compatibility guarantees.
 */

import { z } from "zod";

export const EventSchemaVersion = "v1.0.0";

/**
 * Base event schema
 */
export const BaseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  userId: z.string().uuid().nullable(),
  timestamp: z.string().datetime(),
  schemaVersion: z.string(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Plan committed event
 */
export const PlanCommittedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("plan_committed"),
  planId: z.string().uuid(),
  planDraftId: z.string().uuid().optional(),
  topicId: z.string().optional(),
  affirmationCount: z.number(),
  voiceId: z.string(),
  brainTrackMode: z.string().optional(),
  backgroundId: z.string().optional(),
});

/**
 * Session started event
 */
export const SessionStartedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("session_started"),
  sessionId: z.string().uuid(),
  planId: z.string().uuid(),
  topicId: z.string().optional(),
});

/**
 * Session completed event
 */
export const SessionCompletedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("session_completed"),
  sessionId: z.string().uuid(),
  planId: z.string().uuid(),
  durationMs: z.number(),
  completionReason: z.enum(["natural_end", "user_stopped", "cap_reached"]),
});

/**
 * Session abandoned event
 */
export const SessionAbandonedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("session_abandoned"),
  sessionId: z.string().uuid(),
  planId: z.string().uuid(),
  abandonTimeMs: z.number(),
  reasonCode: z.string().optional(),
});

/**
 * Feedback given event
 */
export const FeedbackGivenEventSchema = BaseEventSchema.extend({
  eventType: z.literal("feedback_given"),
  planId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  feedbackType: z.enum(["felt_true", "too_generic", "edit_distance", "other"]),
  feedbackValue: z.number().optional(),
  feedbackText: z.string().optional(),
});

/**
 * Plan saved event
 */
export const PlanSavedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("plan_saved"),
  planId: z.string().uuid(),
});

/**
 * Plan unsaved event
 */
export const PlanUnsavedEventSchema = BaseEventSchema.extend({
  eventType: z.literal("plan_unsaved"),
  planId: z.string().uuid(),
});

/**
 * Union of all event schemas
 */
export const EventSchema = z.discriminatedUnion("eventType", [
  PlanCommittedEventSchema,
  SessionStartedEventSchema,
  SessionCompletedEventSchema,
  SessionAbandonedEventSchema,
  FeedbackGivenEventSchema,
  PlanSavedEventSchema,
  PlanUnsavedEventSchema,
]);

export type Event = z.infer<typeof EventSchema>;

/**
 * Validate event against schema
 */
export function validateEvent(event: unknown): { valid: boolean; event?: Event; error?: string } {
  try {
    const parsed = EventSchema.parse(event);
    return { valid: true, event: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: String(error) };
  }
}

/**
 * Get event catalog (for documentation)
 */
export function getEventCatalog(): {
  version: string;
  events: Array<{
    eventType: string;
    description: string;
    schema: Record<string, any>;
  }>;
} {
  return {
    version: EventSchemaVersion,
    events: [
      {
        eventType: "plan_committed",
        description: "User committed a plan draft to start a session",
        schema: PlanCommittedEventSchema.shape,
      },
      {
        eventType: "session_started",
        description: "User started playing a session",
        schema: SessionStartedEventSchema.shape,
      },
      {
        eventType: "session_completed",
        description: "User completed a session",
        schema: SessionCompletedEventSchema.shape,
      },
      {
        eventType: "session_abandoned",
        description: "User abandoned a session before completion",
        schema: SessionAbandonedEventSchema.shape,
      },
      {
        eventType: "feedback_given",
        description: "User provided feedback on a plan or session",
        schema: FeedbackGivenEventSchema.shape,
      },
      {
        eventType: "plan_saved",
        description: "User saved a plan",
        schema: PlanSavedEventSchema.shape,
      },
      {
        eventType: "plan_unsaved",
        description: "User unsaved a plan",
        schema: PlanUnsavedEventSchema.shape,
      },
    ],
  };
}
