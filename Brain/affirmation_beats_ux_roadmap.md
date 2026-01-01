# Affirmation Beats UX + Product Roadmap

## North Star
Deliver a premium, audio-first experience that reduces decision fatigue and helps users reliably reach a desired mental state (calm, focus, sleep, confidence) with one tap.

## Product Principles
- One primary action per screen.
- Fewer choices, higher confidence.
- Audio reliability first (fast start, stable playback, graceful failures).
- Cohesive visual system across all screens.
- “Progress without guilt” (no shame loops, no noisy gamification).

---

## Information Architecture Target
### Primary navigation (recommended)
- **Today** (current Home)
- **Explore**
- **Programs**
- **Library**
- Global: **Now Playing** (mini player) + **SOS** entry (Today + Player)

### Key new pages
- **Programs List**
- **Program Detail** (days, preview, start/resume)
- **SOS** (quick-start sessions)
- **Library** (Saved, Recent, My Mixes)
- **Session Detail** (description, tags, components, save)
- **Onboarding** (minimal: goal, voice, default session behavior)
- **Progress** (optional, light)

---

## Phase 0 — Foundations: Consistency + Navigation + UI System
### Goals
- Make the app feel like one cohesive product.
- Remove interaction bugs and confusing patterns.

### Deliverables
- **Design tokens** (constants)
  - Colors: background/surface/text/accent, semantic states (success/warn/error)
  - Type scale: H1/H2/body/caption
  - Spacing scale: 4/8/12/16/24/32
  - Radius and shadows: one system
- **Shared components**
  - `AppScreen` (safe area + background)
  - `Card`, `PrimaryButton`, `IconButton`, `Chip`, `SectionHeader`
  - `SessionTile` (image/title/subtitle + play affordance)
  - `BottomTabs` (one global implementation)
  - `MiniPlayer` (global, persistent)
  - `BottomSheet` (for menus and quick actions)
- **Interaction fixes**
  - Remove hover-only affordances; use press states.
  - Eliminate nested `Pressable` conflicts (single tap target strategy).
  - Replace fixed heights with responsive layout (`flex: 1` + SafeArea).
  - Fix icon/state mismatches (expand/collapse, skip vs ±10 sec).
  - Ensure progress UI actually renders (no invisible fills).

### Acceptance criteria
- All three screens share the same theme rules (colors, typography, spacing).
- One bottom navigation pattern across the app.
- All primary tappable areas are obvious without “discovering” hidden icons.
- No double-navigation or missed taps due to nested pressables.

---

## Phase 1 — Audio UX: Global Now Playing + Reliability Layer
### Goals
- Make playback feel instant, dependable, and consistent across screens.
- Create a single mental model: “there is always a current session.”

### Deliverables
- **Global Now Playing**
  - Mini player appears when a session is active (Today/Explore/Programs/Library).
  - Tap mini player to open Player.
  - If nothing is playing, mini player is hidden (or shows a “Start” prompt on Today only).
- **Player UX upgrades**
  - Sleep timer (5/10/15/30/60/off) via a menu.
  - Restart session.
  - End session (stop + clear state).
  - Clear error state UI (calm, inline; one retry action).
- **Audio state machine**
  - States: `idle`, `preparing`, `playing`, `paused`, `error`, `stopping`
  - Transitions are deterministic and logged.
  - “Primer” hook point (used later) so you can mask buffering without feeling like buffering.

### Acceptance criteria
- User can start on Today, navigate to Explore, and Player continues uninterrupted.
- Returning to the app always shows the correct playback state.
- Playback controls match behavior (icons and labels are accurate).
- Error states do not trap the user; one tap recovers or cleanly exits.

---

## Phase 2 — SOS: Quick Sessions for Acute Moments
### Goals
- Provide immediate help for high-intensity moments with minimal friction.
- Reduce the “I don’t know what to pick” problem.

### Deliverables
- **SOS entry points**
  - Today: small SOS strip above content (not competing with primary CTA).
  - Player: SOS menu option (switch to a quick session).
- **SOS page (dedicated)**
  - 6–12 quick sessions, 2–6 minutes each.
  - Examples: Racing Thoughts, Panic Spike, Can’t Sleep, Social Anxiety, Overwhelm, Reset.
- **Content rules**
  - Instant start (no configuration screens).
  - Simple naming, no jargon.
  - Consistent cadence and structure.

### Acceptance criteria
- SOS session starts in one tap from Today.
- SOS sessions are clearly shorter than standard sessions and labeled accordingly.
- Users can return to previous session after SOS (optional but preferred).

---

