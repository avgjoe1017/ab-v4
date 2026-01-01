# Chatbot System Overview

This document provides a comprehensive overview of the V4 chatbot system implementation.

**Date**: 2025-01-30  
**Status**: Implementation Complete

## Architecture

### Frontend (Mobile V4)

**Location**: `apps/mobile-v4/src/features/chat/`

#### Main Screen
- **File**: `HomeChatScreen.tsx`
- **Purpose**: Main chat interface controller
- **Key Features**:
  - Manages chat turn state (messages, thread ID, plan preview, suggested chips)
  - Handles user input and API communication
  - Displays plan preview cards when available
  - Supports "same vibe as yesterday" shortcut
  - Empty state with suggestion cards
  - Error handling with user-friendly messages

#### Components

1. **ChatBubble** (`components/ChatBubble.tsx`)
   - Renders individual chat messages
   - Shows user vs assistant with different avatars
   - Uses Sparkles icon for both roles (styled differently)

2. **ChatComposer** (`components/ChatComposer.tsx`)
   - Text input with send button
   - Supports suggestion chips (shown on empty state)
   - "Same vibe as yesterday" chip for paid users with saved plans
   - Placeholder buttons for future features (attachment, voice)

3. **ChatHeader** (`components/ChatHeader.tsx`)
   - Header with app branding ("Affirmation Beats 4")
   - New chat button (resets conversation)
   - Privacy sheet trigger

4. **ChatEmptyState** (`components/ChatEmptyState.tsx`)
   - Initial empty state when no messages
   - Shows suggestion cards with prompts
   - Brand icon and welcoming copy

#### Types

**File**: `types.ts`
- `ChatRole`: 'user' | 'assistant'
- `ChatMessage`: { id, role, text }
- `PlanPreview`: { planDraftId, title, affirmations, intent? }
- `ChatTurnState`: { threadId?, messages, planPreview?, suggestedChips? }

#### API Client

**File**: `api/chatApi.ts`
- `processChatTurn(turn: ChatTurnV4)`: Calls POST `/v4/chat/turn`
- Returns `ChatTurnResponseV4` with thread ID, assistant messages, plan preview, and suggested chips

### Backend (API)

**Location**: `apps/api/src/services/v4-chat.ts`

#### Core Functions

1. **`processChatTurn(userId, turn: ChatTurnV4)`**
   - Creates or retrieves chat thread
   - Validates thread ownership
   - Classifies risk level (crisis/distress/normal)
   - Saves user and assistant messages to database
   - Generates assistant response
   - Optionally creates plan preview (if message is substantial)
   - Returns response with thread ID, messages, plan preview, and suggested chips

2. **`commitPlan(userId, commit: PlanCommitV4)`**
   - Creates Plan record from PlanDraft
   - Enforces entitlements (daily limit, voice, etc.)
   - Records usage event
   - Updates plan draft state to "committed"
   - Triggers audio generation job
   - Records efficacy events for data strategy

#### Route Handler

**Location**: `apps/api/src/index.ts` (line ~895)

**Endpoint**: `POST /v4/chat/turn`
- Validates request body with Zod schema
- Extracts user ID (supports anonymous)
- Rate limiting (10 requests per minute per user)
- Error handling with user-friendly messages
- Returns `ChatTurnResponseV4`

### Database Models

**Location**: `apps/api/prisma/schema.prisma`

1. **ChatThread**
   - Stores conversation threads
   - Fields: id, userId?, clientDeviceId?, status, createdAt, updatedAt
   - Relations: user, messages, planDrafts

2. **ChatMessage**
   - Stores individual messages within threads
   - Fields: id, threadId, role, content, safetyFlags?, createdAt
   - Relations: thread

3. **PlanDraft**
   - Stores draft plans before commit
   - States: "ready", "committed", "abandoned"
   - Fields include: affirmations (JSON), intentSummary, voiceMode, brainTrackMode, etc.

## Key Features

### 1. Risk Classification

**Service**: `apps/api/src/services/v4-risk-classifier.ts`

The system classifies user messages into risk levels:
- **Crisis**: Shows crisis resources, no plan generation, no upsell
- **Distress**: Uses validation mode templates (gentle, grounding affirmations)
- **Normal**: Standard flow with generated affirmations

### 2. Premade Plan Matching (Free Tier Cost Control)

**Implementation**: `tryMatchPremadePlan()` in `v4-chat.ts`

For free tier users:
- Attempts to match user intent to premade catalog plans
- Uses intent clusters (confidence, anxiety, sleep, focus, etc.)
- Scoring based on keyword matches and goal tags
- Only creates plan draft if match score ≥ 3
- Falls back to generation if no match (unless kill switch forces premade-only)

### 3. Plan Preview Flow

**Guardrail Compliance**: Plan previews do NOT count toward daily limit

