# V4 P0 and P1 Engineering Checklist + Punch List

Last updated: 2025-01-30  
Sources referenced: V4 progress log, V4 punch list, and the E2E test scripts/checklist.

---

## How we are looking right now

V4 is in a strong place structurally because the core product truths are now enforced server-side, not implied by the UI:

- Server-owned draft to commit data model exists (ChatThread, ChatMessage, PlanDraft, Plan, PlanSave, UsageLedger).
- Server-enforced entitlements exist and are applied at commit, reroll, and save enforcement points. UI reflects the result, not the other way around.
- UsageLedger exists as the truth source for daily plan limits and rerolls, with explicit non-increment edge cases on failures and transactional writes on commit.
- The player now treats time as the truth. Free is capped at 5 minutes of active playback. Paid is unlimited. Cap behavior is consistent across voice_ready, voice_pending, and silent modes.
- Product language avoids loop counting. EndCard copy and rules are time-based only, including "Want more time?" and "Unlimited session time."
- E2E test scripts and a quick execution checklist exist, but are not yet executed and logged on real devices. That is the primary remaining release blocker.

The main remaining unknown is not design. It is real-device behavior under slow network and fallback conditions, plus entitlement edge cases. The work now is disciplined validation and polishing around failures.

---

## Release gate definition

V4 is "ship-ready" only when all of the following are true on real devices:

- Golden Flow works end-to-end: HomeChat → Draft → Edit → Commit → Player starts fast → Free cap at 5:00 → EndCard resolves cleanly.
- Fallback ladder works: voice_ready, voice_pending, silent.
- Entitlements are server enforced: Free cannot save, cannot select paid-only audio options, is capped at 5 minutes. Paid is unlimited and can save. UI never "optimistically unlocks."
- No dead-end errors. Every failure has a calm recovery action (retry, continue without voice, use premade, go back).

---

## P0 checklist (release blockers)

### P0-1.0 Test execution infrastructure
- [ ] Confirm API server is reachable from device.
- [ ] Confirm device build is installed (not only Expo Go) for representative audio behavior.
- [ ] Create two test accounts: Free and Paid.
- [ ] Prepare timer for cap verification and screen recording for evidence.

**Deliverable:**
- A single shared "Test Run Log" per platform with PASS/FAIL and links to videos/screenshots (template is included in scripts).

---

### P0-1.1 Golden Flow E2E (real device)
Run exactly as documented.

**Checklist:**
- [ ] Fresh install lands on HomeChat.
- [ ] Generate plan preview.
- [ ] Edit 2 affirmations, save, preview updates.
- [ ] Start Session (commit).
- [ ] Player loads within 3s.
- [ ] Background and brain start immediately.
- [ ] Timer shows time remaining about 5 minutes for Free.
- [ ] Pause stops timer, resume continues from same value.
- [ ] At 5:00 active playback time: voice fades, EndCard appears once.
- [ ] "Maybe later" returns to HomeChat cleanly.

**Acceptance:**
- [ ] Timer accuracy within 5 seconds of actual playback time.
- [ ] No crashes and no missing UI text.
- [ ] No navigation weirdness on return paths.

**Deliverable:**
- Screen recording of full run plus a written log of any defects.

**Reference:** `E2E_TEST_SCRIPTS.md` section "P0-1.1: Golden Flow E2E Test"

---

### P0-1.2 Fallback ladder E2E (bad network)
This validates the reality of your "always playable" promise.

**Scenarios:**
- voice_ready on good network.
- voice_pending with throttled network (3G).
- silent with kill switch forced on server.

**Checklist:**
- [ ] voice_ready: voice starts within 5 seconds, all tracks smooth, no silence gaps.
- [ ] voice_pending: background and brain start immediately, voice joins later without restarting ambience, no silence gap when it joins.
- [ ] silent: no voice, timed affirmation text appears, timer counts down, EndCard at 5:00.

**Acceptance:**
- [ ] No raw API errors shown.
- [ ] User always has a continue, retry, or use premade path.

**Deliverable:**
- PASS/FAIL for each scenario plus evidence.

