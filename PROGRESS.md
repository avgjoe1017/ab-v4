# V4 Progress Log

This document tracks all changes made during the V4 rebuild from V3.

---

## 2025-01-30 - Fixed Audio Asset Serving (404 Errors)

### Decision: Fix Path Resolution for Static Audio Assets
**Why**: Audio assets (background, binaural, solfeggio) were returning 404 errors because the API was looking in the wrong directory. The path calculation went up only one level instead of two.

### Implementation ✅

**Fixed `apps/api/src/index.ts` (line 3312-3315):**
- Changed `projectRoot = path.resolve(process.cwd(), "..")` to `path.resolve(process.cwd(), "..", "..")`
- This correctly resolves from `apps/api` to project root (`ab-v4`) instead of stopping at `apps`
- Added log message to show where assets are being served from

**Verified paths:**
- `cwd` = `C:\Users\joeba\Documents\ab-v4\apps\api`
- Incorrect `projectRoot` (one level up) = `C:\Users\joeba\Documents\ab-v4\apps` 
- Correct `projectRoot` (two levels up) = `C:\Users\joeba\Documents\ab-v4`
- Assets are at `C:\Users\joeba\Documents\ab-v4\assets\audio\...`

**Fixed `apps/mobile-v4/src/features/player/utils/bundleConverter.ts`:**
- Removed hardcoded fallback URL using wrong S3 bucket (`affirm-beats-assets`)
- The API is now responsible for providing valid URLs; client just warns if missing

**Root Cause:**
- The `index.ts` static file serving logic only went up one level (`..`) but needed to go up two (`../..`)
- The `assets.ts` file had the correct path (`PROJECT_ROOT = path.resolve(process.cwd(), "..", "..")`), but the serving middleware didn't match
- Files exist locally at `assets/audio/background/looped/Babbling Brook.m4a` and `assets/audio/binaural/alpha_10hz_400_3min.m4a`

**Impact:**
- Background audio now loads correctly from local API server
- Binaural audio now loads correctly from local API server
- No more 404 errors for audio assets
- Players should now play audio instead of failing silently

---

## 2025-01-30 - Fixed Watchdog Infinite Restart Loop for Failed Player Loads

### Decision: Add Failed Restart Tracking to Prevent Infinite Loops
**Why**: Players with invalid durations (NaN or 0) were causing the watchdog to continuously restart them, creating an infinite loop. This happened when audio files failed to load (404 errors, network issues, invalid data URIs). The watchdog would detect the player as "stopped" and try to restart it, but since the file never loaded, it would immediately stop again, creating a restart loop.

### Implementation ✅

**Added failed restart tracking to AudioEngine:**
- Added `affFailedRestarts`, `binFailedRestarts`, `bgFailedRestarts` counters to track failed restart attempts
- Added `MAX_FAILED_RESTARTS = 3` constant to limit restart attempts
- Modified `checkAndRestartPlayer` to:
  1. Check if player duration is invalid (NaN or <= 0) before attempting restarts
  2. Give players 2 seconds to load before marking as failed
  3. Track failed restart attempts and stop trying after 3 failures
  4. Reset failed counts on successful restart or when loading new bundle
- Updated watchdog to pass failed restart counts and setters to `checkAndRestartPlayer`
- Reset failed counts when loading new bundle or when playback stops

**Root Cause:**
- Players with duration `NaN` or `0` indicate the audio file never loaded (404, network error, invalid data URI)
- The watchdog was checking `duration <= 0` but `NaN <= 0` evaluates to `false`, so NaN durations were still being checked
- The watchdog would continuously try to restart players that could never load, creating spam in logs and wasting CPU

**Solution:**
- Detect invalid durations early and skip restart attempts
- Track failed attempts and give up after 3 tries
- Only log warnings once to avoid spam
- Reset counters on successful loads or new bundle loads

**Impact:**
- Prevents infinite restart loops for players that fail to load
- Reduces log spam from continuous restart attempts
- Improves performance by not wasting CPU on impossible restarts
- Better error handling for network failures and invalid URLs

