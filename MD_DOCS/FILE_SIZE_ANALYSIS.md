# File Size Analysis & Code Splitting Recommendations

**Date**: 2025-01-14  
**Purpose**: Identify large files that could be split to improve loading speeds and code maintainability

**⚠️ NOTE**: This is the original analysis. See `FILE_SIZE_ANALYSIS_UPDATED.md` for the current status after implementing splits.

---

## Executive Summary

After analyzing the codebase, several files exceed recommended sizes and could benefit from code splitting. The largest files are:

1. **AudioEngine.ts** (1,399 lines) - Core audio playback engine
2. **AIAffirmationScreen.tsx** (1,340 lines) - Complex UI with two distinct paths
3. **apps/api/src/index.ts** (853 lines) - Main API router with all endpoints
4. **PlayerScreen.tsx** (779 lines) - Complex player UI with multiple sections
5. **HomeScreen.tsx** (756 lines) - Home screen with carousel and multiple sections
6. **ExploreScreen.tsx** (686 lines) - Explore screen with hero deck and filters

---

## Detailed Analysis

### 🔴 Critical: Files Over 1000 Lines

#### 1. `packages/audio-engine/src/AudioEngine.ts` (1,399 lines)

**Current Structure:**
- Single monolithic class handling all audio operations
- Includes: preroll management, crossfading, ducking, smoothing, drift correction, automation

**Recommendation: Split into modules**
```
packages/audio-engine/src/
├── AudioEngine.ts (core orchestration, ~400 lines)
├── PrerollManager.ts (preroll logic, ~200 lines)
├── MixerController.ts (mix automation, crossfade, ~300 lines)
├── DriftCorrector.ts (drift correction logic, ~150 lines)
├── PlayerManager.ts (player lifecycle, ~200 lines)
└── AudioSession.ts (session configuration, ~150 lines)
```

