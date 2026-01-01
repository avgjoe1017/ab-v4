# Codebase Structure & Purpose

**Date**: January 2025  
**Project**: Affirmation Beats V3 - Monorepo Architecture

## Overview

This is a **monorepo** (pnpm workspaces) for an affirmation audio app that combines:
- Custom text-to-speech affirmations
- Binaural beats (brainwave entrainment)
- Background ambient sounds
- All mixed and looped for continuous playback

The architecture follows a strict **V3 Start-Fresh** design with clear separation of concerns.

---

## Root Structure

```
ab-v3/
├── apps/              # Applications (runnable services)
├── packages/          # Shared libraries
├── assets/            # Audio assets (binaural, background, solfeggio)
├── DESIGN_INSPO/      # Design reference images and code
├── MD_DOCS/           # Documentation files
├── docs/              # Architecture documentation
└── [config files]     # Root-level configuration
```

---

## 📱 `apps/` - Applications

### `apps/mobile/` - React Native Mobile App (Expo)

**Purpose**: The main user-facing mobile application built with Expo and React Native.

#### Key Files:
- **`index.js`** - Expo entry point
- **`app.json`** - Expo configuration
- **`package.json`** - Mobile app dependencies (expo-audio, react-navigation, zustand, etc.)
- **`metro.config.js`** - Metro bundler config for monorepo support

#### `apps/mobile/src/` - Source Code

**`App.tsx`**
- Root component with navigation setup
- Initializes preroll audio asset URI for AudioEngine
- Sets up React Query, Navigation, SafeAreaProvider

**`screens/`** - Screen Components
- **`HomeScreen.tsx`** - Main catalog view showing available sessions
  - Displays catalog sessions from API
  - Shows currently playing session
  - Navigation to Player/Editor/Explore
- **`PlayerScreen.tsx`** - Audio playback interface
  - Loads playback bundle from API
  - Controls AudioEngine (play/pause/seek)
  - Mix controls (affirmations/binaural/background volumes)
  - Handles audio generation job polling
- **`EditorScreen.tsx`** - Session creation interface
  - Uses `useDraftStore` for local draft management
  - Creates new sessions via `POST /sessions`
- **`ExploreScreen.tsx`** - Discovery/browse interface
  - Search and filter sessions
  - Goal-based recommendations

**`components/`** - Reusable Components
- **`AudioDebugger.tsx`** - Development tool for audio state inspection
- **`TestDataHelper.tsx`** - Testing utilities for generating test data

**`hooks/`** - Custom React Hooks
- **`useEntitlement.ts`** - Fetches user entitlement status from API
  - Uses React Query to cache entitlement data
  - Returns plan, limits, and quota information

**`lib/`** - Utility Libraries
- **`api.ts`** - HTTP client wrapper (`apiGet`, `apiPost`)
- **`config.ts`** - API base URL configuration
  - Handles platform-specific URLs (iOS simulator, Android emulator, physical device)
  - Uses IP address for physical device testing
- **`prerollAsset.ts`** - Preroll asset URI resolution helpers

**`state/`** - State Management
- **`useDraftStore.ts`** - Zustand store for draft session management
  - Persists to AsyncStorage
  - Manages local draft before submission to API
  - Generates UUIDs for draft IDs
- **`appMode.ts`** - App mode state (if needed for future features)

**`repositories/`** - Data Access Layer
- **`README.md`** - Placeholder for future repository pattern implementation

**`assets/audio/`** - Mobile App Assets
- **`preroll_atmosphere.m4a`** - Pre-roll audio file played during bundle loading
- **`README.md`** - Asset documentation

---

### `apps/api/` - Backend API Server (Bun + Hono)

**Purpose**: RESTful API server handling sessions, audio generation, and entitlements.

#### Key Files:
- **`src/index.ts`** - Main API server entry point
  - Hono app setup
  - Route handlers for sessions, entitlements, playback bundles
  - Static file serving for `/storage/*` and `/assets/*` with Range request support
  - Bun server initialization on port 8787

#### `apps/api/src/` - Source Code

**`lib/`** - Shared Libraries
- **`db.ts`** - Prisma client singleton
  - Prevents multiple Prisma instances (fixes SQLite lock issues)
  - Exports `prisma` instance for all services

