Here are the **V3 mistakes** (or “costly patterns”) to avoid in V4, based on what you’ve said you want V4 to be (chat-first, minimal surfaces, clear tiering, reliable audio, lower cost).

## 1) Too many entry points diluted the product

**V3 mistake**

* Multiple “ways in” (Today/Explore/Compose/Programs/etc.) created *decision fatigue* and blurred what the app is.

**V4 fix**

* One default entry: **HomeChat → Plan → Player**
* One secondary: **Library**
* Everything else lives behind lightweight icons/sheets.

## 2) Built UI breadth before locking the golden flow

**V3 mistake**

* Added screens and subflows before a single “core loop” was unavoidable and perfect.

**V4 fix**

* Ship with **3 screens** and make them world-class:

  * HomeChat
  * Player
  * Library
* Treat everything else as “later.”

## 3) Over-engineered navigation patterns early

**V3 mistake**

* Drawer + lots of routes increases complexity, bugs, and slows iteration.

**V4 fix**

* Minimal nav. No drawer. No nested labyrinth.

## 4) Session creation was system-driven, not relationship-driven

**V3 mistake**

* “Make a session” felt like a tool workflow, not a gentle companion relationship.

**V4 fix**

* Chat tone + pacing is the product.
* Plan preview card is the bridge from emotion → structure.

## 5) Limits/entitlements weren’t baked into UX from day one

**V3 mistake**

* Paywall/limits become bolt-ons, which creates abrupt friction and “gotcha” moments.

**V4 fix**

* Design limits as **ritual**:

  * “Today’s plan”
  * Soft cap fade-out
  * Upgrade only at intent peaks (save, longer, more, another plan)

## 6) Not enough “Tuesday-proof” recovery paths

**V3 mistake**

* Audio systems fail. If the UX doesn’t degrade gracefully, users assume the whole app is broken.

**V4 fix**

* Always have a fallback ladder:

  1. Play background + brain layer immediately
  2. Voice comes in when ready
  3. Silent mode (text-timed affirmations)
  4. Offer a premade plan if generation fails
* Never burn the daily plan because the system failed.

## 7) Too much real-time generation without cost-control strategy

**V3 mistake**

* If everything is bespoke generation, costs spike and reliability drops (timeouts, queues, failures).

**V4 fix**

* For Free, **match to premade first**, generate only if needed.
* Cache aggressively by “intent cluster” and voice choice.

## 8) Unclear product “unit”

**V3 mistake**

* “Session” vs “Program” vs “Affirmation” can make everything feel like different products.

**V4 fix**

* One unit: **Plan**
* A plan can be:

  * generated (chat)
  * premade (library)
  * saved (paid)

## 9) Editing/saving rules weren’t designed as conversion moments

**V3 mistake**

* You lose a huge conversion lever if editing/saving is either confusing or too restricted.

**V4 fix**

* Free can edit for today (creates attachment)
* Paid can save edits (value is obvious)

## 10) Privacy and “memory” weren’t explicit enough for a vulnerable interface

**V3 mistake**

* Chat UI makes people overshare. If storage/retention isn’t crystal clear, trust breaks fast.

**V4 fix**

* One-tap “Privacy & Control” sheet from the chat header:

  * what’s stored
  * retention
  * delete today / delete all
  * training policy (explicit)

## 11) Too many “almost features” created maintenance drag

**V3 mistake**

* Demo screens, experiments, partial flows = clutter + slower development.

**V4 fix**

* Hard rule: if it’s not in the golden flow or Library/Player, it doesn’t exist.

## 12) Visual identity wasn’t locked early enough

**V3 mistake**

* Generic UI patterns make the app feel like a prototype even if the tech is good.

**V4 fix**

* Commit early to:

  * the chat homepage look
  * one living “object” in player (orb)
  * typography + spacing tokens
  * consistent gentle copy system

---

### The single biggest V3 mistake to avoid

