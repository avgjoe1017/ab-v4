# Codebase Overview for Refactoring

**Date**: 2025-01-14  
**Purpose**: Comprehensive overview of the Affirmation Beats V3 codebase to guide refactoring efforts

---

## Architecture Summary

### Monorepo Structure (pnpm workspaces)

```
ab-v3/
├── apps/
│   ├── mobile/      # Expo React Native app (main user app)
│   ├── api/         # Bun + Hono API server with Prisma
│   └── admin/       # Next.js admin dashboard
├── packages/
│   ├── contracts/   # Zod schemas, migrations, typed errors (single source of truth)
│   ├── audio-engine/ # expo-audio-based singleton playback engine (3-track model)
│   └── utils/       # Pure utilities (no network/storage side-effects)
└── assets/          # Audio assets (binaural, background, solfeggio)
```

---

## Key Technologies

### Mobile App (`apps/mobile`)
- **Framework**: Expo ~54.0.30, React Native 0.81.5, React 19.1.0
- **Navigation**: React Navigation (Stack + Bottom Tabs)
- **State Management**: 
  - Zustand (for draft sessions)
  - React Query/TanStack Query (for server state)
- **Audio**: expo-audio (singleton AudioEngine from `@ab/audio-engine`)
- **Auth**: Clerk (`@clerk/clerk-expo`)
- **UI Libraries**: 
  - React Native Skia (for visualizations)
  - expo-linear-gradient, expo-blur
  - Custom component library in `components/`

### API Server (`apps/api`)
- **Runtime**: Bun 1.1+
- **Framework**: Hono
- **Database**: Prisma + SQLite (dev) / Postgres (production target)
- **Auth**: Clerk backend (partially integrated)
- **Services**:
  - Affirmation generation (OpenAI)
  - TTS (ElevenLabs with fallback)
  - Audio generation/stitching (FFmpeg)
  - Job queue system (in-process)
  - RevenueCat integration (subscriptions)

### Admin Dashboard (`apps/admin`)
- **Framework**: Next.js
- **Purpose**: Admin interface for moderation, AI source management, audit logs

---

## Core Data Models

### Session (V3 Schema)
- **Single merged affirmations track** + looped binaural + looped background
- Supports both binaural beats (`frequencyHz`) and solfeggio frequencies (`solfeggioHz`)
- No fixed duration (infinite loop model)
- Source types: `"catalog" | "user" | "generated"`

### Playback Bundle
- Three-track model:
  1. **Affirmations**: Merged single track (not looped)
  2. **Binaural**: Looped track (optional, alternative to solfeggio)
  3. **Background**: Looped ambient track
- Platform-specific URLs (iOS/Android)
- Mix levels: `{ affirmations, binaural, background }` (0-1 range)

### Entitlement System
- Plans: `"free" | "pro"`
- Free tier: 2 daily generations (unlimited in dev)
- Pro tier: Unlimited generations
- RevenueCat integration for subscription management

---

## Audio Engine Architecture

### Location: `packages/audio-engine`

**Key Components**:
1. **AudioEngine** (singleton): Main orchestrator
   - Manages 3 players (affirmations, binaural, background)
   - Handles playback state, mix levels, looping
   - Position polling (250ms) and control tick (75ms)

2. **AudioSession**: Audio session configuration
3. **PlayerManager**: Player lifecycle management
4. **PrerollManager**: Pre-roll atmosphere handling
5. **MixerController**: Mix automation, crossfade, control loop
6. **VoiceActivityDucker**: Ducking logic for voice activity detection

**Key Features**:
- Pre-roll atmosphere plays during bundle loading
- Automatic drift correction for looping tracks
- Voice activity detection for intelligent ducking
- Smooth crossfades and mix automation

---

## API Endpoints Overview

### Public
- `GET /health` - Health check

### User (requires auth)
- `GET /me/entitlement` - Get user entitlement status
- `POST /affirmations/generate` - Generate affirmations (rate limited)
- `POST /sessions` - Create new session
- `GET /sessions/:id` - Get session details
- `GET /sessions/:id/bundle` - Get playback bundle
- `POST /sessions/:id/ensure-audio` - Trigger audio generation job
- `GET /jobs/:id` - Get job status
- `GET /catalog/sessions` - Get catalog sessions
- `GET /curation/cards` - Get curation cards for home screen

### Admin (requires admin auth)
- Admin endpoints for moderation, AI source management, audit logs

---

## Authentication Flow

### Current State
- **API**: Uses default user ID in dev, Clerk token verification ready but not fully integrated
- **Mobile**: Clerk provider configured, tokens passed to API
- **Status**: Foundation ready, needs full integration

### Files
- `apps/api/src/lib/auth.ts` - `getUserId()` helper (ready for Clerk)
- `apps/api/src/lib/clerk.ts` - Clerk verification utilities
- `apps/api/src/middleware/auth.ts` - Auth middleware
- `apps/mobile/src/lib/auth.ts` - Mobile auth utilities

---

## State Management Patterns

### Mobile App
1. **Server State**: React Query (`@tanstack/react-query`)
   - Entitlements, sessions, catalog data
   - Automatic caching and refetching

2. **Client State**: Zustand (`useDraftStore`)
   - Draft session management
   - Persisted to AsyncStorage

