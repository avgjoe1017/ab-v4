# V4 E2E Test Scripts

**Purpose**: Structured test scripts for manual E2E testing on real devices (iOS + Android)

**Status**: Test scripts ready for execution  
**Last Updated**: 2025-01-30

---

## P0-1.1: Golden Flow E2E Test

### Prerequisites
- Fresh install of app (clear app data or uninstall/reinstall)
- Free tier account (or new account)
- Real device (iOS or Android)
- Stable network connection (for baseline)
- Stopwatch/timer for timing verification

### Test Steps

#### 1. Fresh Install & Setup
- [ ] Install app on device
- [ ] Open app (should land on HomeChat screen)
- [ ] Verify no existing plan drafts or saved plans
- [ ] Note: User should be on Free tier by default

#### 2. Generate Plan Preview
- [ ] Type message in chat: "Help me feel more confident at work"
- [ ] Tap Send
- [ ] **Verify**: Plan preview card appears below chat
- [ ] **Verify**: Plan shows 6 affirmations (Free tier default)
- [ ] **Verify**: Preview shows title and intent summary

#### 3. Edit Plan
- [ ] Tap "Edit Affirmations" button on plan preview
- [ ] **Verify**: Edit modal opens from bottom
- [ ] Edit 2 affirmations (change text)
- [ ] Tap "Save" in edit modal
- [ ] **Verify**: Modal closes
- [ ] **Verify**: Plan preview shows updated affirmations
- [ ] **Note**: Free users see "(edits won't be saved)" message

#### 4. Start Session (Commit)
- [ ] Tap "Start Session" button on plan preview
- [ ] **Verify**: Loading state shows briefly
- [ ] **Verify**: Navigation to Player screen
- [ ] **Verify**: Player screen loads within 3 seconds

#### 5. Playback Starts
- [ ] **Verify**: Background music starts playing immediately (within 1 second)
- [ ] **Verify**: Brain track (binaural/solfeggio) starts playing
- [ ] **Verify**: Play button shows pause icon
- [ ] **Verify**: Timer shows "time remaining" (should show ~5 minutes for Free user)

#### 6. Time Tracking Verification
- [ ] **Start stopwatch** when playback starts
- [ ] Let playback run for 30 seconds
- [ ] Tap Pause
- [ ] **Verify**: Timer stops counting down
- [ ] Wait 15 seconds while paused
- [ ] Tap Play to resume
- [ ] **Verify**: Timer resumes from where it stopped (not from 5:00)
- [ ] **Verify**: Stopwatch shows ~30 seconds elapsed (not 45)

#### 7. 5-Minute Cap Verification
- [ ] Resume playback
- [ ] Let playback continue until timer shows ~1 minute remaining
- [ ] **Verify**: Timer continues counting down smoothly
- [ ] **Watch for fade-out**: At exactly 5:00 total playback time, voice should fade out
- [ ] **Verify**: Background and brain track continue playing during fade
- [ ] **Verify**: EndCard modal appears within 1 second after fade starts

#### 8. EndCard Interaction
- [ ] **Verify**: EndCard shows "Want more time?" header
- [ ] **Verify**: EndCard lists benefits (unlimited time, save plans, etc.)
- [ ] **Verify**: EndCard shows "Upgrade" button (primary) and "Maybe later" button (secondary)
- [ ] Tap "Maybe later"
- [ ] **Verify**: EndCard closes
- [ ] **Verify**: Navigation returns to HomeChat screen cleanly
- [ ] **Verify**: No crashes or navigation weirdness

### Acceptance Criteria Checklist