**Shipping complexity before certainty.**
V4 wins if you keep it brutally small until the “chat → plan → play” loop is addictive, reliable, and trust-building.

# V4 Guardrails Doc (Build Rules + Kill-Switches)

Date: 2025-12-30  
Project: Affirm Beats — V4 (Complete Rebuild)

This is the **non-negotiable guardrails checklist** for V4.  
If a feature violates these rules, it should **not** ship in V4.

---

## 0) The V4 Kernel (What V4 is)
V4 is a **chat-first affirmation planner**:
- **Home = Chat** (gentle, supportive, non-clinical)
- Chat produces a **Plan**
- Plan plays in **Player**
- **Library** holds:
  - Premade plans
  - Saved plans (Paid only)

If a feature does not strengthen this loop, it is out-of-scope.

---

## 1) Golden Flow First (Scope Guardrail)
### Must-pass test
A new user should be able to:
1) Open app
2) Type one thought
3) Get a plan preview
4) Tap Start
5) Hear the session within seconds

### Ship block
Do not ship anything that:
- adds another “main” entry point
- increases onboarding steps without reducing confusion
- pulls attention away from HomeChat

---

## 2) Screen Budget (UI Discipline)
V4 has a strict “screen budget.”

### Allowed screens
- **HomeChat**
- **Player**
- **Library**
- **Settings/Profile** (sheet or minimal screen)

### Disallowed (V4)
- Explore as a major surface
- Programs / multi-week courses
- Dashboards (“Today” feed)
- Multi-step onboarding journeys
- Multiple session builders / modes

**Rule:** If a new screen is proposed, it must replace an existing one.

---

## 3) Navigation Budget (Engineering Discipline)
### Allowed
- Bottom tabs (Chat, Library)
- Modal sheet (Settings/Paywall)
- Deep links into Player from plan or library

### Disallowed
- Drawer navigation
- Nested router mazes
- Multiple redundant ways to reach the same feature

**Rule:** Navigation should be explainable in **one sentence**.

---

## 4) One Product Unit (Conceptual Clarity)
### V4 unit = Plan
A Plan is the only thing users create, play, save, or browse.

### Disallowed
- Introducing a second parallel “unit” (Sessions vs Programs vs Intentions)
- Separate “collections” systems in V4

**Rule:** If it can’t be represented as a Plan, it doesn’t belong in V4.

---

## 5) Monetization Guardrails (No “Gotchas”)
### Allowed upsell moments (intent peaks only)
- User tries to **save**
- User wants **more affirmations** (12/18/24)
- User hits **free loop cap**
- User tries to generate **another plan today** (Free)

### Disallowed
- Upsell mid-playback (interrupting flow)
- Shame language or urgency manipulation
- Any upsell during crisis safety handling

**Rule:** Monetization should feel like “more support,” not “punishment.”

---

## 6) Tier Rules (Must Match UX)
### Free (current decisions)
- 1 new plan per day (**counts on Start**, not preview)
- 6 affirmations
- No save
- Male/Female voice only
- 3 full loops max

### Paid (current decisions)
- Unlimited generations
- Save plans (and edits)
- Unlimited duration
- 6/12/18/24 affirmations
- Choose voice, binaural/solfeggio, background
- Write your own affirmations (save)

**Rule:** If an entitlement exists, it must be reflected gently and clearly in the UI.

---

## 7) Prevent “Bad Plan Lockout” (Critical)
Free users cannot be trapped for 24 hours with a plan they dislike.

### Required
- Free gets **rerolls** before Start (recommended 2–3)
- Rerolls do not consume the day if generation fails
- Daily usage counts when user taps **Start**

**Rule:** No “you used your daily plan” wall until the user has heard the plan.

---

## 8) Chat Fatigue Prevention (Retention Guardrail)
Chat-first must not become daily friction.

