# V4 REBUILD OUTLINE (FROM V3)

Date: 2025-12-29  
Project: Affirm Beats (Mobile + API)

---

## 0) What V3 is today (baseline)

### Monorepo shape (V3)
- `apps/mobile` - Expo + React Native app (React Navigation + Drawer)
- `apps/api` - Bun + Hono API server, Prisma DB, audio generation pipeline (OpenAI TTS + ffmpeg), S3 storage
- `packages/contracts` - Shared Zod schemas + types (SessionV3, EntitlementV3, PlaybackBundleVM, etc.)
- `packages/audio-engine` - Client audio engine (multi-track mixing, drift correction, ducking, preroll)
- `packages/utils` - Shared utilities

### What V3 currently optimizes for
- Multiple entry points (Today / Explore / Compose / Library / Settings)
- “Session” as the core unit (a title + affirmations + voice + binaural/solfeggio), then server generates a merged affirmations track and client layers background + binaural/solfeggio underneath
- Background + binaural loops are effectively infinite in V3 (no fixed session duration)

---

## 1) V4: Product thesis + non-negotiables

### V4 thesis
V4 is a **chat-first affirmation planner**:
- The homepage is **a gentle, supportive chatbot** (the “golden flow”).
- The only secondary surface is a **Library** holding:
  - Premade affirmation plans (catalog)
  - Saved plans (paid only)

### Non-negotiables (from this thread)
- Do not lock final UX without reviewing with you first.
- Free + Paid must both feel attractive; Paid must clearly show value.
- Chat tone must be gentle, supportive, non-clinical.
  - Example openers (rotating, not quirky):
    - “What’s on your mind today?”
    - “What would help right now?”
    - “What feels heavy today?”
    - “How can I support you?”

---

## 2) V4 UX / IA (screens + states)

### 2.1 Navigation (V4)
Minimal by design:
- **Chat (Home)** - default
- **Library** - premade + saved
- **Settings/Profile** - reachable from top-right icon (not a full nav destination)

No “Explore,” no “Programs,” no multi-screen onboarding sequences.

---

### 2.2 Screen: HomeChat (the homepage)

#### A) Idle state (first open / returning)
- Header: app name + small profile/settings icon
- Center: subtle “presence” element (soft orb / mark) and a single prompt line (rotating opener)
- Below: suggestion chips/cards (optional, subtle)
  - “Confidence at work”
  - “Calm my anxiety”
  - “Sleep tonight”
  - “Stop overthinking”
- Bottom composer: single-line input + send

#### B) Conversation loop
- User types a thought (freeform)
- Bot responds in 1–2 short messages, then either:
  1) Asks one clarifying question, or
  2) Offers quick choice chips (e.g., Work / Relationships / Health / Money / Sleep), or
  3) Moves to “Plan Preview” if sufficient

#### C) Plan Preview card (critical transition state)
A single “Plan” card appears in the chat:
- Title (auto): “Steady Confidence” / “Sleep Tonight” / etc.
- Affirmations list (6 by default; paid can choose 6/12/18/24)
- Controls (tier-gated):
  - **Edit affirmations**
    - Free: allowed for this plan only (no saving edits)
    - Paid: edit + save
  - **Regenerate**
    - Free: up to N rerolls before “Start Session” (recommended: 2–3)
    - Paid: unlimited
  - **Audio options**
    - Free: voice = Male/Female only; other audio settings locked
    - Paid: voice pick + binaural/solfeggio + background pick

#### D) Commit action: “Start Session”
- Once user taps **Start Session**, the plan becomes “used” for quota purposes.
- This resolves the key red-team risk:
  - Free users are not punished for a “bad generation” before they start.

---

### 2.3 Screen: Audio Settings (inline sheet or modal)
In V4 this should not feel like a “settings maze.” It’s one sheet.

- **Paid only**
  - Voice (full list)
  - Brain track mode:
    - Binaural (choose state or recommended default)
    - Solfeggio (select Hz)
  - Background selection (atmospheres)
  - Mix levels (optional, advanced)

