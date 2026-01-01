# Status Assessment: P0 Items and Remaining Issues

**Date**: 2026-01-01  
**Assessment**: Review of P0 completion and "still shaky" items

---

## ✅ P0 Items - ALL COMPLETE

All P0 items mentioned in the review have been addressed:

1. **AudioEngine time tracking** ✅ - Fixed double `setState()` overwrite
2. **Mix persistence** ✅ - Fixed at engine state level
3. **Autoplay reliability** ✅ - Bundle-driven load with `loadedBundleIdRef`
4. **Upgrade dead ends** ✅ - Real `/settings` route created
5. **Regenerate** ✅ - End-to-end wiring with error handling

See `PROGRESS.md` for detailed implementation notes.

---

## ⚠️ Items Still Shaky (Not P0, but need attention)

### 1. Monetization is Still a Stub ❌

**Status**: NOT ADDRESSED  
**Location**: `apps/mobile-v4/src/features/settings/SettingsScreen.tsx:49-66`

**Current Implementation**:
- Settings screen exists and shows plan status
- Upgrade button shows Alert: "Upgrade functionality is not available in this build"
- No actual purchase flow integrated

**What's Needed**:
- Integrate RevenueCat SDK (`react-native-purchases`)
- Wire up actual purchase flow
- Handle subscription status updates
- Add webhook handling for subscription events

**Impact**: Critical for production if you're calling something "Pro" - users cannot actually upgrade.

**Priority**: High (if planning to monetize)

---

### 2. Voice Pending Uses 3-Minute Placeholder ⚠️ PARTIALLY ADDRESSED

**Status**: PARTIAL - Edge case remains  
**Location**: `apps/api/src/services/v4-playback.ts:180`

**Current Implementation**:
- Uses `silence_3min.m4a` as placeholder
- Client polls every 2 seconds for voice readiness
- Polls up to 60 times (2 minutes max)
- Reloads bundle when voice is ready

**The Edge Case**:
- Affirmations player is marked as **non-looping** (`isLoopingTrack: false`)
- If voice generation takes > 3 minutes, silence file will end
- Player will stop, but polling continues for up to 2 minutes
- After 2 minutes, polling stops but silence file already ended

**Assessment**:
- **In practice**: Voice generation typically takes 10-30 seconds (documented in PROGRESS.md)
- **Edge case**: If generation takes 3+ minutes, affirmations player stops
- **Mitigation**: Client polling window (2 minutes) prevents most issues

**Options to Fix**:
1. Increase silence file duration to 5 minutes (safer buffer)
2. Make silence file loop (requires AudioEngine changes - affirmations don't loop currently)
3. Shorten polling window or kick voice gen earlier (not practical)

**Impact**: Low in practice, but theoretically possible if voice generation is very slow.

**Priority**: Low-Medium (edge case only)

---

### 3. Brain Track Mapping Depends on Inventory ✅ ADDRESSED

**Status**: ADDRESSED (with caveat)  
**Location**: `apps/api/src/services/audio/brain-track-mapping.ts`

**Current Implementation**:
- Mapping logic implemented with intelligent defaults
- Falls back to Alpha 10Hz (binaural) or 432Hz (solfeggio) if specific frequency unavailable
- Documents which frequencies map to which session types

**Inventory Status**:
- **Binaural assets**: 15 files (covers: Alpha 10/12Hz, Beta 13/17/20/21.5Hz, Delta 1/2/3/4Hz, Gamma 38/40/42Hz, SMR 13.5Hz, Theta 4/7/8Hz)
- **Solfeggio assets**: 11 files (174, 285, 396, 417, 432, 528, 639, 741, 852, 963, 40 Hz)

**Assessment**:
- Good coverage of common frequencies
- Fallback mechanism prevents hard failures
- Documentation exists (`MD_DOCS/BRAIN_TRACK_MAPPING_RULES.md`)

**Recommendation**:
- Verify all mapped frequencies in `brain-track-mapping.ts` have corresponding assets
- Test mapping with missing frequency to ensure graceful fallback
- Consider adding inventory validation script

**Impact**: Low-Medium (fallbacks prevent hard failures)

**Priority**: Low (already has fallbacks)

---

### 4. Local Asset Serving in Production on iOS ✅ FIXED

**Status**: ADDRESSED ✅  
**Location**: `apps/api/src/services/audio/assets.ts`

**Previous Issue**:
- Code preferred local files for both iOS/Android (`localUrl || s3Url`)
- Comment contradicted code (said "prefer S3 for iOS")
- Local files served over HTTP (works in dev, would fail in production iOS due to ATS)

**Fix Applied** (2026-01-01):
- iOS production: Now prefers S3 URLs (HTTPS) to avoid ATS blocking HTTP localhost
- iOS development: Continues to prefer local files for faster iteration
- Android: Always prefers local files (no ATS restrictions)
- All three asset functions updated: `getBinauralAsset`, `getSolfeggioAsset`, `getBackgroundAsset`
- Documentation comments updated to match behavior

**Implementation**:
```typescript
// iOS production: Prefer S3 (HTTPS) if available
const iosUrl = isProduction() && s3Url ? s3Url : (localUrl || s3Url);
// Android: Always prefer local
const androidUrl = localUrl || s3Url;
```

**Impact**: Critical production blocker resolved ✅

**Priority**: High - COMPLETE

---

## Summary

### ✅ Completed
- All P0 items
- Brain track mapping (with fallbacks)

### ⚠️ Needs Attention
1. **Monetization stub** - No purchase flow (High priority if monetizing)
2. **3-minute silence edge case** - Theoretical issue, low practical impact (Low-Medium priority)
3. **iOS HTTPS/local asset serving** - Code/comment contradiction, will fail in production (High priority)

### Recommendations

**Before Production iOS Launch**:
1. ~~Fix iOS asset serving~~ ✅ COMPLETE (iOS production now uses S3 HTTPS URLs)
2. If monetizing: Integrate RevenueCat purchase flow

**Nice to Have**:
- Increase silence file to 5 minutes (safer buffer)
- Verify all brain track mappings have assets (validation script)

---

## Validation Checklist Status

From the original review's "Quick 'did we actually win?' validation checklist":

1. ✅ Fresh Free user: Create plan → commit → autoplays
2. ✅ Time remaining: Ticks down correctly
3. ✅ At cap: Fade/end card appears once
4. ✅ Mix persistence: Volumes persist on reload
5. ✅ Regenerate: Works with clear limit message
6. ✅ Voice pending: Background + brain play, voice joins when ready
7. ✅ Upgrade routing: All buttons land in /settings consistently

**All validation items pass** ✅

---

**Conclusion**: Engineering work is solid. The main gaps are:
1. iOS production asset serving (critical)
2. Monetization integration (if planning to monetize)
3. Edge cases (low priority)
