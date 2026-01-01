# Migration Plan: Expo Router App → Feature-Based Structure

**Date:** 2025-01-XX  
**Goal:** Migrate existing Expo Router app from `app/` to `apps/mobile-v4/src/` following the V4 rebuild outline.

---

## Current State

### Existing Structure
```
app/
  (tabs)/
    (home)/
      _layout.tsx          # Expo Router layout
      index.tsx            # HomeChatScreen (chat UI)
```

### Target Structure (from outline)
```
apps/mobile-v4/
  src/
    app/
      navigation/          # minimal nav (Chat, Library, Settings modal)
    features/
      chat/
        components/
        state/
        api/
        HomeChatScreen.tsx
      plan/
        components/
        state/
        api/
      library/
        components/
        api/
        LibraryScreen.tsx
      player/
        components/
        state/
        PlayerScreen.tsx
      paywall/
        components/
        PaywallSheet.tsx
    services/
      apiClient.ts
      entitlement.ts
      audio/
        audioEngine.ts
    ui/
      components/
      tokens/
      typography/
    storage/
      localDb.ts
```

---

## Migration Steps

### Phase 1: Setup Expo Router in New Location

#### Step 1.1: Create Expo Router App Directory
- [ ] Create `apps/mobile-v4/app/` directory (Expo Router entry point)
- [ ] Create `apps/mobile-v4/app/_layout.tsx` (root layout)
- [ ] Create `apps/mobile-v4/app/(tabs)/_layout.tsx` (tabs layout)
- [ ] Create `apps/mobile-v4/app/(tabs)/(home)/_layout.tsx` (home layout)
- [ ] Create `apps/mobile-v4/app/(tabs)/(home)/index.tsx` (route to feature)

**Note:** Expo Router requires the `app/` directory at the project root. For `apps/mobile-v4/`, this means `apps/mobile-v4/app/` will be the Expo Router root.

#### Step 1.2: Update Path Aliases
- [ ] Update `tsconfig.json` to point `@/` to `apps/mobile-v4/src/`
- [ ] Update `babel.config.js` or `metro.config.js` if needed
- [ ] Ensure imports like `@/components/ui/*` resolve correctly

---

### Phase 2: Move Chat Feature

#### Step 2.1: Extract HomeChatScreen
- [ ] Copy `app/(tabs)/(home)/index.tsx` → `apps/mobile-v4/src/features/chat/HomeChatScreen.tsx`
- [ ] Rename component from `HomeScreen` to `HomeChatScreen`
- [ ] Update imports to use new path aliases
- [ ] Extract chat message types to `apps/mobile-v4/src/features/chat/types.ts`

#### Step 2.2: Extract Chat Components
- [ ] Extract `Header` component → `apps/mobile-v4/src/features/chat/components/ChatHeader.tsx`
- [ ] Extract `SuggestionCard` → `apps/mobile-v4/src/features/chat/components/SuggestionCard.tsx`
- [ ] Extract `EmptyState` → `apps/mobile-v4/src/features/chat/components/ChatEmptyState.tsx`
- [ ] Extract `Bubble` → `apps/mobile-v4/src/features/chat/components/ChatBubble.tsx`
- [ ] Extract `Composer` → `apps/mobile-v4/src/features/chat/components/ChatComposer.tsx`

#### Step 2.3: Extract Chat State
- [ ] Move chat messages state to `apps/mobile-v4/src/features/chat/state/useChatState.ts` (or Zustand store)
- [ ] Create `apps/mobile-v4/src/features/chat/state/chatStore.ts` if using global state
- [ ] Extract suggestion constants to `apps/mobile-v4/src/features/chat/constants.ts`

#### Step 2.4: Create Chat API Layer
- [ ] Create `apps/mobile-v4/src/features/chat/api/chatApi.ts` for API calls
- [ ] Create `apps/mobile-v4/src/features/chat/api/useChatTurn.ts` hook (react-query)
- [ ] Wire up to `POST /v4/chat/turn` endpoint

#### Step 2.5: Update Expo Router Route
- [ ] Update `apps/mobile-v4/app/(tabs)/(home)/index.tsx` to import and render `HomeChatScreen`
- [ ] Ensure route works with Expo Router

---

### Phase 3: Setup Navigation Structure

#### Step 3.1: Create Navigation Components
- [ ] Create `apps/mobile-v4/src/app/navigation/TabNavigator.tsx` (if using custom tabs)
- [ ] Create `apps/mobile-v4/src/app/navigation/NavigationHeader.tsx` (shared header)
- [ ] Create `apps/mobile-v4/src/app/navigation/SettingsModal.tsx` (settings sheet)

#### Step 3.2: Add Library Route
- [ ] Create `apps/mobile-v4/app/(tabs)/library/_layout.tsx`
- [ ] Create `apps/mobile-v4/app/(tabs)/library/index.tsx` → routes to `LibraryScreen`

#### Step 3.3: Add Settings Route (Modal)
- [ ] Create `apps/mobile-v4/app/(tabs)/settings.tsx` (modal route)
- [ ] Wire up to header icon in `ChatHeader`

---

### Phase 4: Move Shared UI Components

#### Step 4.1: Identify Shared Components
From the current `index.tsx`, these are imported from `@/components/ui/`:
- [ ] `AvoidKeyboard` → keep in `apps/mobile-v4/src/ui/components/`
- [ ] `Icon` → keep in `apps/mobile-v4/src/ui/components/`
- [ ] `Text` → keep in `apps/mobile-v4/src/ui/components/`
- [ ] `View` → keep in `apps/mobile-v4/src/ui/components/`
- [ ] `useColor` hook → move to `apps/mobile-v4/src/ui/hooks/useColor.ts`