- **Free**
  - Voice: Male/Female picker (ideally only shown once, then remembered)
  - Brain track + background: default

---

### 2.4 Screen: Player (session playback)

#### Player goals
- Feels calm and “ritual-like”
- One primary visual element (living orb / subtle animation)
- Simple controls:
  - Play/Pause
  - Skip affirmation (optional)
  - Volume / mix (Paid only)
  - “End session” (confirm)

#### Free cap behavior (Option A you chose)
- Free: **3 full loops max**
- Paid: **unlimited duration**

UX requirements for the cap:
- Do not hard-stop abruptly.
- Fade voice track gently; keep background continuing briefly if needed.
- End card appears:
  - “Want to keep going?” + Paid value bullets
  - No guilt, no pressure

---

### 2.5 Screen: Library

#### Library sections
- **Premade Plans** (available to all; exact limits defined below)
- **Saved Plans** (Paid only; Free sees an empty state + gentle upsell)
- Optional: “Recently played” (can be local-only, no backend required)

#### Premade Plans behavior (must be explicit to avoid confusion)
V4 must clearly define:
- Whether Free can play premades unlimited (recommended: allow, but enforce the same loop cap)
- Whether Free has a daily “play” limit (if needed, do it softly)

Recommendation for clarity and monetization alignment:
- Free can play premades, but:
  - Same 3-loop cap
  - No saving
  - No advanced audio choices

---

### 2.6 Settings / Profile
- Subscription status + manage plan (RevenueCat)
- Privacy + data controls (see section 7)
- Safety and disclaimers
- Support/contact

---

## 3) Free vs Paid: Tier definition (current decisions)

### 3.1 Free tier
- **1 new plan per day**
  - Counts when user taps **Start Session**, not when the plan preview is shown
- **No save**
- **Affirmations per plan:** 6
- **Playback:** 3 full loops max
- **Voice:** Male or Female only
- Likely: high % of free plans are satisfied by **pre-recorded/premade** plans to reduce generation costs (server chooses best match)

### 3.2 Paid tier
- Unlimited generations
- Save plans (and edits)
- Unlimited duration
- Affirmations per plan: 6 / 12 / 18 / 24
- Voice selection (full)
- Choose Binaural vs Solfeggio
- Choose Background
- Write your own affirmations (create and save)

### 3.3 Key red-team updates to bake in
- Free rerolls before start: 2–3 regen attempts max
- Chat fatigue shortcut: “Same as yesterday?” chip (for returning users)
- Validation mode: if distress is detected (not crisis), affirmations shift to grounded acceptance language
- Error states: network drop, TTS failure, audio not ready, etc. must have graceful UX
- Privacy clarity: must define what is stored, retention, delete controls

---

## 4) V3 → V4: What stays, what goes, what gets rebuilt

### 4.1 What stays from V3 (carry forward)

#### Shared packages
- `packages/contracts`
  - Keep the shared-schema pattern (Zod + types)
  - Add V4 schemas (PlanV4, EntitlementV4, ChatTurnV4, etc.)
- `packages/audio-engine`
  - Keep the multi-track playback architecture (affirmations + background + binaural/solfeggio)
  - Keep drift correction + ducking + preroll concepts
- `packages/utils`
  - Keep shared helpers

#### API architecture (apps/api)
Keep the structural decisions:
- Bun runtime + Hono routing
- Prisma for DB
- Jobs system for async audio generation (`services/jobs`)
- Audio pipeline (`services/audio/*`):
  - TTS generation
  - Stitching/merging
  - Loudness normalization
  - Voice-activity metadata (if still needed)
- Storage layer (`services/storage/s3.ts`)
- Moderation service (`services/moderation.ts`)
- Entitlements service (`services/entitlements.ts`) + RevenueCat integration (`services/revenuecat.ts`)
- Rate limiting (`services/rate-limit.ts`)

#### Mobile fundamentals
- Expo + React Native baseline (unless you explicitly decide otherwise)
- Clerk auth patterns (or skip-auth for dev)
- RevenueCat initialization + entitlements fetch
- API client approach (`src/lib/api.ts`) and react-query usage