**`services/`** - Business Logic Services

**`services/audio/`** - Audio Processing
- **`generation.ts`** - Audio generation pipeline
  - `generateSilenceFile()` - Creates silence chunks via FFmpeg
  - `pregenerateSilenceChunks()` - Pre-generates all silence durations
  - `ensureAffirmationChunk()` - Generates TTS audio for individual affirmations
  - `ensureAffirmationMerged()` - Stitches affirmations + silence into merged file
  - `processEnsureAudioJob()` - Job processor for async audio generation
- **`tts.ts`** - Text-to-Speech service
  - Supports multiple providers: OpenAI, ElevenLabs, Azure, or beep fallback
  - `generateTTSAudio()` - Main TTS generation function
  - Provider selection via `TTS_PROVIDER` env var
- **`stitching.ts`** - Audio file concatenation
  - `stitchAudioFiles()` - Uses FFmpeg concat filter to merge audio files
  - Creates temporary concat list file
- **`assets.ts`** - Asset URL resolution
  - `getBinauralAsset()` - Returns platform-aware binaural beat URLs
  - `getBackgroundAsset()` - Returns platform-aware background sound URLs
  - Handles URL encoding for filenames with spaces
- **`constants.ts`** - Audio processing constants
  - Storage directory paths (`CHUNKS_DIR`, `MERGED_DIR`, `TEMP_DIR`)
  - Imports `AUDIO_PROFILE_V3` and `SILENCE_DURATIONS_MS` from contracts

**`services/entitlements.ts`**
- `getEntitlement()` - Calculates user entitlement status
  - Checks daily generation limits
  - Returns `EntitlementV3` with plan, limits, and quotas

**`services/jobs.ts`**
- `createJob()` - Creates async job in database
- `getJob()` - Retrieves job status
- `updateJobStatus()` - Updates job status (processing/completed/failed)
- `triggerJobProcessing()` - Fire-and-forget job processor trigger

#### `apps/api/prisma/` - Database

**`schema.prisma`** - Prisma schema definition
- **Models**:
  - `User` - User accounts
  - `Preferences` - User preferences (versioned JSON)
  - `Session` - Affirmation sessions (catalog or user-created)
  - `SessionAffirmation` - Individual affirmations in a session
  - `AudioAsset` - Cached audio files (chunks, merged, silence)
  - `SessionAudio` - Links sessions to generated audio
  - `EntitlementState` - User subscription/plan status
  - `EntitlementEvent` - Entitlement change history
  - `Job` - Async job queue
- **Database**: SQLite (dev) - can be swapped to PostgreSQL for production

**`migrations/`** - Database migrations
- **`20251213064853_init/`** - Initial schema migration
- **`migration_lock.toml`** - Prisma migration lock file

**`seed.ts`** - Database seeding script
- Creates 3 catalog sessions: "Morning Affirmations", "Sleep & Relax", "Focus Boost"
- Pre-generates silence chunks (V3 compliance)
- Run via: `bun prisma db seed`

**`verify-seed.ts`** - Seed verification script

#### `apps/api/scripts/` - Utility Scripts
- **`generate-preroll.ts`** - Generates preroll atmosphere audio
- **`setup-tts.ts`** - TTS provider setup helper
- **`verify-tts.ts`** - TTS provider verification

#### `apps/api/` - Test/Verification Files
- **`test-audio-flow.ts`** - Audio generation flow testing
- **`test-session-flow.ts`** - Session creation flow testing
- **`verify-api.ts`** - API endpoint verification
- **`debug-ffmpeg.ts`** - FFmpeg debugging utility

---

### `apps/assets/` - Shared Audio Assets

**Purpose**: Audio files used by both API (for serving) and mobile app (for bundling).

**Structure**:
- **`audio/background/looped/`** - Looped background ambient sounds
  - Files: `Babbling Brook.m4a`, `Birds Chirping.m4a`, `Distant Ocean.m4a`, etc.
- **`audio/binaural/`** - Binaural beat files
  - Files: `alpha_10hz_400_3min.m4a`, `beta_20hz_120_3min.m4a`, etc.
  - Organized by brainwave frequency (alpha, beta, gamma, delta, theta)