---

## 2025-01-30 - Fixed Missing setSessionDurationCap Method Export

### Decision: Rebuild Audio Engine Package to Include setSessionDurationCap
**Why**: The mobile app was throwing a runtime error: `engine.setSessionDurationCap is not a function (it is undefined)`. The method existed in the source code but wasn't in the compiled TypeScript declaration file, causing Metro bundler to use an outdated version.

### Implementation ✅

**Rebuilt `packages/audio-engine`:**
- Ran `pnpm build` to regenerate TypeScript declaration files and JavaScript output
- Verified `setSessionDurationCap` method is now present in:
  - Source: `packages/audio-engine/src/AudioEngine.ts` (line 1104)
  - Declaration: `packages/audio-engine/dist/AudioEngine.d.ts` (line 98)
  - JavaScript: `packages/audio-engine/dist/AudioEngine.js` (line 952)

**Root Cause:**
- The method was added to the source code but the package wasn't rebuilt
- Metro bundler was using a cached version of the audio-engine package that didn't include the method
- TypeScript compilation needed to regenerate the declaration files

**Solution:**
- Rebuilt the audio-engine package to ensure all methods are properly exported
- The method signature is: `setSessionDurationCap(capMs: number | "unlimited"): void`
- This method is called from `PlayerScreen.tsx` after loading a bundle to set the session duration cap from entitlements

**Next Steps for User:**
- Restart Metro bundler (stop with Ctrl+C and run `pnpm -C apps/mobile-v4 start` again)
- If issue persists, clear Metro cache: `pnpm -C apps/mobile-v4 start --clear`
- The method should now be available at runtime

**Impact:**
- Fixes the runtime error preventing bundle loading in PlayerScreen
- Enables proper session duration cap functionality for Free tier users (5-minute limit)
- Method is properly exported and available to consuming applications

---

## 2025-01-27 - Debugged and Fixed Packages Folder TypeScript Errors

### Decision: Comprehensive Debug of Packages Folder
**Why**: User requested debugging of the entire `packages` folder to identify and fix TypeScript compilation errors. Found 2 main issues in the audio-engine package that were preventing successful compilation.

### Implementation ✅

**Fixed `packages/audio-engine/src/AudioEngine.ts` (lines 349, 355, 361):**
- **Issue**: TypeScript was inferring `player.play()` as returning `void` instead of `Promise<void>`, causing errors when trying to call `.catch()` on the result
- **Root Cause**: TypeScript's type inference was incorrectly narrowing the return type of `play()` method from `AudioPlayer | null`
- **Solution**: Wrapped `player.play()` calls in `Promise.resolve()` to ensure proper error handling
  - This allows us to catch errors even if TypeScript thinks it returns void
  - The pattern is: `Promise.resolve(player.play()).catch((err: unknown) => { ... })`
- **Location**: Watchdog restart logic in `checkAndRestartPlayer` function that handles stuck players

**Fixed `packages/audio-engine/src/ducking.ts` (lines 65, 71, 76):**
- **Issue**: TypeScript strict mode was flagging `segment` as possibly undefined even though the while loop condition should guarantee it exists
- **Root Cause**: TypeScript's strict null checking (`noUncheckedIndexedAccess`) requires explicit null checks for array access, even when logical conditions suggest it's safe
- **Solution**: Added explicit null check after array access: `if (!segment) { break; }`
- **Location**: `isVoiceActive()` method in `VoiceActivityDucker` class where segments are accessed by index

**Updated `packages/audio-engine/tsc_error.txt`:**
- Updated last checked date to 2025-01-27
- Documented the two resolved issues with explanations
- Noted that all packages now compile successfully

**Verification:**
- Ran `pnpm typecheck` on all three packages (audio-engine, contracts, utils)
- All packages compile successfully with no TypeScript errors
- No linter errors found in the packages folder

**Impact**: 
- All packages now compile successfully without TypeScript errors
- Type safety maintained with proper null checks and error handling
- Code is ready for further development and production use
- Fixed issues were related to TypeScript's strict mode checks which help catch potential runtime errors

