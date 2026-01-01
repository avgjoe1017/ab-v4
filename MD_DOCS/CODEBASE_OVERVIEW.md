# Affirmation Beats V3 - Codebase Overview

**Last Updated**: January 2025  
**Status**: Core Architecture Complete & Hardened

## Executive Summary

Affirmation Beats V3 is a monorepo-based React Native mobile application with a Bun + Hono API backend. The app delivers personalized affirmation audio sessions with binaural beats and ambient background music. The architecture emphasizes type safety, audio continuity, and infinite looping sessions.

## Project Structure

### Monorepo Layout

```
ab-v3/
├── apps/
│   ├── mobile/          # Expo React Native app (expo-audio)
│   ├── api/             # Bun + Hono API server + Prisma
│   └── assets/          # Shared audio assets (background, binaural, solfeggio)
├── packages/
│   ├── contracts/        # Zod schemas, migrations, typed errors (single source of truth)
│   ├── audio-engine/    # expo-audio-based singleton playback engine (3-track model)
│   └── utils/           # Pure utilities (no network/storage side-effects)
└── docs/                # Architecture documentation
```

## Technology Stack

### Mobile App (`apps/mobile`)
- **Framework**: Expo ~54.0.0, React Native 0.81.5, React 19.1.0
- **Audio**: expo-audio ~1.1.0 (3-track playback engine)
- **State Management**: Zustand (local state), TanStack Query (server state)
- **Navigation**: React Navigation (Native Stack)
- **Storage**: AsyncStorage (drafts, preferences)
- **Language**: TypeScript

### API Server (`apps/api`)
- **Runtime**: Bun 1.1+
- **Framework**: Hono 4.5.5
- **Database**: SQLite with Prisma ORM
- **Audio Processing**: FFmpeg (via fluent-ffmpeg, ffmpeg-static)
- **Validation**: Zod schemas from `@ab/contracts`
- **Job Queue**: Custom job system with worker loop

### Shared Packages
- **`@ab/contracts`**: Zod schemas, type definitions, error types
- **`@ab/audio-engine`**: Singleton audio playback engine (expo-audio wrapper)
- **`@ab/utils`**: Pure utility functions

## Core Architecture Principles

### V3 Design Philosophy

1. **Calm is the Primary Output**: No motivation, excitement, or performance pressure
2. **Audio Continuity is Sacred**: Audio never interrupts; app bends around audio
3. **No Clocks, No Finish Lines**: Sessions loop infinitely; no completion states
4. **Repetition is a Feature**: Affirmations repeat endlessly; familiarity builds trust
5. **Variation is Micro, Never Macro**: Subtle prosody shifts, not dramatic changes
6. **Silence is an Active Ingredient**: Intentional pauses for integration

### Key Architectural Decisions

- **Single Playback Model**: One merged affirmations track + looped binaural + looped background
- **expo-audio Only**: No expo-av dependency
- **Drafts are Client-Only**: No fake IDs; server accepts UUIDs only
- **Versioned Schemas**: Contracts package enforces API boundaries
- **Infinite Sessions**: No duration limits; all sessions loop until manually stopped
- **Fixed Pace**: Single "slow" pace globally; not user-configurable

## Data Models

### Core Entities (Prisma Schema)

- **User**: Authentication and preferences
- **Session**: Affirmation sessions (catalog, user-created, or generated)
- **SessionAffirmation**: Individual affirmations within a session
- **SessionAudio**: Generated audio assets for sessions
- **AudioAsset**: Cached audio files (merged affirmations, chunks, silence, background, binaural)
- **EntitlementState**: Subscription/plan status
- **EntitlementEvent**: Usage tracking for quota enforcement
- **Job**: Async job queue for audio generation

### Key Schemas (`@ab/contracts`)