- **`audio/solfeggio/`** - Solfeggio frequency files
  - Files: `solfeggio_174_3min.m4a`, `solfeggio_432_3min.m4a`, etc.

**Note**: These are served via API's `/assets/*` endpoint with Range request support for streaming.

---

## 📦 `packages/` - Shared Libraries

### `packages/contracts/` - Type Definitions & Schemas

**Purpose**: Single source of truth for all data types, validation schemas, and API contracts.

**Key Files**:
- **`src/schemas.ts`** - Zod schemas for all data types
  - `MixSchema` - Volume mix (affirmations, binaural, background)
  - `PreferencesV3Schema` - User preferences (voice, pace, mix, etc.)
  - `DraftSessionSchema` - Client-side draft session (before submission)
  - `SessionV3Schema` - Server-side session model
  - `PlaybackBundleVMSchema` - Playback bundle with URLs and mix settings
  - `EntitlementV3Schema` - User entitlement/plan information
- **`src/constants.ts`** - Shared constants
  - `AUDIO_PROFILE_V3` - Audio encoding specs (MP3, 128kbps, 44.1kHz)
  - `SILENCE_DURATIONS_MS` - Pre-defined silence chunk durations
- **`src/errors.ts`** - API error types
  - `ApiErrorCode` - Enum of error codes
  - `ApiError` - Error response type
- **`src/entitlement.ts`** - Entitlement derivation logic
  - `deriveEntitlement()` - Calculates derived fields (canCreateSession, etc.)
- **`src/migrations.ts`** - Schema migration utilities
  - `migratePreferences()` - Migrates old preference formats to V3
- **`src/index.ts`** - Public exports

**Usage**: Imported by both `apps/mobile` and `apps/api` for type safety and validation.

---

### `packages/audio-engine/` - Audio Playback Engine

**Purpose**: Singleton audio playback engine managing 3-track playback (affirmations, binaural, background).

**Key Files**:
- **`src/AudioEngine.ts`** - Main engine class
  - **Singleton Pattern**: `getAudioEngine()` returns single instance
  - **3-Track Model**:
    1. Affirmations track (merged TTS audio) - loops infinitely
    2. Binaural track (brainwave entrainment) - loops
    3. Background track (ambient sounds) - loops
  - **State Machine**: `idle` → `preroll` → `loading` → `ready` → `playing` → `paused`
  - **Pre-roll Support**: Plays atmosphere audio while main tracks load (< 300ms target)
  - **Mix Control**: Independent volume control for each track
  - **Position Polling**: Updates position every 250ms during playback
  - **Command Queue**: Serializes async operations to prevent race conditions
- **`src/types.ts`** - Type definitions
  - `AudioEngineStatus` - Status enum
  - `AudioEngineSnapshot` - Current state snapshot
  - `Mix` - Volume mix type
- **`src/index.ts`** - Public exports

**Dependencies**: 
- `expo-audio` (peer dependency)
- `@ab/contracts` (for `PlaybackBundleVM` type)

**Usage**: Imported by `apps/mobile` for all audio playback operations.

---

### `packages/utils/` - Pure Utility Functions

**Purpose**: Shared utility functions with no side effects (no network, no storage).

**Key Files**:
- **`src/index.ts`** - Utility functions
  - `assertNever()` - TypeScript exhaustiveness checking
  - `sleep()` - Promise-based delay

**Usage**: Can be imported by any package/app for common utilities.

---

## 🎨 `DESIGN_INSPO/` - Design References

**Purpose**: Design inspiration and reference materials for UI implementation.

**Structure**:
- **`homepage/`** - Home screen design reference
  - `screen.png` - Screenshot
  - `code.html` - HTML/CSS reference implementation
- **`player/`** - Player screen design reference
  - `screen.png` - Screenshot
  - `code.html` - HTML/CSS reference implementation
- **`explore/`** - Explore screen design reference
  - `screen.png` - Screenshot
  - `code.html` - HTML/CSS reference implementation

---

## 📚 `MD_DOCS/` - Documentation

**Purpose**: Supplemental documentation files (per user rules).

