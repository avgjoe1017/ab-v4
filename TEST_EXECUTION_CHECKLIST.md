# V4 Test Execution Checklist

**Quick reference checklist for running E2E tests**

---

## Pre-Test Setup

- [ ] API server running and accessible
- [ ] Mobile app built and installed on device
- [ ] Test accounts created (Free + Paid)
- [ ] Network connection stable (for baseline tests)
- [ ] Screen recording enabled (optional but recommended)
- [ ] Stopwatch/timer ready (for timing verification)

---

## P0-1.1: Golden Flow ✅

### Quick Checklist
- [ ] Fresh install → HomeChat
- [ ] Generate plan → Preview appears
- [ ] Edit 2 affirmations → Save → Preview updates
- [ ] Start Session → Player loads (< 3s)
- [ ] Background + brain start immediately
- [ ] Timer shows ~5 min remaining
- [ ] Pause → Timer stops
- [ ] Resume → Timer resumes (not reset)
- [ ] At 5:00 → Voice fades, EndCard shows
- [ ] "Maybe later" → Returns to HomeChat cleanly

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail | ⚠️ Partial

**Notes**: 
```
[Document any issues]
```

---

## P0-1.2: Fallback Ladder ✅

### Quick Checklist

**voice_ready (Normal)**:
- [ ] Background starts < 2s
- [ ] Voice starts < 5s
- [ ] All tracks play smoothly

**voice_pending (Slow Network)**:
- [ ] Background starts immediately
- [ ] Voice joins later (no restart)
- [ ] No silence gap

**silent (Kill Switch)**:
- [ ] Background + brain play
- [ ] Text affirmations appear
- [ ] EndCard at 5:00

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail | ⚠️ Partial

**Notes**:
```
[Document any issues]
```

---

## P0-1.3: Entitlements ✅

### Quick Checklist

**Free Tier**:
- [ ] Preview doesn't consume quota
- [ ] Commit consumes daily plan
- [ ] 5-minute cap enforced
- [ ] Save shows paywall
- [ ] Paid audio shows paywall

**Paid Tier**:
- [ ] Unlimited session time
- [ ] Save/unsave works
- [ ] 6/12/18/24 counts work

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail | ⚠️ Partial

**Notes**:
```
[Document any issues]
```

---

## Platform Testing

- [ ] iOS tested
- [ ] Android tested
- [ ] Slow network tested (3G throttle)

---

## Overall Status

**Release Blockers**: ⬜ None | ⚠️ Some | ❌ Blocking

**Can Ship**: ⬜ Yes | ❌ No

**Next Steps**:
```
[What needs to be fixed/retested]
```