**Notes:**
- One TODO comment found in `packages/contracts/src/migrations.ts` for v1/v2 -> v3 mapping (non-critical feature enhancement)
- The `play()` method return type discrepancy suggests the expo-audio type definitions might need review, but the workaround is safe and functional

---

## 2025-01-30 - Fixed ffprobe-static Type Declaration

### Decision: Create Type Declaration for ffprobe-static Package
**Why**: TypeScript was reporting a missing type declaration for the `ffprobe-static` package, which provides a static binary path for ffprobe used in audio metadata extraction.

### Implementation ✅

**Created `apps/api/src/types/ffprobe-static.d.ts`:**
- Added module declaration for `ffprobe-static` package
- Declared interface with `path: string` property matching the package's API
- Exported as default export to match the import pattern used in `metadata.ts`

**Fixed `apps/api/src/services/data-strategy/debug-cache.ts`:**
- Fixed Buffer.from() type issues by adding explicit null checks for hex strings
- Split key buffer creation into separate steps for better type inference

**Fixed `apps/api/src/services/data-strategy/cold-start.ts`:**
- Added null check for `matchedRule` after default rule assignment to ensure it's never undefined

**Fixed `apps/api/src/services/curation.ts`:**
- Fixed `getCurationPreferences()` to properly convert database preferences to CurationPreferences interface type

**Impact**: 
- The `ffprobe-static` TypeScript error is now resolved
- All type declarations are properly defined
- Code compiles without missing type declaration errors for external packages

---

## 2025-01-30 - Debugged and Fixed Apps Folder Issues

### Decision: Comprehensive Debug of Apps Folder
**Why**: User requested debugging of the entire `apps` folder to identify and fix TypeScript errors, type mismatches, missing imports, and configuration issues.

### Implementation ✅

**Fixed `packages/contracts/src/errors.ts`:**
- Added missing ApiErrorCode types that were being used but not defined:
  - `NETWORK_ERROR`, `GENERATION_ERROR`, `REROLL_LIMIT_REACHED`
  - `INVALID_PLAN_DRAFT_ID`, `AFFIRMATION_COUNT_NOT_ALLOWED`, `VOICE_NOT_ALLOWED`
  - `INVALID_PLAN_ID`, `FORBIDDEN`, `PLAYBACK_ERROR`
  - `INVALID_JOB_ID`, `INVALID_STATE`, `INVALID_USER_ID`
  - `PLAYBACK_NOT_READY`, `PLAYBACK_NETWORK_ERROR`, `UNKNOWN_ERROR`
  - `INVALID_ACTION`, `INVALID_INPUT`
- Rebuilt contracts package to propagate changes

**Fixed `apps/api/src/index.ts`:**
- Fixed PlanDraft title access: Changed `updated.title` to `updated.intentSummary || "Your Plan"` since PlanDraft doesn't have a title field
- Fixed duplicate `userId` declaration: Removed redundant declaration on line 1128
- Fixed Plan query null handling: Added proper null check for userId when filtering saves relation
- Fixed ownerUserId usage: Changed `ownerUserId: userId` to `userId` in Plan delete query (Plan model uses `userId`, not `ownerUserId`)
- Fixed possibly undefined object: Added null check for `results[results.length - 1]` before accessing properties
- Fixed v4Error.code type issue: Added proper type casting to ApiErrorCode for V4 error codes
- Added missing imports: Imported `getModerationStats`, `getFlaggedSessions`, `moderateAffirmationAction`, `bulkModerateAffirmations` from `./services/admin/moderation`
- Fixed audit log resourceId: Removed `resourceId: null` (changed to undefined by omitting the field)

**Fixed `apps/api/src/middleware/admin-auth.ts`:**
- Fixed circular import: Removed import of `error` from `../index`, defined local error helper function instead
- Fixed possibly undefined object: Added null checks for `roleHierarchy[admin.role]` and `roleHierarchy[requiredRole]`