### Required (one of these)
- “Same vibe as yesterday” shortcut chip (tone-only, not sensitive memory), or
- Tap-to-start premade plans in Library that feel first-class

**Rule:** A day-14 user should be able to start a session in **two taps**.

---

## 9) Reliability: Tuesday-Proof Playback (Non-negotiable)
Audio will fail sometimes. The product must still feel calm and functional.

### Required fallback ladder
1) Start background + brain layer immediately
2) Bring in voice when ready
3) If voice fails: **Silent Mode** (timed on-screen affirmations)
4) Offer a premade fallback if generation is stuck

### Required error principles
- Never show raw API errors
- Never blame the user
- Never burn the free daily plan due to system failure

**Rule:** Reliability is a feature. If a flow can fail without recovery, it’s not shippable.

---

## 10) Free Loop Cap Must Feel Gentle
Free cap = 3 loops. It cannot “thud.”

### Required
- Fade voice out smoothly at cap
- End card copy must be calm, not transactional
- Option to leave gracefully without upgrade

**Rule:** The cap should feel like a natural close, not a trapdoor.

---

## 11) Safety Guardrails (Tone + Policy)
### Required
- Crisis detection routes to safe resources (no upsell)
- “Validation mode” for high distress (non-crisis) to avoid toxic positivity
- No medical or financial guarantees

**Rule:** If there is any ambiguity, choose the safer response over the more “motivational” one.

---

## 12) Privacy Guardrails (Trust Budget)
Chat UI invites vulnerable sharing, so privacy must be explicit and controllable.

### Required
- One-tap **Privacy & Control** sheet from HomeChat header
- Clear answers to:
  - Is chat stored?
  - How long?
  - Delete controls
  - Training policy (explicit yes/no)
  - Third-party processors (TTS, analytics)

**Rule:** If we can’t explain data handling in plain language, we can’t ship it.

---

## 13) Cost-Control Guardrails (Unit Economics)
### Required
- Prefer premade matching for Free when possible
- Cache plan generation by intent cluster
- Cache audio assets by voice + text + settings
- Avoid generating bespoke audio unnecessarily

**Rule:** Reduce generation costs without making Free feel crippled.

---

## 14) “No Zombie Features” Rule (Maintenance)
### Disallowed
- Demo screens
- Half-built flows
- Duplicate components solving the same problem

### Required
- Delete unused screens/components as part of every sprint

**Rule:** Anything not on the critical path is deleted.

---

## 15) UX Copy System (Consistency)
### Required
- Gentle, supportive, non-clinical
- No shame or pressure
- Short, readable messages

### Disallowed
- Therapist voice
- Quirky performative chat openers
- “It’s not this, it’s that” constructions (avoid)

**Rule:** Copy should sound like a steady friend, not a wellness guru.

---

## 16) “Add a Feature?” Gate (Decision Checklist)
Before any new feature is approved, it must pass:

1) Does it make **HomeChat → Plan → Play** faster or more satisfying?
2) Does it reduce friction for day-7/day-30 users?
3) Does it improve reliability or trust?
4) Does it improve conversion at an intent peak?
5) Does it avoid adding new screens/nav complexity?

If “no” to 3 or more, it’s out.

---

## 17) Kill-Switches (Hard Stops)
Immediately stop work if:
- Someone adds a new primary tab/surface
- A paywall appears mid-session
- Free users can lose their daily plan due to a system error
- Privacy choices are vague or buried
- Plan unit gets split into multiple parallel concepts

---

## 18) Launch Definition (V4 “Done”)
V4 ships when:
- The golden flow works reliably with graceful fallbacks
- Free vs Paid is clear and gentle
- Privacy sheet exists and delete controls are real
- Library works for premade + saved (paid)
- Player is calm, stable, and cap behavior feels natural

---

## 19) Owner’s Note
V4 is a rebuild. The goal is not feature parity with V3.  
The goal is **clarity, trust, and ritual**.

