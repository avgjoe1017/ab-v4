# V3 UPDATE — INFINITE LOOP + AFFIRMATION DELIVERY RULES

This document summarizes **locked changes** to the V3 plan.  
These rules are **authoritative** and should be treated as product invariants in all future implementation.

---

## 1. SESSION DURATION

### ❌ Removed
- Duration slider
- Fixed-length sessions
- Time remaining UI
- Session end / replay states
- Max session length limits

### ✅ New Rule
- **All sessions loop infinitely**
- Playback continues until the user manually stops it
- There is no concept of a “finished” session

This applies to:
- Catalog sessions
- User-created sessions
- Generated sessions

---

## 2. PACE (GLOBAL, NON-CONFIGURABLE)

### ❌ Removed
- Pace selector (slow / normal / fast)
- Any user-facing pacing controls

### ✅ New Rule
- **Single pace only**
- Slow, deliberate, grounding
- Identical across all sessions and users

Pace is a **product decision**, not a preference.

---

## 3. AFFIRMATION DELIVERY PATTERN (CRITICAL)

Each affirmation must follow this **exact structure**:

1. **First Read**
   - Calm
   - Neutral
   - Grounded

2. **Second Read**
   - Same text
   - Slightly different prosody
   - Micro-variation in emphasis, cadence, or tone
   - Must NOT be a duplicate waveform

3. **Pause**
   - Silence occurs **only after the second read**
   - Fixed silence duration
   - Creates integration space

Then the system proceeds to the next affirmation.

This pattern repeats continuously.

---

## 4. LOOPING BEHAVIOR

### Audio Looping Rules
- Affirmations merged track: **loop = true**
- Background ambience: **loop = true**
- Binaural tone: **loop = true**

All tracks loop indefinitely and independently, but begin aligned.

---

## 5. AUDIO PIPELINE IMPLICATIONS (SERVER)

For each affirmation:
- Generate **two distinct TTS chunks**
- Same text, same voice, same pace
- Different prosody / variation seed

Stitch order per affirmation:
Affirmation Read 1
Affirmation Read 2
Pause (silence)


The merged affirmations track:
- Contains the full affirmation list once
- Is looped infinitely by the client AudioEngine
- Does NOT need regeneration to support looping

---

## 6. CREATE SESSION UX (UPDATED)

### Removed
- Duration selection

### Current Flow
1. Intent (optional text input)
2. Affirmations (write or generate)
3. Review (voice + background)
4. Create Session

Helper copy:
> “Each affirmation will be spoken slowly, twice, with space to let it land.”

---

## 7. PLAYER UX (UPDATED)

### Removed
- Time remaining
- Progress-to-end indicators
- Replay actions

### Player Controls
- Play
- Pause
- Stop

Optional one-time copy:
> “This session will continue until you stop it.”

---

## 8. CONTRACT / MODEL IMPLICATIONS

### SessionV3
- No `durationSec`
- No user-defined spacing
- Looping is implicit

### PreferencesV3
- Pace removed
- Spacing removed
- User controls limited to:
  - Mix levels
  - Background selection
  - Binaural on/off

---

## 9. ENTITLEMENTS (UPDATED)

Because sessions are infinite:
- No max duration limits
- Entitlements govern:
  - Session creation
  - Audio generation
  - (Optional future) advanced voices

---

## 10. PHILOSOPHY (REFERENCE)

This product is:
- Always-on
- Non-performative
- Non-goal-oriented

It is not a timed meditation.
It is an **ambient belief environment**.

---

## SUMMARY (FOR AI REFERENCE)

- Sessions never end
- Pace is fixed and slow
- Each affirmation is spoken twice with variation
- Silence follows the second read only
- The entire session loops infinitely
- Users stop playback manually

Any implementation that violates these rules is incorrect.