**Fixed `apps/api/src/services/audio/generation.ts`:**
- Fixed return type: Changed `return existingComposed.url` to `return { hash: composedHash, url: existingComposed.url }` to match function signature
- Fixed possibly undefined array access: Added null check for `aff` before using it in hash calculation

**Fixed `apps/api/src/services/curation.ts`:**
- Fixed type mismatch: Added proper type conversion from database `CurationPreferences` (with `string | null`) to interface `CurationPreferences` (with optional union types)
- Converted null values to undefined and cast string values to proper union types

**Impact**: 
- Reduced TypeScript errors from 30+ to ~3 (remaining are minor type declaration issues for external packages)
- All critical type mismatches resolved
- All missing imports added
- All null/undefined handling issues fixed
- Code now properly type-checked and ready for further development

---

## 2025-01-30 - Fixed PlayerScreen AudioEngine API Usage and Default Background

### Decision: Fix AudioEngine API Mismatch and Background Asset Default
**Why**: PlayerScreen was using incorrect AudioEngine API methods (`getSnapshot()` instead of `getState()`, incorrect unsubscribe pattern) and the playback service was using `"default"` as background ID instead of the actual default `"Babbling Brook"`, causing asset lookup failures.

### Implementation ✅

**Fixed `apps/mobile-v4/src/features/player/PlayerScreen.tsx`:**
- Changed `engine.getSnapshot()` to `engine.getState()` (2 places)
- Fixed unsubscribe pattern: `engine.subscribe()` returns an unsubscribe function, so changed from `engine.unsubscribe(listener)` to `const unsubscribe = engine.subscribe(listener); return () => unsubscribe();`

**Fixed `apps/api/src/services/v4-playback.ts`:**
- Changed default background ID from `"default"` to `DEFAULT_BACKGROUND_ID` ("Babbling Brook")
- Imported `DEFAULT_BACKGROUND_ID` from `./audio/assets`

**Fixed `apps/api/src/services/audio/assets.ts`:**
- Exported `DEFAULT_BACKGROUND_ID` constant so it can be imported by other services
- Made background asset lookup more graceful: If local files don't exist, falls back to S3 URLs for both iOS and Android instead of throwing an error immediately
- Android now uses S3 URLs as fallback if local files are missing (previously would throw error)

**Impact**: PlayerScreen now correctly uses the AudioEngine API, and the playback service uses the correct default background asset ID. The background asset lookup will now look for "Babbling Brook.m4a" instead of "default.m4a", and gracefully falls back to S3 URLs if local assets don't exist. This makes development easier when local asset files aren't present.

---

## 2025-01-30 - Bypassed Limits in Development Mode

### Decision: Remove All Limits in Development for Easier Testing
**Why**: During development, hitting daily plan limits, reroll limits, and other restrictions makes testing difficult. User requested bypassing all limits in development mode while keeping strict enforcement in production.

### Implementation ✅

**Updated `apps/api/src/services/v4-entitlements.ts`:**

1. **`getEntitlementV4()` function:**
   - Added development mode check using `isDevelopment()` from config
   - In development, returns unlimited entitlements:
     - `dailyPlans: "unlimited"`
     - `maxSessionDurationMs: "unlimited"`
     - `affirmationCountsAllowed: [6, 12, 18, 24]` (all counts)
     - `canSave: true`
     - `voicesAllowed: "all"`
     - `canPickBrainTrack: true`
     - `canPickBackground: true`

---

## 2026-01-01 - Created Missing Audio Assets Directory Structure

### Decision: Create Audio Assets Directory Structure
**Why**: User reported they couldn't find the audio assets (binaural, background, solfeggio) in the project. Investigation revealed that the code expects these assets to exist in `assets/audio/` (or `apps/assets/audio/`), but these directories were missing from the repository. The code references these assets extensively but they were never created.

### Implementation ✅

**Created directory structure:**
- `assets/audio/binaural/` - For binaural beat files (e.g., `alpha_10hz_400_3min.m4a`)
- `assets/audio/background/looped/` - For background ambient sounds (e.g., `Babbling Brook.m4a`)
- `assets/audio/solfeggio/` - For solfeggio frequency files (e.g., `solfeggio_528_3min.m4a`)