3. **Audio State**: AudioEngine singleton
   - Subscribed via `engine.subscribe()`
   - Snapshot pattern for React components

### API
- Stateless (Hono handlers)
- Prisma for database access
- In-process job queue (no external queue yet)

---

## Key Files to Understand

### Mobile App
- `apps/mobile/src/App.tsx` - Root component, navigation setup
- `apps/mobile/src/screens/HomeScreen.tsx` - Main catalog/home screen
- `apps/mobile/src/screens/PlayerScreen.tsx` - Audio playback interface
- `apps/mobile/src/screens/EditorScreen.tsx` - Session creation
- `apps/mobile/src/lib/api.ts` - API client wrapper
- `apps/mobile/src/state/useDraftStore.ts` - Draft session state

### API
- `apps/api/src/index.ts` - Main API server (2000+ lines, all routes)
- `apps/api/src/services/` - Business logic services
  - `affirmation-generator.ts` - OpenAI integration
  - `audio/generation.ts` - Audio processing
  - `entitlements.ts` - Subscription logic
  - `curation.ts` - Home screen curation
- `apps/api/prisma/schema.prisma` - Database schema

### Packages
- `packages/contracts/src/schemas.ts` - Zod schemas (single source of truth)
- `packages/audio-engine/src/AudioEngine.ts` - Audio playback engine
- `packages/audio-engine/src/MixerController.ts` - Mix automation

---

## Known Issues / TODOs

### From Code Search
1. **Mobile App**:
   - `AIAffirmation/QuickGenerateFlow.tsx`: Navigation TODOs (edit, voice change, brain layer, background)
   - `OnboardingVoiceScreen.tsx`: Voice sample playback TODO
   - `ProgramsListScreen.tsx`: API call TODO

2. **API**:
   - `apps/api/src/lib/auth.ts`: Proper error response TODO

3. **Contracts**:
   - `packages/contracts/src/migrations.ts`: v1/v2 -> v3 mapping TODO

### Production Readiness
- See `PRODUCTION_INSTRUCTIONS.md` for Phase 6 checklist
- Authentication partially integrated (needs completion)
- Database migration to Postgres pending
- Job queue needs external worker (currently in-process)

---

## Design System

### Theme
- Located in `apps/mobile/src/theme/`
- Color system with light/dark mode support
- Custom fonts (Inter from `@expo-google-fonts/inter`)

### Components
- Custom UI components in `apps/mobile/src/components/`
- Reusable patterns: GlassCard, DuotoneCard, IconButton, etc.
- Bottom tab bar: Custom `FloatingTabBar` component

### Design Inspiration
- `DESIGN_INSPO/` folder exists but is currently empty

---

## Testing & Development

### Development Setup
1. Install dependencies: `pnpm install`
2. Seed database: `cd apps/api && bun prisma db seed`
3. Start API: `pnpm -C apps/api dev` (runs on port 8787)
4. Start mobile: `pnpm -C apps/mobile start`

### Environment Variables
- `OPENAI_API_KEY` - Required for affirmation generation
- `ELEVENLABS_API_KEY` - Optional (has fallback)
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - For authentication
- `DATABASE_URL` - SQLite (dev) or Postgres (production)

---

## Refactoring Considerations

### Potential Areas for Improvement

1. **API Structure**:
   - `apps/api/src/index.ts` is 2000+ lines - consider splitting into route modules
   - Service layer is well-organized, but could benefit from dependency injection

2. **Type Safety**:
   - Contracts package provides good type safety
   - Some `any` types in navigation props could be improved

3. **Error Handling**:
   - API has error handler middleware
   - Mobile app could benefit from more consistent error boundaries

4. **Code Organization**:
   - Mobile screens are well-organized
   - Some components could be split into smaller pieces
   - Audio engine is well-modularized

5. **Performance**:
   - Audio engine uses efficient polling intervals
   - React Query provides good caching
   - Consider code splitting for mobile app

6. **Testing**:
   - No test files found - consider adding unit/integration tests

---

## Documentation

### Existing Docs
- `README.md` - Quick start guide
- `docs/V3_ARCHITECTURE.md` - Architecture spec
- `MD_DOCS/` - Extensive documentation (30+ files)
- `PRODUCTION_INSTRUCTIONS.md` - Production deployment guide
- `PROGRESS.md` - Running changelog (9700+ lines)

### Documentation Quality
- Well-documented codebase
- Good inline comments in complex areas (audio engine)
- Architecture decisions documented in PROGRESS.md

---

## Next Steps for Refactoring

1. **Review current architecture** - Understand what's working well
2. **Identify pain points** - Areas that are hard to maintain or extend
3. **Plan refactoring strategy** - Incremental improvements vs. major restructuring
4. **Set priorities** - Focus on high-impact areas first
5. **Maintain documentation** - Update PROGRESS.md as changes are made

---

## Key Principles (from V3 Architecture)

1. **Single playback model**: Merged affirmations + looped binaural + looped background
2. **expo-audio only**: No expo-av
3. **Drafts are client-only**: No fake IDs, server accepts UUIDs only
4. **Versioned schemas**: Contracts package is single source of truth
5. **UI reads only EntitlementV3**: Derived fields included

Any violation of these principles is considered a bug.