**Key Files**:
- **`CODEBASE_REVIEW.md`** - Codebase review notes
- **`AUDIO_FIX_SUMMARY.md`** - Audio-related fixes documentation
- **`DATABASE_LOCK_FIX.md`** - Database locking issue resolution
- **`MIGRATION_FIX.md`** - Migration troubleshooting
- **`PREROLL_TESTING_STATUS.md`** - Pre-roll feature testing status
- **`PRODUCTION_READINESS_PLAN.md`** - Production deployment checklist
- **`SEED_INSTRUCTIONS.md`** - Database seeding instructions
- **`TESTING_CHECKLIST.md`** - Testing procedures
- **`TTS_SETUP_GUIDE.md`** - TTS provider setup instructions
- **`V3_COMPLIANCE_REPORT.md`** - V3 architecture compliance report
- **`DEBUG_REPORT.md`** - Debugging notes
- **`CODEBASE_STRUCTURE.md`** - This file

---

## 📖 `docs/` - Architecture Documentation

**Purpose**: High-level architecture and design documents.

**Key Files**:
- **`V3_ARCHITECTURE.md`** - V3 architecture specification
  - Defines single merged affirmations track model
  - `expo-audio` only (no `expo-av`)
  - Client-only drafts (no fake IDs)
  - Versioned schemas at boundaries

---

## 🔧 Root Configuration Files

### Package Management
- **`package.json`** - Root package.json for monorepo
  - Defines workspaces: `apps/*`, `packages/*`
  - Root-level scripts: `dev`, `lint`, `typecheck`, `format`
- **`pnpm-workspace.yaml`** - pnpm workspace configuration
- **`pnpm-lock.yaml`** - pnpm lockfile
- **`bun.lock`** - Bun lockfile (for API server)
- **`.npmrc`** - npm/pnpm configuration
  - `shamefully-hoist=true` - Fixes React Native module resolution

### TypeScript
- **`tsconfig.base.json`** - Base TypeScript configuration
  - Strict mode enabled
  - ES2022 target
  - ESNext modules
  - Used by all packages/apps

### Git
- **`.gitignore`** - Git ignore patterns

---

## 📝 Root Documentation Files

### Setup & Quick Start
- **`README.md`** - Main project README with quick start instructions
- **`QUICK_SETUP.md`** - Quick setup guide
- **`QUICK_START_TESTING.md`** - Testing instructions
- **`START_API.md`** - API server startup guide

### Feature Documentation
- **`GET_REAL_AUDIO.md`** - Real audio generation setup
- **`SETUP_TTS_NOW.md`** - TTS provider setup
- **`preroll-atmos.md`** - Pre-roll atmosphere feature documentation
- **`Loop-and-delivery.md`** - Infinite loop playback specification
- **`v3-improvements.md`** - V3 improvements list

### Troubleshooting
- **`FIX_API_CONNECTION.md`** - API connection issues
- **`FIX_PORT_IN_USE.md`** - Port conflict resolution
- **`VERIFY_CONNECTION.md`** - Connection verification steps
- **`TESTING_SUMMARY.md`** - Testing summary and results

### Production
- **`PRODUCTION_INSTRUCTIONS.md`** - Production deployment instructions
- **`PROGRESS.md`** - Development progress log (running document)

### Legacy/Reference
- **`homescreen.tsx`** - Legacy home screen implementation (reference)
- **`player_page_inspo.tsx`** - Legacy player page reference

---

## 🗂️ `assets/` - Root Assets Directory

**Purpose**: Additional audio assets (may be legacy or alternative location).

Contains 23 `.m4a` files (likely duplicates or alternative organization of audio assets).

---

## Data Flow Overview

### Session Creation Flow
1. User creates draft in `EditorScreen` → stored in `useDraftStore` (local)
2. User saves → `POST /sessions` with `DraftSession`
3. API validates → creates `Session` in database
4. API triggers `ensure-audio` job → generates TTS + stitches audio
5. Client polls `/jobs/:id` → waits for completion
6. Client fetches `/sessions/:id/playback-bundle` → gets URLs
7. `PlayerScreen` calls `AudioEngine.load(bundle)` → loads 3 tracks
8. User taps play → `AudioEngine.play()` → starts playback

