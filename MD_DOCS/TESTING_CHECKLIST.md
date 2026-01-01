# Pre-roll Testing Checklist

Use this checklist to systematically test the pre-roll atmosphere feature.

## Prerequisites

- [ ] API server running (`pnpm -C apps/api dev`)
- [ ] Mobile app running (`pnpm -C apps/mobile start`)
- [ ] Device/simulator connected
- [ ] At least one test session available

## Expected Behavior

**Auto-Load/Play:** When you click a session from HomeScreen, it should automatically:
1. Navigate to Player screen
2. Load the bundle automatically
3. Start playing automatically (with pre-roll)

**After Stop:** You can tap Play again without needing to reload the bundle.

## Test Matrix

### 1. Cold Start Playback (<300ms target)

**Steps:**
1. Close app completely
2. Open app fresh
3. Navigate to Player screen
4. Load a session (if not already loaded)
5. **Immediately tap Play** and start stopwatch
6. Listen for pre-roll to start

**Expected:**
- [ ] Pre-roll starts within 100-300ms
- [ ] Subtle pink/brown noise audible
- [ ] Volume is very low (max 10%)

**Actual Start Time:** _____ ms

**Notes:**
_________________________________

---

### 2. Warm Cache Playback

**Steps:**
1. Play a session (let it fully load and play)
2. Stop playback
3. Tap Play again immediately (no need to reload)

**Expected:**
- [ ] Pre-roll still plays (even with warm cache)
- [ ] Start time still <300ms
- [ ] Smooth transition to main mix
- [ ] No need to tap "Load" again after stop

**Notes:**
_________________________________

---

### 3. Crossfade Quality

**Steps:**
1. Start playback (pre-roll begins)
2. Wait for main tracks to load (1-3 seconds)
3. Listen carefully to transition

**Expected:**
- [ ] Pre-roll fades out smoothly (~1.75 seconds)
- [ ] Main mix fades in simultaneously
- [ ] No audible clicks, pops, or gaps
- [ ] Feels like "stepping into environment" (not an intro)

**Issues Found:**
- [ ] Clicks/pops: _______________
- [ ] Gaps: _______________
- [ ] Too noticeable: _______________

**Notes:**
_________________________________

---

### 4. Pause During Pre-roll

**Steps:**
1. Tap Play (pre-roll begins)
2. **Immediately tap Pause** (before main mix loads)

**Expected:**
- [ ] Pre-roll fades out quickly (300-500ms)
- [ ] App enters "paused" state
- [ ] No audio continues

**Notes:**
_________________________________

---

### 5. Resume from Pause During Pre-roll

**Steps:**
1. Start playback (pre-roll begins)
2. Pause before main mix loads
3. Tap Play again to resume

**Expected:**
- [ ] If main tracks not ready: Pre-roll restarts
- [ ] If main tracks ready: Goes directly to playing main mix
- [ ] No audio glitches

**Notes:**
_________________________________

---

### 6. Stop During Pre-roll

**Steps:**
1. Start playback (pre-roll begins)
2. **Immediately tap Stop** (before main mix loads)

**Expected:**
- [ ] Pre-roll fades out quickly (200-300ms)
- [ ] App returns to "idle" state
- [ ] All audio stops

**Notes:**
_________________________________

---

### 7. Rapid Play/Pause (x10)

**Steps:**
1. Rapidly tap Play/Pause 10 times in quick succession
2. Observe behavior

**Expected:**
- [ ] No crashes or errors
- [ ] State remains consistent
- [ ] Audio doesn't get stuck or overlap

**Issues Found:**
- [ ] Crash: _______________
- [ ] State desync: _______________
- [ ] Audio overlap: _______________

**Notes:**
_________________________________

---

### 8. Session Switch During Pre-roll

**Steps:**
1. Start playback on Session A (pre-roll begins)
2. Navigate back to Home
3. Select Session B
4. Navigate to Player and tap Play

**Expected:**
- [ ] Pre-roll stops for Session A
- [ ] Pre-roll starts for Session B
- [ ] No audio overlap or conflicts

**Notes:**
_________________________________

---

### 9. App Background/Foreground

**Steps:**
1. Start playback (pre-roll begins)
2. Background the app (home button/gesture)
3. Wait 5 seconds
4. Foreground the app

**Expected:**
- [ ] Audio continues (if background audio enabled)
- [ ] State remains consistent
- [ ] No crashes

**Notes:**
_________________________________

---

### 10. Audio Interruption

**Steps:**
1. Start playback (pre-roll begins)
2. Trigger system audio interruption:
   - iOS: Siri, phone call, Control Center audio
   - Android: Phone call, notification sound
3. Resume playback

**Expected:**
- [ ] Audio pauses gracefully
- [ ] Can resume after interruption
- [ ] State remains consistent

**Notes:**
_________________________________

---

### 11. Loudness Verification

**Steps:**
1. Start playback
2. Listen to pre-roll volume
3. Compare to main mix volume

**Expected:**
- [ ] Pre-roll is very quiet (target: -38 LUFS)
- [ ] Subtle - feels like "silence with substance"
- [ ] Not noticeable as "intro"
- [ ] Sits under background layer

**Perception:**
- [ ] Too loud
- [ ] Too quiet
- [ ] Just right

**Recommendation:**
_________________________________

---

## Test Results Summary

**Device/OS Tested:** _______________

**Overall Status:**
- [ ] ✅ All tests passed
- [ ] ⚠️ Minor issues found
- [ ] ❌ Critical issues found

**Critical Issues:**
1. _______________
2. _______________

**Minor Issues:**
1. _______________
2. _______________

**Recommendations:**
1. _______________
2. _______________

**Date:** _______________
**Tester:** _______________