- [ ] Time remaining counts only while playing (pause doesn't count)
- [ ] No crashes during entire flow
- [ ] No missing UI text or broken layouts
- [ ] No navigation weirdness (back button works, screens transition smoothly)
- [ ] EndCard appears exactly once per session end
- [ ] Voice fades smoothly at 5-minute mark
- [ ] Background/brain tracks continue after voice fade
- [ ] Timer accuracy within 5 seconds of actual playback time

### Test on Multiple Platforms

- [ ] **iOS**: Run full test script above
- [ ] **Android**: Run full test script above
- [ ] **Slow Network**: Repeat steps 4-8 with network throttled (3G simulation)

### Known Issues / Notes

```
[Document any issues found during testing]

Example:
- Timer shows 4:58 when fade starts (2 second discrepancy)
- Edit modal doesn't close on first tap of Save
```

---

## P0-1.2: Fallback Ladder E2E Test

### Prerequisites
- App installed on device
- Network throttling tool (iOS: Settings → Developer → Network Link Conditioner, Android: Chrome DevTools)
- Free tier account

### Scenario 1: voice_ready (Normal Flow)

#### Setup
- [ ] Ensure good network connection
- [ ] Generate a new plan via chat
- [ ] Wait for plan preview to appear

#### Test Steps
- [ ] Tap "Start Session"
- [ ] **Measure**: Time from tap to first audio (background music)
- [ ] **Verify**: Background music starts within 2 seconds
- [ ] **Verify**: Voice track starts within 5 seconds
- [ ] **Verify**: All three tracks (voice, background, brain) playing simultaneously
- [ ] **Verify**: No silence gaps between tracks starting

**Acceptance**: Voice plays within 5 seconds, all tracks play smoothly

---

### Scenario 2: voice_pending (Slow Network / Voice Not Ready)

#### Setup
- [ ] Generate a new plan via chat
- [ ] **Before** tapping Start Session, throttle network to "3G" speed
- [ ] OR: Generate plan, immediately start (voice job may not be complete)

#### Test Steps
- [ ] Tap "Start Session"
- [ ] **Verify**: Background music starts immediately (within 1 second)
- [ ] **Verify**: Brain track starts immediately
- [ ] **Verify**: Voice track does NOT start immediately
- [ ] **Verify**: UI shows "Voice will join shortly" or similar message (if implemented)
- [ ] Wait for voice to join (may take 10-30 seconds on slow network)
- [ ] **Verify**: Voice track starts playing without restarting background/brain
- [ ] **Verify**: No silence gap when voice joins
- [ ] **Verify**: All tracks continue playing smoothly together

**Acceptance**: Ambience plays immediately, voice joins later without restart or silence gap

---

### Scenario 3: silent (Voice Failed / Kill Switch)

#### Setup
- [ ] Set environment variable: `KILL_SWITCH_FORCE_SILENT=true` (on API server)
- [ ] Restart API server
- [ ] Generate a new plan via chat

#### Test Steps
- [ ] Tap "Start Session"
- [ ] **Verify**: Background music starts immediately
- [ ] **Verify**: Brain track starts immediately
- [ ] **Verify**: Voice track does NOT play (silent mode)
- [ ] **Verify**: UI shows affirmation text (timed affirmations appear on screen)
- [ ] **Verify**: Text affirmations appear at appropriate intervals (~8 seconds apart)
- [ ] **Verify**: Background and brain tracks continue playing
- [ ] **Verify**: Timer counts down correctly
- [ ] **Verify**: EndCard appears at 5:00 playback time

**Acceptance**: Timed affirmation text appears, ambience plays continuously, EndCard triggers correctly at 5:00

---

### Error Recovery Verification

For each scenario above, also verify:
- [ ] **No raw API errors shown** to user
- [ ] User always has a "continue / retry / use premade" path available
- [ ] If playback fails completely, user can navigate back to chat/library
- [ ] Error messages are user-friendly (not technical)

---

## P0-1.3: Quota/Entitlement E2E Test

### Prerequisites
- Two test accounts: One Free, One Paid
- App installed on device
- Clock/watch for timing verification

---

### Free Tier Tests

#### Test 1: Preview Does Not Consume Daily Plan
- [ ] **Start**: Fresh Free account (or reset daily quota)
- [ ] Generate plan via chat: "Help me sleep"
- [ ] **Verify**: Plan preview appears
- [ ] **Verify**: Preview shows 6 affirmations
- [ ] **DO NOT** tap Start Session yet
- [ ] Generate another plan preview: "Help me focus"
- [ ] **Verify**: Second plan preview appears (no error about daily limit)
- [ ] **Verify**: Can generate multiple previews without hitting limit

#### Test 2: Commit Consumes Daily Plan
- [ ] **Start**: Fresh Free account (or reset daily quota)
- [ ] Generate plan: "Help me sleep"
- [ ] Tap "Start Session"
- [ ] **Verify**: Session starts successfully
- [ ] Navigate back to HomeChat
- [ ] Generate another plan: "Help me focus"
- [ ] Tap "Start Session"
- [ ] **Verify**: Error message: "You've used your free plan for today" (or similar)
- [ ] **Verify**: Cannot start second session (daily limit reached)

#### Test 3: 5-Minute Session Cap
- [ ] Start a session as Free user
- [ ] **Verify**: Timer shows 5 minutes remaining
- [ ] Let playback run
- [ ] **Verify**: Voice fades at exactly 5:00 playback time
- [ ] **Verify**: EndCard appears
- [ ] **Note**: This is verified in P0-1.1, but double-check here

#### Test 4: Save Endpoint Denies (Paid Required)
- [ ] As Free user, generate a plan
- [ ] Navigate to Library screen
- [ ] Find a premade plan
- [ ] Tap "Save" button
- [ ] **Verify**: Paywall modal appears (or 403 error with paywall prompt)
- [ ] **Verify**: Cannot save plan without upgrading

#### Test 5: Paid Audio Selectors Deny
- [ ] As Free user, generate a plan
- [ ] Tap "Audio Options" button (if visible) or try to select paid voice
- [ ] **Verify**: Paid options show lock icon
- [ ] **Verify**: Tapping locked option shows paywall
- [ ] **Verify**: Can only select "male" or "female" voices (Free tier)

---

### Paid Tier Tests

#### Test 6: Unlimited Session Time
- [ ] As Paid user, start a session
- [ ] **Verify**: Timer shows "unlimited" or no time cap indicator
- [ ] Let playback run for 10+ minutes
- [ ] **Verify**: No fade-out occurs
- [ ] **Verify**: No EndCard appears
- [ ] **Verify**: Playback continues indefinitely

#### Test 7: Save/Unsave Works
- [ ] As Paid user, navigate to Library
- [ ] Find a premade plan
- [ ] Tap "Save" button
- [ ] **Verify**: Save button changes to "Saved" or checkmark
- [ ] Navigate to "Saved Plans" section
- [ ] **Verify**: Plan appears in saved plans list
- [ ] Tap "Unsave" or tap saved plan's save button
- [ ] **Verify**: Plan is removed from saved plans
- [ ] **Verify**: Save button returns to "Save" state

#### Test 8: Affirmation Count Selection (6/12/18/24)
- [ ] As Paid user, generate a plan
- [ ] Tap "Edit Affirmations"
- [ ] **Verify**: Affirmation count selector appears (6, 12, 18, 24)
- [ ] Select "12 affirmations"
- [ ] **Verify**: Edit modal shows 12 affirmation text fields
- [ ] Save edit
- [ ] **Verify**: Plan preview shows 12 affirmations
- [ ] Tap "Start Session"
- [ ] **Verify**: Session starts with 12 affirmations
- [ ] Repeat with 18 and 24 counts
- [ ] **Verify**: Each count works correctly

---

### Server Enforcement Verification

For all tests above, also verify:
- [ ] **Server is source of truth**: UI cannot bypass restrictions
- [ ] **No optimistic unlock bugs**: UI reflects server response accurately
- [ ] **Error messages are clear**: User understands why action failed

---

## Test Execution Log Template

```
Test Run: [Date] [Tester Name]
Platform: [iOS/Android] [Device Model] [OS Version]
App Version: [Version Number]
API Version: [Version Number]

P0-1.1 Golden Flow:
- Status: [PASS/FAIL/PARTIAL]
- Issues: [List any issues found]
- Screenshots: [Link to screenshots if available]

P0-1.2 Fallback Ladder:
- voice_ready: [PASS/FAIL]
- voice_pending: [PASS/FAIL]
- silent: [PASS/FAIL]
- Issues: [List any issues found]

P0-1.3 Entitlements:
- Free Preview: [PASS/FAIL]
- Free Commit: [PASS/FAIL]
- Free Cap: [PASS/FAIL]
- Free Save: [PASS/FAIL]
- Free Audio: [PASS/FAIL]
- Paid Unlimited: [PASS/FAIL]
- Paid Save: [PASS/FAIL]
- Paid Counts: [PASS/FAIL]
- Issues: [List any issues found]

Overall Status: [PASS/FAIL]
Blockers: [List any blocking issues]
Next Steps: [What needs to be fixed/retested]
```

---

## Notes for Testers

1. **Network Throttling**:
   - iOS: Settings → Developer → Network Link Conditioner (enable "3G" profile)
   - Android: Use Chrome DevTools or Android Studio Network Profiler
   - Alternative: Use a network proxy (Charles Proxy, mitmproxy)

2. **Reset Daily Quota**:
   - For Free tier testing, may need to wait until next day OR
   - Use admin API to reset user's usage ledger (if available) OR
   - Create new test account

3. **Kill Switch Testing**:
   - Set `KILL_SWITCH_FORCE_SILENT=true` in API `.env` file
   - Restart API server
   - Test Scenario 3 above

4. **Screen Recording**:
   - Record screen during tests for review
   - Particularly useful for timing verification and UI issues

5. **Logs**:
   - Enable verbose logging in app (if available)
   - Check API server logs for errors
   - Check device logs (iOS: Console app, Android: logcat)
