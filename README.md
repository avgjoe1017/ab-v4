# Affirmation Beats V4 (Chat-First Rebuild)

**Status**: Implementation Complete - E2E Tests Pending  
**Quick Links**: See `V4_ENGINEERING_CHECKLIST.md` for P0/P1 status and testing procedures

Monorepo layout:

- `apps/mobile-v4` — Expo React Native app (chat-first UX, minimal navigation)
- `apps/api` — Bun + Hono API server + Prisma (evolving to support V4 endpoints)
- `packages/contracts` — Zod schemas, migrations, typed errors (will extend with V4 schemas)
- `packages/audio-engine` — `expo-audio`-based singleton playback engine (3-track model)
- `packages/utils` — Pure utilities (no network/storage side-effects)

## V4 Product Thesis

V4 is a **chat-first affirmation planner**:
- The homepage is **a gentle, supportive chatbot** (the "golden flow")
- The only secondary surface is a **Library** holding:
  - Premade affirmation plans (catalog)
  - Saved plans (paid only)

## Key Changes from V3

### What Stays
- Shared packages (contracts, audio-engine, utils)
- API architecture (Bun + Hono, Prisma, jobs system, audio pipeline)
- Mobile fundamentals (Expo + React Native, Clerk auth, RevenueCat)

### What Goes
- Drawer-first navigation
- "Today" dashboard screen
- "Explore" discovery surface
- Programs flows
- Multi-step onboarding
- Legacy editor surfaces

### What Gets Rebuilt
- Session creation → Plan creation via chat
- Library → Premade plans + Saved plans (paid)
- Player → New UX + free cap behavior (3 loops)
- Entitlements → New rules (daily plan creation, loop cap, affirmation count choices, save)

## Quick Start

### Prereqs
- Node 20+ (or 22+)
- pnpm 9+
- Bun 1.1+

### Install
```bash
pnpm install
```

### Run API (dev)
```bash
pnpm -C apps/api dev
```

The API will run on `http://localhost:8787`

**Keep this terminal open** - the API must stay running.

### Run Mobile V4 (dev)
```bash
# In a NEW terminal (API server should still be running)
pnpm -C apps/mobile-v4 start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator  
- Scan QR code with Expo Go app

## V4 Development Status

See `V4_Rebuild_Outline_from_V3.md` for the complete rebuild plan.

**Current Phase**: Initial structure setup
- ✅ Monorepo root files copied
- ✅ Shared packages copied
- ✅ API structure copied (to be evolved)
- ✅ Mobile V4 structure initialized
- ⏳ V4 schemas and endpoints (next)
- ⏳ HomeChat screen implementation (next)
- ⏳ Plan Preview card (next)

## Documentation

- `V4_Rebuild_Outline_from_V3.md` - Complete V4 rebuild specification
- `PROGRESS.md` - Running log of all changes
- `PRODUCTION_INSTRUCTIONS.md` - Production deployment guide
- `MD_DOCS/` - Additional documentation from V3

## API Keys Required

**Minimum for Development**:
- `OPENAI_API_KEY` - For affirmation generation (required)
- `ELEVENLABS_API_KEY` - For TTS (optional, has fallback)

**For Production**: See `API_KEYS_REQUIRED.md` (from V3) for complete setup instructions.

## Environment

**Single `.env` file in project root** (`c:\Users\joeba\Documents\ab-v4\.env`)

**Required Environment Variables** (add to root `.env`):
```bash
OPENAI_API_KEY=sk-...  # Required for affirmation generation
ELEVENLABS_API_KEY=...  # Optional, falls back to beep TTS
EXPO_PUBLIC_API_URL=http://localhost:8787  # For mobile app to connect to API
```

Note: All apps (API, mobile-v4) read from the single root `.env` file.