---

### 4.2 What goes from V3 (remove entirely in V4)
V4 is a rebuild, so these surfaces should be treated as “retired,” not refactored.

#### Navigation / structure
- Drawer-first navigation (`MainDrawer`)
- “Today” as a dashboard screen
- “Explore” as a major discovery surface

#### Screens to retire
- `HomeScreen.tsx` (replaced by HomeChat)
- `ExploreScreen.tsx` (replaced by Library only)
- Programs flows:
  - `ProgramsListScreen.tsx`
  - `ProgramDetailScreen.tsx`
  - Program progress tracking hooks
- Multi-step onboarding flows:
  - `OnboardingFlow.tsx`
  - `ValueSelection/Ranking/Education`
  - `StruggleInputScreen.tsx`
  - (Replace with light onboarding + in-chat)
- Legacy editor surfaces:
  - `EditorScreen.tsx` (legacy)
  - Multi-step “AIAffirmation” guided flows (replace with chat plan preview)
- Demo/dev screens:
  - `ComponentComparisonScreen.tsx`
  - `BNAUIComponentsScreen.tsx`
  - `ParallaxExampleScreen.tsx`
  - `OnboardingExampleScreen.tsx`

---

### 4.3 What gets rebuilt (concept stays, implementation changes)
- Session creation → becomes Plan creation via chat
- Library → becomes:
  - Premade plans (catalog)
  - Saved plans (paid)
- Player → same job, but new UX + free cap behavior
- Entitlements → new rules: daily plan creation, loop cap, affirmation count choices, save

---

## 5) V4 file structure (proposed)

### 5.1 Monorepo (V4)
Recommendation: build in parallel to reduce risk.
- `apps/mobile-v4/` (new)
- `apps/api/` (evolve in place; keep routes backward compatible during transition)
- `packages/contracts/` (extend with V4 schemas)
- `packages/audio-engine/` (minor updates only)
- `packages/ui/` (optional: shared chat components, tokens)

### 5.2 Mobile (apps/mobile-v4) feature-based layout
```
apps/mobile-v4/
  src/
    app/
      navigation/           # minimal nav (Chat, Library, Settings modal)
    features/
      chat/
        components/
        state/
        api/
        HomeChatScreen.tsx
      plan/
        components/          # Plan preview card, affirmation editor
        state/
        api/
      library/
        components/
        api/
        LibraryScreen.tsx
      player/
        components/
        state/
        PlayerScreen.tsx
      paywall/
        components/
        PaywallSheet.tsx
    services/
      apiClient.ts
      entitlement.ts
      audio/
        audioEngine.ts       # wrapper around packages/audio-engine
    ui/
      components/
      tokens/
      typography/
    storage/
      localDb.ts             # saved local-only stuff (recent plays, draft cache)
```

---

## 6) API + DB updates (V4)

### 6.1 New core concept: Plan
V4 treats “Plan” as the unit:
- A plan contains:
  - A title
  - An intent/context (user input)
  - N affirmations (6/12/18/24)
  - Audio choices (voice, binaural/solfeggio, background)
  - Save state (paid)
  - Playback policy (free loop cap)

V3 “Session” can remain under the hood during transition (Plan maps to Session until V4 fully lands).

### 6.2 API endpoints (proposed)
Keep existing endpoints for compatibility; add V4 endpoints.

#### Chat + plan creation
- `POST /v4/chat/turn`
  - input: `{ threadId?, message, locale?, clientContext? }`
  - output: `{ threadId, assistantMessages[], suggestedChips[], planPreview? }`

- `POST /v4/plans/commit`
  - input: `{ threadId, planDraftId, selections }`
  - server enforces entitlement limits
  - output: `{ planId, audioJobId? }`

#### Plan retrieval + playback
- `GET /v4/plans/:id`
- `POST /v4/plans/:id/ensure-audio`
- `GET /v4/plans/:id/playback-bundle`