#### Step 4.2: Setup UI Tokens
- [ ] Create `apps/mobile-v4/src/ui/tokens/colors.ts` (color system)
- [ ] Create `apps/mobile-v4/src/ui/tokens/spacing.ts` (spacing system)
- [ ] Create `apps/mobile-v4/src/ui/typography/fonts.ts` (typography)

---

### Phase 5: Setup Services

#### Step 5.1: API Client
- [ ] Create `apps/mobile-v4/src/services/apiClient.ts`
- [ ] Setup base URL, headers, error handling
- [ ] Add interceptors for auth if needed

#### Step 5.2: Entitlements
- [ ] Create `apps/mobile-v4/src/services/entitlement.ts`
- [ ] Integrate RevenueCat
- [ ] Create `useEntitlement()` hook

#### Step 5.3: Audio Engine
- [ ] Create `apps/mobile-v4/src/services/audio/audioEngine.ts`
- [ ] Wrap `packages/audio-engine` functionality
- [ ] Setup audio session management

#### Step 5.4: Storage
- [ ] Create `apps/mobile-v4/src/storage/localDb.ts`
- [ ] Setup local storage for recent plays, draft cache
- [ ] Use AsyncStorage or similar

---

### Phase 6: Update Dependencies & Config

#### Step 6.1: Package Configuration
- [ ] Create `apps/mobile-v4/package.json` (if monorepo)
- [ ] Install dependencies: expo-router, react-query, etc.
- [ ] Update `apps/mobile-v4/app.json` or `expo.json`

#### Step 6.2: TypeScript Configuration
- [ ] Create/update `apps/mobile-v4/tsconfig.json`
- [ ] Setup path aliases: `@/*` → `src/*`
- [ ] Ensure Expo Router types are included

#### Step 6.3: Metro/Babel Configuration
- [ ] Update `apps/mobile-v4/babel.config.js` for path aliases
- [ ] Update `apps/mobile-v4/metro.config.js` if needed

---

### Phase 7: Testing & Validation

#### Step 7.1: Route Testing
- [ ] Verify Expo Router routes work:
  - `/` → HomeChat
  - `/library` → Library
  - `/settings` → Settings modal
- [ ] Test navigation between routes

#### Step 7.2: Feature Testing
- [ ] Test chat flow (empty state → message → response)
- [ ] Test suggestion chips
- [ ] Test composer input
- [ ] Verify UI components render correctly

#### Step 7.3: Import Resolution
- [ ] Verify all `@/` imports resolve correctly
- [ ] Check for circular dependencies
- [ ] Ensure relative imports work

---

### Phase 8: Cleanup

#### Step 8.1: Remove Old Structure
- [ ] **Backup first!** Create a branch or tag
- [ ] Delete `app/` directory at root (after migration verified)
- [ ] Or rename to `app.old/` for safety

#### Step 8.2: Update Documentation
- [ ] Update README with new structure
- [ ] Document path aliases
- [ ] Document navigation structure

---

## File Mapping Reference

| Current Location | New Location | Notes |
|----------------|--------------|-------|
| `app/(tabs)/(home)/index.tsx` | `apps/mobile-v4/src/features/chat/HomeChatScreen.tsx` | Extract components |
| `app/(tabs)/(home)/_layout.tsx` | `apps/mobile-v4/app/(tabs)/(home)/_layout.tsx` | Keep for Expo Router |
| `@/components/ui/*` | `apps/mobile-v4/src/ui/components/*` | Shared UI |
| `@/hooks/useColor` | `apps/mobile-v4/src/ui/hooks/useColor.ts` | UI hook |

---

## Key Decisions

### 1. Expo Router Location
**Decision:** Keep Expo Router in `apps/mobile-v4/app/` (not `src/app/`)
- Expo Router requires `app/` at project root
- `src/app/navigation/` is for navigation components/logic, not routes

### 2. Component Extraction Strategy
**Decision:** Extract all sub-components from `HomeChatScreen.tsx`
- Better testability
- Reusability
- Follows feature-based structure

### 3. State Management
**Decision:** Use React Query for server state, Zustand/Context for client state
- Chat messages: client state (Zustand or useState)
- API calls: React Query hooks
- Entitlements: React Query + cache

### 4. Path Aliases
**Decision:** `@/` → `apps/mobile-v4/src/`
- Consistent with existing code
- Easy to refactor later

---

## Risk Mitigation

### Risk 1: Breaking Expo Router
**Mitigation:**
- Test routes after each phase
- Keep old `app/` directory until fully verified
- Use feature flags if needed

### Risk 2: Import Path Issues
**Mitigation:**
- Update `tsconfig.json` first
- Use find/replace for imports
- Test build after path changes

### Risk 3: Missing Dependencies
**Mitigation:**
- Audit all imports in current file
- Create dependency list before migration
- Install missing packages early

---

## Success Criteria

- [ ] All routes work in Expo Router
- [ ] Chat screen renders and functions correctly
- [ ] All imports resolve without errors
- [ ] No TypeScript errors
- [ ] App builds and runs successfully
- [ ] Old `app/` directory can be safely removed

---

## Next Steps After Migration

1. Implement Library screen
2. Implement Player screen
3. Implement Plan preview components
4. Wire up API endpoints
5. Add state management for chat
6. Implement entitlements logic

---

## Notes

- This migration preserves the existing chat UI while moving to the new structure
- The outline suggests minimal navigation (Chat, Library, Settings), so we're keeping it simple
- All feature code goes in `src/features/`, routes stay in `app/` for Expo Router
- Shared UI stays in `src/ui/`, services in `src/services/`