**Benefits:**
- Faster initial load (only load what's needed)
- Better tree-shaking
- Easier testing and maintenance
- Clearer separation of concerns

---

#### 2. `apps/mobile/src/screens/AIAffirmationScreen.tsx` (1,340 lines)

**Current Structure:**
- Single component handling both "Quick Generate" and "Guided" paths
- Includes: form logic, generation logic, review/editing UI, audio settings

**Recommendation: Split by feature**
```
apps/mobile/src/screens/AIAffirmation/
├── AIAffirmationScreen.tsx (router/orchestrator, ~100 lines)
├── QuickGenerateFlow.tsx (quick path, ~300 lines)
├── GuidedFlow.tsx (guided path, ~400 lines)
├── ReviewEditStep.tsx (review/editing UI, ~350 lines)
└── AudioSettingsPanel.tsx (audio settings UI, ~200 lines)
```

**Benefits:**
- Lazy loading: Only load the flow the user selects
- Better code organization
- Easier to maintain each flow independently
- Smaller bundle per route

---

### 🟡 High Priority: Files 500-1000 Lines

#### 3. `apps/api/src/index.ts` (853 lines)

**Current Structure:**
- Single file with all API routes
- Includes: sessions, affirmations, entitlements, user values, storage serving

**Recommendation: Split by domain**
```
apps/api/src/
├── index.ts (app setup, middleware, ~100 lines)
├── routes/
│   ├── sessions.ts (session endpoints, ~200 lines)
│   ├── affirmations.ts (affirmation endpoints, ~100 lines)
│   ├── entitlements.ts (entitlement endpoints, ~50 lines)
│   ├── user.ts (user values/struggle, ~150 lines)
│   └── storage.ts (storage/asset serving, ~250 lines)
```

**Benefits:**
- Faster server startup (only load needed routes)
- Better organization
- Easier to add new routes
- Clearer API structure

---

#### 4. `apps/mobile/src/screens/PlayerScreen.tsx` (779 lines)

**Current Structure:**
- Single component with: error display, main card, controls, mix panel, menu

**Recommendation: Extract components**
```
apps/mobile/src/screens/PlayerScreen/
├── PlayerScreen.tsx (main orchestrator, ~200 lines)
├── PlayerErrorDisplay.tsx (error UI, ~100 lines)
├── PlayerMainCard.tsx (title, visualization, time, ~150 lines)
├── PlayerControls.tsx (play/pause/skip, ~150 lines)
├── MixPanel.tsx (mix controls, ~180 lines)
└── PlayerMenu.tsx (already exists, but could be moved here)
```

**Benefits:**
- Smaller initial bundle
- Better component reusability
- Easier to test individual parts
- Lazy load mix panel (only when opened)

---

#### 5. `apps/mobile/src/screens/HomeScreen.tsx` (756 lines)

**Current Structure:**
- Single component with: header, create reality section, carousel, quick sessions, continue practice

**Recommendation: Extract sections**
```
apps/mobile/src/screens/HomeScreen/
├── HomeScreen.tsx (main orchestrator, ~150 lines)
├── HomeHeader.tsx (greeting, profile, ~80 lines)
├── CreateRealitySection.tsx (quick generate/take control, ~100 lines)
├── SessionCarousel.tsx (carousel + info section, ~250 lines)
├── QuickSessionsSection.tsx (quick sessions card, ~50 lines)
└── ContinuePracticeSection.tsx (continue card, ~120 lines)
```

**Benefits:**
- Faster initial render (lazy load sections)
- Better code organization
- Easier to maintain
- Can lazy load carousel data

---

#### 6. `apps/mobile/src/screens/ExploreScreen.tsx` (686 lines)

**Current Structure:**
- Single component with: hero deck, filters, goal cards, recommended sessions, new arrivals

**Recommendation: Extract sections**
```
apps/mobile/src/screens/ExploreScreen/
├── ExploreScreen.tsx (main orchestrator, ~150 lines)
├── ExploreHeroSection.tsx (hero deck, ~150 lines)
├── ExploreFilters.tsx (filter chips, ~80 lines)
├── ExploreGoalCards.tsx (goal cards, ~100 lines)
├── ExploreSessionsList.tsx (recommended/new arrivals, ~200 lines)
```

**Benefits:**
- Lazy load hero deck (heavy component)
- Better organization
- Easier to maintain sections independently

---

## Implementation Priority

### Phase 1: High Impact, Low Risk
1. **AIAffirmationScreen.tsx** - Split into Quick/Guided flows (immediate lazy loading benefit)
2. **HomeScreen.tsx** - Extract carousel component (large component, can lazy load)
3. **PlayerScreen.tsx** - Extract mix panel (only loads when opened)

### Phase 2: Medium Impact, Medium Risk
4. **ExploreScreen.tsx** - Extract hero deck (can lazy load)
5. **apps/api/src/index.ts** - Split routes (better organization, faster startup)

### Phase 3: High Impact, Higher Risk (Requires Testing)
6. **AudioEngine.ts** - Split into modules (core functionality, needs thorough testing)

---

## Loading Speed Impact

### Current Bundle Sizes (Estimated)
- **Mobile App Initial Bundle**: ~2.5MB (includes all screens)
- **AudioEngine**: ~150KB (always loaded)
- **AIAffirmationScreen**: ~180KB (always loaded, even if not used)

### After Splitting (Estimated)
- **Mobile App Initial Bundle**: ~1.8MB (40% reduction)
- **AudioEngine Core**: ~50KB (only core loaded initially)
- **AIAffirmationScreen Router**: ~20KB (flows lazy loaded)
- **Lazy Loaded Components**: Loaded on-demand

### Performance Gains
- **Initial Load Time**: 30-40% faster
- **Time to Interactive**: 25-35% faster
- **Memory Usage**: 20-30% reduction on initial load
- **Code Splitting**: Better tree-shaking, smaller bundles

---

## Recommendations for Implementation

### 1. Use React.lazy() for Screen Components
```typescript
const AIAffirmationScreen = React.lazy(() => import('./screens/AIAffirmationScreen'));
const ExploreScreen = React.lazy(() => import('./screens/ExploreScreen'));
```

### 2. Extract Heavy Components
- Move large sub-components to separate files
- Use dynamic imports for components that aren't immediately visible

### 3. Split AudioEngine Carefully
- Keep public API stable
- Test thoroughly after splitting
- Consider keeping as single file if splitting causes issues

### 4. API Route Splitting
- Use Hono's route grouping
- Split by domain (sessions, users, etc.)
- Keep middleware in main file

---

## Notes

- **AudioEngine.ts**: While large, it's a core dependency. Splitting should be done carefully with thorough testing.
- **Screen Components**: These are good candidates for lazy loading since they're route-based.
- **API Routes**: Splitting will improve server startup time and code organization.

---

## Next Steps

1. Start with AIAffirmationScreen (highest impact, lowest risk)
2. Extract HomeScreen carousel component
3. Split API routes by domain
4. Consider AudioEngine splitting after other changes are stable