Flow:
1. User sends message
2. System generates assistant response
3. If message is substantial (>10 chars) and appropriate, creates PlanDraft
4. Returns plan preview to client
5. User can edit, regenerate, or start session
6. Daily limit only enforced on `commitPlan()` (Start Session button)

### 4. Suggested Chips

- Shown on empty state or after conversation
- Lightweight suggestions: "Help me sleep", "Quiet my mind", "Confidence at work"
- Clicking a chip sends it as a chat message (doesn't bypass flow)

### 5. "Same Vibe as Yesterday" Shortcut

**Feature**: P1-7.2
- Only shown for paid users with saved plans
- Fetches last plan settings (voice, brain track, background, affirmation count, tone tag)
- Sends message with tone tag to reuse previous vibe without storing sensitive transcript
- Provides quick path for returning users

### 6. Entitlement Enforcement

**Location**: `apps/api/src/services/v4-entitlements.ts`

Enforced on plan commit:
- Daily plan limit (free: 1/day, paid: unlimited)
- Voice selection (free: male/female only)
- Affirmation count (free: 6 only)
- Brain track mode (free: default only)
- Background selection (free: default only)

### 7. Error Handling

**Location**: `apps/api/src/services/v4-errors.ts`

User-friendly error messages:
- Network errors: "Unable to connect to server"
- Generation errors: Retry suggestions
- Validation errors: Clear field-level messages
- Never shows raw API errors to users

### 8. Data Strategy Integration

On plan commit:
- Records intent mapping to ontology
- Records efficacy event (completion outcome)
- Applies memory distillation (updates user memory with preferences)

## Guardrails Compliance

See `mistakes-to-avoid-for-v4.md` for complete guardrails.

Key guardrails implemented:
- ✅ #7: Daily limit only counts on Start Session, not preview
- ✅ #13: Free tier tries premade matching first (cost control)
- ✅ #8: "Same vibe as yesterday" shortcut prevents chat fatigue
- ✅ #11: Crisis detection routes to safe resources, no upsell
- ✅ #12: Privacy sheet available from header

## API Contracts

**Location**: `packages/contracts/src/schemas.ts`

### ChatTurnV4
```typescript
{
  threadId?: string;
  message: string;
  locale?: string;
  clientContext?: {
    platform?: string;
    appVersion?: string;
    timezoneOffsetMinutes?: number;
  };
}
```

### ChatTurnResponseV4
```typescript
{
  threadId: string;
  assistantMessages: Array<{
    id: string;
    text: string;
    timestamp: string;
  }>;
  suggestedChips?: Array<{
    id: string;
    text: string;
  }>;
  planPreview?: {
    planDraftId: string;
    title: string;
    affirmations: string[];
    intent?: string;
  };
}
```

## Flow Diagrams

### Standard Chat Flow

```
User sends message
  ↓
Client: processChatTurn()
  ↓
API: POST /v4/chat/turn
  ↓
Create/retrieve thread
  ↓
Classify risk level
  ↓
Generate assistant response
  ↓
If appropriate: Create PlanDraft (preview)
  ↓
Return response with messages + plan preview
  ↓
Client: Display messages + plan preview card
  ↓
User: Edit/Regenerate/Start Session
  ↓
If Start Session: commitPlan()
  ↓
Enforce entitlements (daily limit)
  ↓
Create Plan record
  ↓
Trigger audio generation
  ↓
Navigate to player
```

### Crisis Flow

```
User sends message
  ↓
Risk classification: crisis
  ↓
Block plan generation
  ↓
Return crisis resources (no plan preview, no chips)
  ↓
User sees supportive resources
```

### Distress Flow

```
User sends message
  ↓
Risk classification: distress
  ↓
Generate validation-mode response (gentle, grounding)
  ↓
Use validation mode templates for affirmations (not AI generation)
  ↓
Return plan preview with validation templates
```

## Testing Considerations

1. **Network Errors**: Test API server unavailable scenarios
2. **Rate Limiting**: Test 10 requests/minute limit
3. **Ownership**: Test thread ownership validation
4. **Risk Classification**: Test crisis/distress/normal paths
5. **Premade Matching**: Test free tier matching logic
6. **Entitlement Enforcement**: Test daily limits and feature restrictions
7. **Plan Preview**: Verify it doesn't count toward daily limit
8. **Plan Commit**: Verify it does count toward daily limit

## Future Enhancements

Potential improvements:
- LLM-based assistant response generation (currently heuristic-based)
- Conversation history retrieval (currently ephemeral client-side)
- Markdown rendering in chat bubbles
- Voice input support
- Attachment support
- Conversation threading UI (multiple threads)

## Related Documentation

- `MD_DOCS/CHATGPT_CLONE.md`: UI reference documentation
- `V4_Rebuild_Outline_from_V3.md`: Overall V4 architecture
- `mistakes-to-avoid-for-v4.md`: Guardrails and requirements
- `MD_DOCS/DATA_STRATEGY.md`: Data strategy integration