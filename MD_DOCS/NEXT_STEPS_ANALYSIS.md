# Next Steps Analysis

**Date**: 2025-01-30  
**Based on**: PROGRESS.md, V4_ENGINEERING_CHECKLIST.md, V4_PUNCH_LIST.md

---

## Immediate Priority: Release Blockers (P0)

### 1. Execute E2E Tests (P0-1.1, P0-1.2, P0-1.3) 🔴 **CRITICAL**

**Status**: Test scripts created, execution pending  
**Why**: This is the primary remaining release blocker. All code implementation is complete, but real-device validation is required before shipping.

**Action Items**:

1. **Set up test infrastructure (P0-1.0)**:
   - [ ] Confirm API server is reachable from device
   - [ ] Create device build (not Expo Go) for representative audio behavior
   - [ ] Create two test accounts: Free and Paid
   - [ ] Prepare timer for cap verification and screen recording

2. **Execute Golden Flow Test (P0-1.1)**:
   - [ ] Follow `E2E_TEST_SCRIPTS.md` procedures
   - [ ] Test on iOS device
   - [ ] Test on Android device
   - [ ] Document results with screen recordings and defect log

3. **Execute Fallback Ladder Test (P0-1.2)**:
   - [ ] Test voice_ready mode (good network)
   - [ ] Test voice_pending mode (throttled 3G network)
   - [ ] Test silent mode (with kill switch)
   - [ ] Document each scenario with PASS/FAIL and evidence

4. **Execute Entitlement Test (P0-1.3)**:
   - [ ] Test Free tier restrictions (save denial, 5-minute cap, paid audio options locked)
   - [ ] Test Paid tier features (unlimited time, save/unsave, all affirmation counts)
   - [ ] Verify server enforcement (UI cannot bypass)
   - [ ] Document results in test matrix

**Deliverable**: Test execution log with PASS/FAIL results, defect list, and evidence (screen recordings, screenshots)

**Reference Documents**:
- `E2E_TEST_SCRIPTS.md` - Detailed test procedures
- `TEST_EXECUTION_CHECKLIST.md` - Quick reference checklist
- `V4_ENGINEERING_CHECKLIST.md` - Full checklist with acceptance criteria

---

## Short-Term: Post-Refactoring Enhancements (From Pseudocode)

These are the "power upgrades" mentioned in the refactoring pseudocode that stay privacy-safe.

### 2. Add Standard Metadata to PlanDraft 📊

**Purpose**: Turn chatbot into measurable learning system by tracking generation metadata

**Implementation**:
- [ ] Add fields to `PlanDraft` model (Prisma schema):
  - `promptVersion` (string, optional) - Track which prompt version was used
  - `strategyUsed` (enum: "premade" | "generated" | "validation") - How plan was created
  - `riskLane` (enum: "none" | "distress" | "normal") - Risk classification level
  - `intentCluster` (string, optional) - Detected intent cluster (from premade matching)
  - `matchScore` (number, optional) - Match confidence score (if premade)

- [ ] Update `v4-chat.ts` to populate metadata:
  - Set `strategyUsed` in `generatePlanPreview()` (always "generated")
  - Set `strategyUsed: "premade"` when using premade match
  - Set `strategyUsed: "validation"` in distress lane
  - Set `riskLane` from risk classification
  - Set `intentCluster` and `matchScore` from premade matching result

- [ ] Create migration for new fields

**Impact**: Enables efficacy tracking, A/B testing, and data-driven improvements to plan generation

**Reference**: Mentioned in refactoring pseudocode as "Add next" item

---

### 3. Add Reason Codes for Reroll/Abandon 📝

**Purpose**: Feed directly into heatmap + efficacy loop for understanding user preferences

**Implementation**:
- [ ] Add `reasonCode` field to reroll endpoint (optional)
- [ ] Define reason code taxonomy:
  - "too_generic" - Affirmations feel too generic
  - "doesnt_feel_true" - Don't resonate with user
  - "wrong_vibe" - Tone/energy doesn't match intent
  - "too_intense" - Too strong/powerful
  - "too_gentle" - Not strong enough
  - "wrong_count" - Want different number (but use edit instead)
  - "just_curious" - Wanted to see alternatives

- [ ] Update reroll endpoint to accept optional `reasonCode`
- [ ] Store reason code in UsageLedger metadata
- [ ] Update reroll UI to optionally collect reason (non-blocking)

**Impact**: Provides data for understanding why users regenerate plans, enabling better matching and generation

**Reference**: Mentioned in refactoring pseudocode as "Add next" item

---

### 4. Single Clarifying Question Gate (Optional) 🤔

**Purpose**: Ask one clarifying question when intent confidence is low (before generating)

**Implementation**:
- [ ] Add intent confidence scoring to `generateAssistantResponse()` or new function
- [ ] Define confidence threshold (e.g., < 0.7)
- [ ] When confidence is low, return response with `shouldOfferPlan: false` and ask one clarifying question
- [ ] Next user message triggers normal plan generation

**Status**: Lower priority - can be added after E2E testing