**Reference:** `E2E_TEST_SCRIPTS.md` section "P0-1.2: Fallback Ladder E2E Test"

---

### P0-1.3 Quota and entitlement E2E (truth is server-side)
Run the Free and Paid test matrix.

**Free must verify:**
- [ ] Preview does not consume daily plan.
- [ ] Commit consumes daily plan.
- [ ] Player caps at 5 minutes.
- [ ] Save denies and shows paywall prompt.
- [ ] Paid-only audio selectors deny with lock + paywall behavior.

**Paid must verify:**
- [ ] Unlimited session time (10+ minutes, no fade, no EndCard).
- [ ] Save and unsave work in Library and Saved Plans.
- [ ] 6/12/18/24 affirmation counts work and are respected through commit and playback.

**Acceptance:**
- [ ] Server is source of truth.
- [ ] UI cannot bypass restrictions.
- [ ] UI reflects server results accurately, no optimistic unlock bugs.

**Deliverable:**
- A filled matrix table per platform and a defect list ranked by severity.

**Reference:** `E2E_TEST_SCRIPTS.md` section "P0-1.3: Quota/Entitlement E2E Test"

---

### P0-2.0 "Time cap is the truth" validation pass
This is a dedicated pass for edge cases around the time cap system.

**Checklist:**
- [ ] Pause at 4:30 for 60 seconds, resume, confirm cap hits at 5:00 active playback time (not wall clock).
- [ ] voice_pending: voice starts at 2:00, still ends at 5:00 active playback time.
- [ ] App background for 30 seconds during playback, return, audio state and timer remain consistent.
- [ ] Timer never goes negative and never resets unexpectedly.

**Deliverable:**
- A short evidence video for each edge case.

**Reference:** `V4_PUNCH_LIST.md` section "P1-2.1 Time Cap Consistency"

---

## P1 checklist (ship-quality improvements)

These are not allowed to break P0. They are executed after P0 passes or in parallel with a strict "no new bugs" discipline.

### P1-1.0 QA follow-ups and fix loop
- [ ] Consolidate all failures from P0 runs into a single punch list.
- [ ] Add repro steps and attach logs and video snippets.
- [ ] Fix one at a time, rerun only the affected scripts, then rerun Golden Flow.

**Deliverable:**
- A clean run log where all P0 tests are marked PASS.

---

### P1-2.0 Copy and product language audit
**Decision rules:**
- Free language always references time cap and time remaining.
- Paid language always references unlimited session time.
- Never mention loop counting anywhere in UI or marketing surfaces.

**Checklist:**
- [ ] HomeChat preview card labels.
- [ ] Player timer labels.
- [ ] EndCard header and benefits.
- [ ] Paywall and upgrade CTAs.

**Deliverable:**
- A single inventory of all strings with confirmation they are time-based.

**Reference:** `V4_PUNCH_LIST.md` section "P1-2.2 EndCard Copy + Actions"

---

### P1-3.0 Entitlement UI alignment
Even with server enforcement, the UI must make entitlement boundaries obvious.

**Checklist:**
- [ ] Free shows 5-minute remaining timer and clear limits.
- [ ] Free "Save" always opens paywall path and never shows a misleading "Saved" state.
- [ ] Paid shows "unlimited" or removes countdown timer as per design, consistently with scripts.

**Deliverable:**
- Screenshots of each boundary state.

---

### P1-4.0 Error recovery consistency pass
Use the E2E scripts error recovery section as the contract.

**Checklist:**
- [ ] Any network error has a retry.
- [ ] Any voice failure has an automatic silent fallback, not a dead end.
- [ ] Any entitlement denial has a clear paywall prompt.
- [ ] Back navigation never traps user or loses app state.

**Deliverable:**
- A set of 5 to 10 "forced failure" recordings demonstrating recovery.

**Reference:** `E2E_TEST_SCRIPTS.md` section "Error Recovery Verification"

---

## File and module map (what engineers touch most)

This is the "blast radius" map for future fixes and future scope.

### API

**Schema:**
- `apps/api/prisma/schema.prisma`
  - ChatThread, ChatMessage, PlanDraft, Plan, PlanSave, UsageLedger.