#### Library
- `GET /v4/library/premade`
- `GET /v4/library/saved` (paid)
- `POST /v4/library/save/:planId` (paid)
- `DELETE /v4/library/save/:planId` (paid)

#### Entitlements / usage
- `GET /me/entitlement` (extend response to EntitlementV4 fields)
- `GET /v4/me/usage` (optional explicit endpoint)

### 6.3 EntitlementV4 (contracts)
Replace/extend EntitlementV3 limits with V4-specific fields:
- Free:
  - `dailyPlans: 1`
  - `maxLoopsPerPlayback: 3`
  - `affirmationCountsAllowed: [6]`
  - `canSave: false`
  - `voicesAllowed: ["male","female"]`
- Paid:
  - `dailyPlans: unlimited`
  - `maxLoopsPerPlayback: unlimited`
  - `affirmationCountsAllowed: [6,12,18,24]`
  - `canSave: true`
  - `voicesAllowed: all`
  - `canPickBrainTrack: true`
  - `canPickBackground: true`

### 6.4 Pre-recorded fallback (cost control)
Add a server-side strategy:
- For Free, attempt to match the user’s intent to an existing **catalog plan**.
  - If match confidence ≥ threshold, return that premade plan (no generation cost)
  - Else generate new plan (counts toward daily limit)

### 6.5 DB (Prisma) additions (proposed)
Add tables (names illustrative):
- `ChatThread`, `ChatMessage`
- `Plan`, `PlanAffirmation`
- `PlanSave` (user ↔ plan)
- `UsageLedger` (daily plan usage, rerolls, etc.)

Extend `Session` (if reusing) with:
- `planId` foreign key or `source="plan_v4"`
- fields for backgroundId, brainTrackMode

---

## 7) Error handling + safety + privacy (must be in V4 spec)

### 7.1 Error states that must exist (no “happy path only”)
- TTS generation fails
- Job stuck / times out
- Network drops mid-playback
- App closed during plan generation
- Audio asset missing
- Entitlement fetch fails

Each has:
- A user-friendly message
- A retry action
- A fallback (premade plan, default voice, local “Try again later”)

### 7.2 Safety behavior (from your golden flow spec)
- Crisis/self-harm detection routes user to emergency guidance
- No upsell during crisis
- “Validation mode” for high distress but non-crisis content

### 7.3 Privacy decisions to make explicit in V4
V4 cannot be vague here.
Must define:
- Are chat transcripts stored?
- Retention window (e.g., 30 days / until delete)
- Delete controls (per thread or all)
- Whether any data is used for model training (recommended: no)
- Local vs server storage boundaries

---

## 8) Migration plan (V3 → V4)
- Build V4 in parallel (`apps/mobile-v4`)
- Keep API backward compatible:
  - V3 uses `/sessions/*`
  - V4 uses `/v4/*`
- Once V4 UX is final, decide:
  - Either map V4 Plans onto existing Session table, or
  - Introduce new Plan tables and keep Sessions for legacy

---

## 9) Concrete deliverables to review with you before coding V4
These are the “lock the UX” checkpoints:
1) HomeChat wireframe states (Idle → Conversation → Plan Preview → Start)
2) Plan Preview card: controls, tiers, copy
3) Free cap experience (3 loops): fade + end card behavior
4) Library layout + Free vs Paid visibility rules
5) Minimal onboarding (voice pick + one-screen “what this is / isn’t”)
6) Privacy language + data retention choices

---

## Appendix A: V3 inventory (paths you’ll see during rebuild)

### Mobile V3 key folders
- `apps/mobile/src/screens/*` (most retired in V4)
- `apps/mobile/src/screens/ChatComposer/*` (conceptually reused; UI rebuilt)
- `apps/mobile/src/lib/*` (keep selective: api, auth, revenuecat, config)
- `apps/mobile/src/state/*` (keep patterns; rewrite stores for V4)

### API V3 key folders (mostly retained)
- `apps/api/src/services/audio/*`
- `apps/api/src/services/jobs.ts`
- `apps/api/src/services/entitlements.ts`
- `apps/api/src/services/moderation.ts`
- `apps/api/prisma/*`
