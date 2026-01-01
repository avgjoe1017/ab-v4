# AI Affirmation Generation - Current Status

**Created**: January 2025  
**Status**: Backend Complete, Frontend Integration Needed

---

## Overview

The AI affirmation generation system is the core differentiator of Entrain. It uses OpenAI to generate personalized, values-based affirmations, then converts them to speech via TTS (ElevenLabs/OpenAI), and plays them with binaural beats.

---

## What's Already Complete ✅

### 1. Backend AI Pipeline (Phase 1)

#### OpenAI Affirmation Generation (`apps/api/src/services/affirmation-generator.ts`)
- ✅ Complete implementation
- ✅ Follows roadmap requirements:
  - First-person statements ("I am..." not "You are...")
  - Values-connected (uses user's core values)
  - Present tense, believable stretch
  - Avoids generic positivity
  - 8-15 words per affirmation
- ✅ Proper prompt engineering with user values, struggle, and session type
- ✅ Parsing handles various response formats (numbered lists, bullets, plain text)

#### TTS Integration (`apps/api/src/services/audio/tts.ts`)
- ✅ Supports multiple providers: OpenAI, ElevenLabs, Azure, beep fallback
- ✅ Prosody variation support (variant 1 and 2 for dual-read pattern)
- ✅ Converts to MP3 matching V3 audio profile (128kbps, 44.1kHz)
- ✅ Proper voice mapping for calm, neutral voices

#### Audio Generation Pipeline (`apps/api/src/services/audio/generation.ts`)
- ✅ Automatically generates affirmations when session has none
- ✅ Fetches user values and struggle from database
- ✅ Determines session type from goalTag/title
- ✅ Saves generated affirmations to database
- ✅ Generates TTS audio with dual-read pattern (variant 1 + variant 2)
- ✅ Stitches with silence gaps
- ✅ Full caching to prevent re-generation

#### API Endpoints
- ✅ `POST /affirmations/generate` - Generate affirmations on-demand
- ✅ `POST /me/values` - Save user values
- ✅ `GET /me/values` - Fetch user values
- ✅ `PUT /me/struggle` - Save user struggle/goal
- ✅ `GET /me/struggle` - Fetch user struggle

### 2. Values Onboarding (Phase 2)

#### Mobile Screens
- ✅ `OnboardingFlow.tsx` - Complete flow with values integration
- ✅ `ValuesEducationScreen.tsx` - Explains why values matter
- ✅ `ValueSelectionScreen.tsx` - User selects 5-7 values from research-backed list
- ✅ `ValueRankingScreen.tsx` - User ranks top 3 values
- ✅ `StruggleInputScreen.tsx` - Optional struggle/goal input
- ✅ Values are saved to API during onboarding

#### Database Schema
- ✅ `UserValue` model with `userId`, `valueId`, `valueText`, `rank`
- ✅ Supports ranked values (top 3 get ranks 1-3)

### 3. Catalog Content (Phase 3)
- ✅ Pre-built sessions with default affirmations
- ✅ 8 session types seeded with appropriate content

---

## What's Missing or Needs Improvement 🔧

### 1. EditorScreen Integration

**Current State**: EditorScreen requires users to manually type affirmations before saving.

**What Should Happen**: Users should be able to:
- Option 1: Click "Generate Affirmations" button to generate them on-demand (uses their values/struggle)
- Option 2: Save session without affirmations (let AI generate them during audio generation)

**Current Block**: Validation in EditorScreen prevents saving without affirmations.

### 2. User Experience Flow

**Ideal Flow**:
1. User opens EditorScreen
2. Enters title and goalTag
3. Clicks "Generate Affirmations" → API call to `/affirmations/generate`
4. Generated affirmations appear in the list
5. User can edit/remove/add more
6. User clicks "Create & Generate" → Session saved → Audio generation job runs

**Alternative Flow** (if no values set):
1. User opens EditorScreen
2. Enters title and goalTag
3. Clicks "Create & Generate" → Session saved without affirmations
4. Audio generation job detects no affirmations → Generates generic ones
5. Audio is created and ready to play

### 3. Error Handling & Loading States

**Missing**:
- Loading state when generating affirmations
- Error messages if generation fails
- Fallback behavior if OpenAI is unavailable

---

## Recommended Implementation Plan

### Step 1: Add Generate Affirmations Button to EditorScreen

**File**: `apps/mobile/src/screens/EditorScreen.tsx`

**Changes**:
1. Add state for generating affirmations (loading, error)
2. Add function to call `/affirmations/generate` API
3. Fetch user values and struggle (if available)
4. Display generated affirmations
5. Allow user to accept/reject/edit

### Step 2: Update Validation Logic

**Option A**: Allow saving without affirmations (preferred)
- Remove the "must have at least one affirmation" check
- Let backend generate them during audio generation
- This is already implemented in `processEnsureAudioJob`

**Option B**: Require affirmations but allow empty array initially
- User must either generate or manually add before saving

### Step 3: Test End-to-End Flow

**Test Cases**:
1. User with values + struggle → Generate affirmations → Verify they're personalized
2. User without values → Generate affirmations → Verify generic but good affirmations
3. Create session without affirmations → Verify backend generates them
4. Generate → Edit → Save → Verify edited affirmations are used

---

## Code Locations

### Backend
- `apps/api/src/services/affirmation-generator.ts` - OpenAI integration
- `apps/api/src/services/audio/tts.ts` - TTS providers
- `apps/api/src/services/audio/generation.ts` - Audio generation pipeline
- `apps/api/src/index.ts` - API endpoints

### Frontend
- `apps/mobile/src/screens/EditorScreen.tsx` - **NEEDS UPDATE**
- `apps/mobile/src/lib/values.ts` - Values API helpers
- `apps/mobile/src/lib/api.ts` - API client
- `apps/mobile/src/screens/OnboardingFlow.tsx` - Values onboarding

---

## Success Criteria (Per Roadmap Phase 1)

✅ **Phase 1.1 Complete**: OpenAI affirmation generation implemented  
✅ **Phase 1.2 Complete**: ElevenLabs/OpenAI TTS integration implemented  
✅ **Phase 1.3 Complete**: Stitching pipeline updated to use real TTS output  

**Phase 1 Complete When**:
- ✅ User creates session → OpenAI generates 3-6 affirmations → ElevenLabs speaks them → Audio plays with binaural beats
- ✅ Affirmations are cached (no re-generation for identical text)
- ✅ Audio quality matches AUDIO_PROFILE_V3 spec
- ⚠️ **Frontend integration needed**: Users should be able to trigger generation from EditorScreen

---

## Next Steps

1. **Add Generate Affirmations Button** to EditorScreen
2. **Update validation** to allow saving without affirmations
3. **Test end-to-end flow** with real API calls
4. **Add loading/error states** for better UX
5. **Document** the complete flow in PROGRESS.md

---

## API Keys Required

- ✅ `OPENAI_API_KEY` - For affirmation generation (required)
- ✅ `TTS_PROVIDER` - Set to "openai" or "elevenlabs" (optional, defaults to beep)
- ✅ `ELEVENLABS_API_KEY` - If using ElevenLabs TTS (optional)

**Status**: See `API_KEYS_REQUIRED.md` for setup instructions.