**Core Services:**
- `apps/api/src/services/v4-entitlements.ts`
  - getEntitlementV4, enforceEntitlement, action checks like COMMIT_PLAN, SAVE_PLAN.
- `apps/api/src/services/v4-usage.ts`
  - dateKey, usage summary, recordUsageEvent, quota checks.
- `apps/api/src/services/v4-chat.ts`
  - processChatTurn, commitPlan, plan draft lifecycle.
- `apps/api/src/services/v4-playback.ts`
  - getPlaybackBundleV4, fallback ladder, kill switch integration.
- `apps/api/src/services/v4-kill-switches.ts`
  - Remote flags for production safety.
- `apps/api/src/services/v4-metrics.ts`
  - Metrics tracking and aggregation.

**Endpoints:**
- POST /v4/chat/turn
- POST /v4/plans/reroll
- POST /v4/plans/commit
- GET /v4/plans/:id
- GET /v4/plans/:id/playback-bundle
- GET /v4/library/premade
- GET /v4/library/saved
- POST /v4/library/save/:planId
- DELETE /v4/library/save/:planId
- GET /v4/me/entitlement
- GET /admin/metrics
- GET /admin/kill-switches

### Mobile

**Screens:**
- `apps/mobile-v4/src/features/chat/HomeChatScreen.tsx`
  - Draft preview card, edit modal, commit action, chips.
- `apps/mobile-v4/src/features/player/PlayerScreen.tsx`
  - Time remaining UI, cap logic, fallback ladder states, EndCard.
- `apps/mobile-v4/src/features/library/LibraryScreen.tsx`
  - Save and unsave flows, paywall gating, pagination.

**Components:**
- `apps/mobile-v4/src/features/plan/components/PlanPreviewCard.tsx`
  - Plan preview display, edit button, start session action.
- `apps/mobile-v4/src/features/plan/components/EditPlanModal.tsx`
  - Affirmation editing, count selection (paid).
- `apps/mobile-v4/src/features/plan/components/AudioOptionsSheet.tsx`
  - Voice, brain track, and background selection.
- `apps/mobile-v4/src/features/player/components/EndCard.tsx`
  - Time cap EndCard with upgrade prompt.
- `apps/mobile-v4/src/features/shared/components/PaywallModal.tsx`
  - Reusable paywall component.
- `apps/mobile-v4/src/features/shared/components/PrivacySheet.tsx`
  - Privacy controls and data deletion.

**Audio Engine:**
- `packages/audio-engine/src/AudioEngine.ts`
  - Track start ordering, voice fade at cap, resilience around load failures, time tracking.

---

## "Where do we go from here" sequence

1. **Execute P0 tests on iOS and Android using the checklist and scripts.**
   - Output is evidence and a defect list, not opinions.
   - Use `TEST_EXECUTION_CHECKLIST.md` for quick reference.
   - Use `E2E_TEST_SCRIPTS.md` for detailed procedures.

2. **Fix only what breaks P0.**
   - No scope adds until P0 is green.
   - Document fixes in defect log.

3. **Run the entitlement matrix again, especially Free save denial and Paid unlimited time.**
   - These are common regression points.
   - Verify server enforcement holds.

4. **Do the P1 copy audit to guarantee time-based language everywhere.**
   - This protects the product truth and reduces confusion.
   - Review all user-facing strings.

5. **Final go-no-go**
   - Ship when all P0 tests are PASS on at least one iOS device and one Android device, and there are no "dead end" errors in fallback modes.

---

## Quick Reference

**Test Scripts:**
- Detailed procedures: `E2E_TEST_SCRIPTS.md`
- Quick checklist: `TEST_EXECUTION_CHECKLIST.md`

**Progress Tracking:**
- Implementation progress: `PROGRESS.md`
- Full punch list: `V4_PUNCH_LIST.md`

**Status:**
- All code implementation: ✅ Complete (28/28 items)
- E2E test scripts: ✅ Ready for execution
- E2E test execution: ⏳ Pending (requires real devices)
- Product tasks (P1-11.1, P1-11.2): ⏳ Pending (product/planning)