- **`SessionV3`**: Server-side session representation (no durationSec, pace always "slow")
- **`DraftSession`**: Client-side draft (local UUID, not persisted to server until submitted)
- **`PlaybackBundleVM`**: Complete playback configuration (URLs, mix levels, voice activity)
- **`EntitlementV3`**: User plan, limits, and capabilities
- **`PreferencesV3`**: User preferences (voice, background, mix levels)

## Audio Pipeline

### Generation Flow

1. **TTS Generation**: Text-to-speech for each affirmation (two reads per affirmation with variation)
2. **Stitching**: FFmpeg concat filter merges affirmations + silence into single file
3. **Caching**: Asset hash prevents re-generation of identical audio
4. **Job Queue**: Async processing via `ensure-audio` jobs
5. **Storage**: Generated files stored in `apps/api/storage/merged/`

### Playback Architecture

**3-Track Model**:
1. **Affirmations Track**: Merged, looped affirmations (single file)
2. **Binaural Track**: Looped binaural beats (10Hz alpha default)
3. **Background Track**: Looped ambient music

**AudioEngine Features**:
- Singleton pattern (process-level)
- State machine: `idle` → `loading` → `ready` → `playing`
- Gain smoothing (attack/release)
- Voice activity ducking (background/binaural duck during affirmations)
- Pre-roll atmosphere (300ms fade-in before main content)
- Crossfade support
- Position polling (250ms for UI updates)
- Control tick loop (25ms for mixer/ducking)

## API Endpoints

### Core Routes (`apps/api/src/index.ts`)

- `GET /health` - Health check
- `GET /me/entitlement` - User entitlement status
- `GET /sessions` - List all sessions (lightweight)
- `POST /sessions` - Create new session from draft
- `GET /sessions/:id` - Get session details (SessionV3)
- `POST /sessions/:id/ensure-audio` - Trigger audio generation job
- `GET /sessions/:id/playback-bundle` - Get playback configuration (PlaybackBundleVM)
- `GET /jobs/:id` - Check job status
- `GET /storage/*` - Serve generated audio files (with Range request support)
- `GET /assets/*` - Serve static audio assets (background, binaural)

## Mobile App Screens

### Navigation Structure

1. **HomeScreen**: Catalog sessions, recent sessions, "New Session" button
2. **ExploreScreen**: Browse sessions by goal tags
3. **PlayerScreen**: Main playback interface with controls
4. **EditorScreen**: Create/edit custom affirmations
5. **LibraryScreen**: Saved sessions, recent, custom mixes
6. **ProgramsListScreen**: Browse structured programs
7. **ProgramDetailScreen**: Program details and progress
8. **SessionDetailScreen**: Session metadata and options
9. **SOSScreen**: Quick-start sessions for acute moments
10. **OnboardingFlow**: First-time user setup (goal, voice, behavior)

### Key Components

- **AudioEngine**: Singleton audio playback manager
- **MiniPlayer**: Global persistent mini player
- **BottomTabs**: Primary navigation
- **SessionTile**: Reusable session card component
- **AudioDebugger**: Development audio state inspector
- **TestDataHelper**: Testing utilities for development

## State Management

### Client State (Zustand)

- **`useDraftStore`**: Local draft sessions (persisted to AsyncStorage)
- **`useAudioEngineStore`**: Audio playback state (wraps AudioEngine singleton)

### Server State (TanStack Query)

- Sessions list
- Session details
- Entitlement status
- Job status polling

## Entitlements & Limits

### Free Tier Limits

- **Daily Generations**: 2 sessions per day
- **Max Session Length**: Removed (infinite sessions)
- **Offline Downloads**: Not available

### Enforcement

- Server-side validation in `POST /sessions`
- Client-side UI feedback via `useEntitlement` hook
- Daily quota tracked via `EntitlementEvent` table

## Development Workflow

### Prerequisites

- Node 20+ (or 22+)
- pnpm 9+
- Bun 1.1+

### Setup