**Reference**: Mentioned in refactoring pseudocode as "Add next" item

---

## Medium-Term: Code Quality & Completeness

### 5. Fix TODO: Timezone in PlanCommit 📅

**Status**: Minor gap identified

**Current**: `timezoneOffsetMinutes` is hardcoded to `undefined` in `commitPlan()`

**Fix**:
- [ ] Add `timezoneOffsetMinutes` to `PlanCommitV4Schema` in `packages/contracts/src/schemas.ts`
- [ ] Update `commitPlan()` to use `commit.clientContext?.timezoneOffsetMinutes`
- [ ] Pass timezone through to `getDateKey()` for accurate usage tracking

**Reference**: Found in `apps/api/src/services/v4-chat.ts` line 335 (TODO comment)

---

## Ship-Quality Improvements (P1)

These can be done in parallel with E2E testing or after, but should not block release.

### 6. Copy and Product Language Audit (P1-2.0) ✍️

**Purpose**: Ensure all copy uses time-based language (no loop counting)

**Action Items**:
- [ ] Audit all user-facing strings:
  - HomeChat preview card labels
  - Player timer labels
  - EndCard header and benefits
  - Paywall and upgrade CTAs
- [ ] Verify no "loop" language anywhere
- [ ] Ensure Free always references "time cap" and "time remaining"
- [ ] Ensure Paid always references "unlimited session time"

**Deliverable**: Inventory of all strings with confirmation they are time-based

**Reference**: `V4_ENGINEERING_CHECKLIST.md` section "P1-2.0 Copy and product language audit"

---

### 7. Entitlement UI Alignment (P1-3.0) 🎨

**Purpose**: Make entitlement boundaries obvious in UI

**Action Items**:
- [ ] Free shows 5-minute remaining timer clearly
- [ ] Free "Save" always opens paywall (never shows misleading "Saved" state)
- [ ] Paid shows "unlimited" or removes countdown timer
- [ ] Verify UI never "optimistically unlocks" before server confirms

**Deliverable**: Screenshots of each boundary state

**Reference**: `V4_ENGINEERING_CHECKLIST.md` section "P1-3.0 Entitlement UI alignment"

---

### 8. Error Recovery Consistency Pass (P1-4.0) 🛡️

**Purpose**: Ensure every failure has a calm recovery path

**Action Items**:
- [ ] Network errors have retry option
- [ ] Voice failures have automatic silent fallback (no dead end)
- [ ] Entitlement denials have clear paywall prompt
- [ ] Back navigation never traps user or loses app state

**Deliverable**: Set of 5-10 "forced failure" recordings demonstrating recovery

**Reference**: `V4_ENGINEERING_CHECKLIST.md` section "P1-4.0 Error recovery consistency pass"

---

## Data Strategy Phase 3 (Future)

From PROGRESS.md, Phase 3 of Data Strategy includes:
- Create Prisma migration for new schema (already done)
- Integrate into more flows (feedback, replay events)
- Create data room structure with proof artifacts
- Add A/B testing framework
- SOC 2 readiness package

**Status**: Lower priority - can be done post-launch

---

## Recommended Sequence

### Week 1: Release Readiness
1. **Execute E2E tests** (P0-1.1, P0-1.2, P0-1.3) - **BLOCKER**
2. **Fix any critical defects** found during testing
3. **Copy audit** (P1-2.0) - Quick win, protects product truth

### Week 2: Quality & Metadata
4. **Fix timezone TODO** - Small gap fix
5. **Add PlanDraft metadata** - Enables learning system
6. **Entitlement UI alignment** (P1-3.0) - UX polish

### Week 3: Enhancements & Future
7. **Error recovery pass** (P1-4.0) - Resilience
8. **Add reason codes** - Data collection
9. **Clarifying question gate** (optional) - UX enhancement

---

## Quick Reference

**Test Execution**:
- Detailed procedures: `E2E_TEST_SCRIPTS.md`
- Quick checklist: `TEST_EXECUTION_CHECKLIST.md`

**Progress Tracking**:
- Implementation progress: `PROGRESS.md`
- Full punch list: `V4_PUNCH_LIST.md`
- Engineering checklist: `V4_ENGINEERING_CHECKLIST.md`

**Status Summary**:
- ✅ All code implementation: Complete (28/28 items)
- ✅ E2E test scripts: Ready for execution
- ⏳ E2E test execution: **PENDING (PRIMARY BLOCKER)**
- ⏳ Product tasks: Pending

---

## Key Insights from Analysis

1. **Code is Complete**: All implementation work is done. The system is structurally sound with server-enforced entitlements, proper data models, and comprehensive error handling.

2. **Testing is the Blocker**: The only thing preventing release is real-device validation. Test scripts are ready, but execution is required.

3. **Refactoring Opened Doors**: The recent pipeline refactoring identified logical next steps for enhancements (metadata, reason codes) that would make the system more measurable.

4. **No Dead Ends**: The architecture prevents dead-end errors and ensures graceful degradation. The remaining work is validation and polish.