**Created documentation:**
- `assets/audio/README.md` - Comprehensive guide explaining:
  - Directory structure and expected file formats
  - Naming conventions for each asset type
  - Common brainwave states and frequencies
  - How assets are served (local vs S3)
  - Instructions for adding new assets

**Created `.gitkeep` files:**
- Added `.gitkeep` files in each directory to ensure they're tracked in git
- These files document the expected file formats for each directory

**Key findings:**
- The code in `apps/api/src/services/audio/assets.ts` looks for assets in:
  1. `apps/assets/audio/` (preferred)
  2. `assets/audio/` (fallback at project root)
- Assets can be served from:
  - Local files (for Android development) via `/assets/*` endpoint
  - S3 storage (for iOS and production) to avoid App Transport Security issues
- Default assets expected:
  - Binaural: `alpha_10hz_400_3min.m4a` (default)
  - Background: `Babbling Brook.m4a` (default)
  - Solfeggio: Various frequencies (174, 285, 396, 417, 528, 639, 741, 852, 963 Hz)

**Impact**: 
- The directory structure is now in place for audio assets
- Documentation explains where to place files and what formats are expected
- The code will now be able to find local assets if they're added to these directories
- For development, the code gracefully falls back to S3 URLs if local files don't exist (as implemented in previous fixes)

**Next steps for user:**
- Add actual audio files to the appropriate directories
- Or ensure S3 is configured and assets are uploaded via `apps/api/scripts/upload-static-assets-to-s3.ts`
- The code will work with either local files or S3 URLs

---

## 2026-01-01 - Changed Audio Asset Loading to Always Prefer Local Files

### Decision: Always Use Local Files for Audio Assets to Avoid Buffering
**Why**: User added audio files and requested that the app always play from local files instead of S3 URLs to avoid buffering and downloading issues. This improves playback performance and reduces network dependency.

### Implementation ✅

**Updated `apps/api/src/services/audio/assets.ts`:**

1. **`getBinauralAsset()` function:**
   - Changed priority: Both iOS and Android now prefer local files first
   - Old behavior: iOS used S3 URLs, Android used local URLs
   - New behavior: Both platforms use local URLs if available, fall back to S3 only if local files don't exist
   - Updated logic: `const iosUrl = localUrl || s3Url; const androidUrl = localUrl || s3Url;`

2. **`getSolfeggioAsset()` function:**
   - Changed priority: Both iOS and Android now prefer local files first
   - Old behavior: iOS used S3 URLs, Android used local URLs
   - New behavior: Both platforms use local URLs if available, fall back to S3 only if local files don't exist
   - Updated logic: `const iosUrl = localUrl || s3Url; const androidUrl = localUrl || s3Url;`

3. **`getBackgroundAsset()` function:**
   - Changed priority: Both iOS and Android now prefer local files first
   - Old behavior: iOS preferred S3 URLs, Android preferred local URLs
   - New behavior: Both platforms use local URLs if available, fall back to S3 only if local files don't exist
   - Updated logic: `const iosUrl = localUrl || fallbackS3Url || s3Url; const androidUrl = localUrl || fallbackS3Url || s3Url;`

4. **Updated documentation comments:**
   - Changed all function documentation to reflect new behavior
   - Removed references to platform-specific URL preferences
   - Added note that local files are always preferred to avoid buffering

**Impact**: 
- Audio assets now load faster with no buffering when local files are available
- Reduced network dependency and bandwidth usage
- Better user experience with immediate playback
- S3 URLs are still used as fallback if local files don't exist (maintains backward compatibility)
- Works for both iOS and Android platforms

**Technical Notes:**
- Local files are served via the API's `/assets/*` endpoint with Range request support
- Files are served over HTTP from localhost (works in development)
- For production, the API server should use HTTPS to satisfy iOS App Transport Security requirements
- The asset serving endpoint already supports range requests for efficient streaming