```bash
# Install dependencies
pnpm install

# Seed database (creates test sessions)
cd apps/api
bun prisma db seed

# Run API (dev)
pnpm -C apps/api dev
# API runs on http://localhost:8787

# Run Mobile (dev) - in separate terminal
pnpm -C apps/mobile start
```

### Testing Flow

1. Open app → Home screen shows catalog sessions
2. Tap session → Player screen
3. Tap "Load" → Loads playback bundle
4. Tap "Play" → Pre-roll starts within 300ms

## Key Files Reference

### API
- `apps/api/src/index.ts` - Main API server and routes
- `apps/api/src/services/audio/generation.ts` - Audio generation pipeline
- `apps/api/src/services/audio/tts.ts` - Text-to-speech integration
- `apps/api/src/services/audio/stitching.ts` - FFmpeg audio merging
- `apps/api/src/services/jobs.ts` - Job queue system
- `apps/api/prisma/schema.prisma` - Database schema

### Mobile
- `apps/mobile/src/App.tsx` - Root component and navigation
- `apps/mobile/src/screens/PlayerScreen.tsx` - Main playback UI
- `apps/mobile/src/screens/HomeScreen.tsx` - Catalog and recent sessions
- `apps/mobile/src/lib/api.ts` - API client configuration
- `apps/mobile/src/lib/config.ts` - App configuration

### Audio Engine
- `packages/audio-engine/src/AudioEngine.ts` - Core playback engine (1148 lines)
- `packages/audio-engine/src/mixer.ts` - Volume mixing and crossfade
- `packages/audio-engine/src/ducking.ts` - Voice activity ducking
- `packages/audio-engine/src/smoothing.ts` - Gain smoothing

### Contracts
- `packages/contracts/src/schemas.ts` - Zod schemas and types
- `packages/contracts/src/errors.ts` - Typed error definitions
- `packages/contracts/src/entitlement.ts` - Entitlement logic

## Documentation Files

- `README.md` - Quick start guide
- `docs/V3_ARCHITECTURE.md` - Architecture specification
- `PROGRESS.md` - Implementation progress log
- `affirmation_beats_ux_roadmap.md` - UX and product roadmap
- `Loop-and-delivery.md` - Infinite loop and affirmation delivery rules
- `v3-improvements.md` - V3 experiential principles
- `MD_DOCS/` - Additional documentation (setup guides, testing, etc.)

## Current Status

### Completed ✅

- Core architecture (monorepo, contracts, audio engine)
- Database schema and seeding
- Audio generation pipeline (TTS, stitching, caching)
- AudioEngine with 3-track playback
- Session creation flow (draft → session → audio generation)
- Entitlement enforcement
- Basic UI screens (Home, Player, Editor, Explore)

### In Progress / Planned

- Pre-roll atmosphere implementation
- Voice activity detection and ducking refinement
- Program tracking and progress
- SOS quick-start sessions
- Onboarding flow completion
- Production deployment preparation

## Notable Implementation Details

### Audio Format

- **Format**: M4A (MP4 audio container)
- **Codec**: AAC
- **Sample Rate**: 44.1kHz
- **Bitrate**: 128kbps (for affirmations)

### Range Request Support

API implements custom Range request handling for iOS AVPlayer compatibility. Files are streamed efficiently without loading entire files into memory.

### Job Queue Pattern

Simple in-memory job queue with worker loop polling every 2 seconds. Jobs are stored in database for persistence across restarts.

### Type Safety

Strict TypeScript configuration with shared contracts package ensuring type safety across API boundaries. Zero type errors in repository-wide `tsc` check.

## Development Notes

- Uses `shamefully-hoist=true` in `.npmrc` for React Native + pnpm compatibility
- Metro bundler configured to watch workspace roots
- Default user UUID: `00000000-0000-0000-0000-000000000000` (MVP)
- Audio files stored relative to `apps/api/storage/`
- Static assets served from `apps/assets/audio/`