## Phase 3 — Programs: Lightweight Structure (7–10 Days)
### Goals
- Build retention through simple progression that feels achievable.
- Turn “random sessions” into “a path.”

### Deliverables
- **Programs List**
  - 3–6 flagship programs at launch.
  - Examples: Calm the Inner Noise (7 days), Confidence Rewire (10 days), Sleep Switch (7 days).
- **Program Detail**
  - Day list, preview, start/resume button.
  - Clear expectation: one session per day.
- **Program progress**
  - Store per-day completion.
  - Auto-advance to next day.
  - Gentle “continue day X” prompt on Today.

### Acceptance criteria
- User can start a program and resume the next day without searching.
- Program completion is tracked locally and reliably.
- Program UI does not overwhelm; one primary action: Start/Continue.

---

## Phase 4 — Library: Saved + Recent + My Mixes (Presets)
### Goals
- Convert discovery into a personal system.
- Let users repeat what works with one tap.

### Deliverables
- **Library page**
  - Tabs or sections: Saved, Recent, My Mixes
- **Saving**
  - Favorite toggle on session tiles and session detail.
- **Recent**
  - Auto-populated from playback history (lightweight, local).
- **My Mixes (presets)**
  - Save current mix from Player:
    - voice selection
    - beat selection
    - ambience selection
    - slider levels
  - Name a preset and replay it from Library.

### Acceptance criteria
- Users can save a session and find it again quickly.
- Presets reliably restore the same listening feel.
- Library remains minimal, not a giant list dump.

---

## Phase 5 — Session Detail: Clarity + Trust
### Goals
- Increase confidence by making sessions understandable.
- Support the “premium and intentional” feel.

### Deliverables
- **Session Detail page**
  - Title, goal tag(s), recommended times (Morning/Night), length options (if any)
  - “What’s inside” breakdown: Voice, Beats, Atmosphere
  - Save button + Start button
  - Related sessions (limited to 3–6)
- **Transparency**
  - Replace hardcoded metadata with real values from your session model.

### Acceptance criteria
- Session detail answers: “what is this, who is it for, what will it feel like?”
- Users can start from detail with one obvious primary CTA.

---

## Phase 6 — Minimal Onboarding (3 screens max)
### Goals
- Personalize without heavy setup.
- Give first-time users a confident first play.

### Deliverables
- **Onboarding flow**
  1) Goal selection (Sleep, Focus, Calm, Confidence)
  2) Voice choice (sample + default)
  3) Default behavior (optional): “Quick Start” vs “Choose each time”
- **Skip always available**
- **First session**
  - On completion: prompt to save, start a program, or set a default.

### Acceptance criteria
- First session can begin within 10 seconds of opening the app.
- Onboarding creates visible changes (Today recommendations reflect the selected goal).

---

## Phase 7 — Premium Polish: Primer + Motion + “Slow UI”
### Goals
- Make the app feel cinematic and expensive without becoming busy.
- Mask any necessary loading steps with intentional ritual.

### Deliverables
- **Primer (optional, skippable)**
  - 20–30 seconds breath-in/breath-out animation
  - Uses the same animation hook as audio preparation
- **Micro-animations**
  - Slow transitions between screens
  - Gentle pulses on the play ring
  - Subtle particles (only if they do not compete with readability)
- **Haptics**
  - Off by default; only on key actions if you add it later (optional)

### Acceptance criteria
- Animations never block core actions.
- The primer feels like a feature, not a loading screen.

---

## Analytics and Quality Gates (apply to every phase)
### Core events
- `session_start` / `session_pause` / `session_resume` / `session_end`
- `session_complete` (if you define completion)
- `sos_start`
- `program_start` / `program_day_complete`
- `favorite_add` / `favorite_remove`
- `preset_save` / `preset_play`
- `audio_error` (include error code + state)

### UX quality gates
- Tap targets minimum 44px.
- No hidden critical affordances.
- No nested pressable conflicts.
- Player is usable one-handed.
- App remains readable and calm in low light.

---

## Suggested build order (no dates, just dependency order)
1. Phase 0 (foundations)  
2. Phase 1 (Now Playing + audio reliability)  
3. Phase 2 (SOS)  
4. Phase 3 (Programs)  
5. Phase 4 (Library + My Mixes)  
6. Phase 5 (Session Detail)  
7. Phase 6 (Onboarding)  
8. Phase 7 (Premium polish)

---

## Backlog (ideas to keep, not commit yet)
- Smart “Today” recommendations (rule-based first; ML later).
- Gentle reminders tied to Programs (opt-in).
- Offline mode / downloads (only after playback is rock solid).
- Accessibility pass (font scaling, contrast, screen reader labels).