### Audio Generation Flow
1. `POST /sessions/:id/ensure-audio` → creates job
2. Job processor calls `processEnsureAudioJob()`
3. For each affirmation → `ensureAffirmationChunk()` → TTS generation
4. Stitch affirmations + silence → `ensureAffirmationMerged()`
5. Save to `AudioAsset` table → cache for future use
6. Link to session via `SessionAudio`

### Playback Flow
1. `AudioEngine.load(bundle)` → creates 3 `AudioPlayer` instances
2. Pre-roll starts immediately (if configured)
3. Main tracks load in parallel
4. When ready → crossfade from pre-roll to main tracks
5. All 3 tracks play simultaneously with independent volume control
6. Affirmations track loops infinitely (V3 Loop model)

---

## Key Architectural Decisions

### V3 Start-Fresh Architecture
- **Single merged affirmations track** (not separate chunks)
- **Infinite loop playback** (no fixed duration)
- **`expo-audio` only** (no legacy `expo-av`)
- **Client-only drafts** (UUIDs generated client-side)
- **Versioned schemas** (Zod validation at boundaries)
- **3-track model** (affirmations + binaural + background)

### Monorepo Structure
- **Clear separation**: `apps/` for runnable services, `packages/` for shared code
- **Type safety**: Shared contracts package ensures API/client consistency
- **Workspace dependencies**: `@ab/audio-engine`, `@ab/contracts`, `@ab/utils`

### Database Design
- **SQLite for dev** (easy local development)
- **Prisma ORM** (type-safe database access)
- **Singleton Prisma client** (prevents connection exhaustion)
- **Audio asset caching** (prevents re-generation of identical content)

### Audio Processing
- **FFmpeg-based** (via `ffmpeg-static`)
- **Pre-generated silence chunks** (V3 compliance)
- **TTS provider abstraction** (OpenAI, ElevenLabs, Azure, or beep fallback)
- **Platform-aware URLs** (iOS vs Android asset serving)

---

## Technology Stack

### Mobile App
- **React Native** (0.81.5)
- **Expo** (~54.0.0)
- **expo-audio** (~1.1.0) - Audio playback
- **React Navigation** - Navigation
- **Zustand** - State management
- **React Query** - Data fetching/caching
- **TypeScript** - Type safety

### API Server
- **Bun** (1.1+) - Runtime
- **Hono** - Web framework
- **Prisma** - ORM
- **SQLite** - Database (dev)
- **FFmpeg** - Audio processing
- **Zod** - Schema validation

### Shared
- **TypeScript** - Language
- **Zod** - Runtime validation
- **pnpm** - Package manager

---

## Environment Variables

### `apps/api/.env`
- `DATABASE_URL` - SQLite database path
- `TTS_PROVIDER` - TTS provider (openai, elevenlabs, azure, beep)
- `OPENAI_API_KEY` - OpenAI API key (if using OpenAI)
- `ELEVENLABS_API_KEY` - ElevenLabs API key (if using ElevenLabs)
- `AZURE_TTS_KEY` - Azure TTS key (if using Azure)
- `API_BASE_URL` - API base URL for asset serving
- `PORT` - API server port (default: 8787)

### `apps/mobile/.env` (optional)
- `API_BASE_URL` - API server URL (defaults to platform-specific logic in `config.ts`)

---

## Development Workflow

1. **Start API**: `pnpm -C apps/api dev` (runs on port 8787)
2. **Start Mobile**: `pnpm -C apps/mobile start` (Expo dev server)
3. **Seed Database**: `cd apps/api && bun prisma db seed`
4. **Build Packages**: `pnpm -r build` (builds all packages)

---

## Testing Strategy

- **Manual Integration Testing**: Via test scripts in `apps/api/`
- **UI Testing**: Manual testing via Expo Go or simulators
- **Audio Testing**: Verify pre-roll, playback, mixing, looping
- **API Testing**: Verify endpoints via `verify-api.ts`

---

## Future Considerations

- **Production Database**: Migrate from SQLite to PostgreSQL
- **Audio Storage**: Move from local filesystem to S3/cloud storage
- **Job Queue**: Replace in-memory job processing with proper queue (Redis, etc.)
- **Authentication**: Add real user authentication (currently uses default user)
- **Offline Support**: Cache playback bundles for offline playback
- **Analytics**: Add usage tracking and analytics

---

**Last Updated**: January 2025  
**Maintained By**: Development Team
