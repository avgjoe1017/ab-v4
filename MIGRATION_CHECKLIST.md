# Migration Checklist - Quick Reference

Use this checklist to track progress through the migration.

## Pre-Migration Setup
- [ ] Create backup branch: `git checkout -b backup/pre-migration`
- [ ] Verify current app works: `npm start` or `expo start`
- [ ] Document any custom configurations

## Phase 1: Expo Router Setup
- [ ] Create `apps/mobile-v4/app/_layout.tsx`
- [ ] Create `apps/mobile-v4/app/(tabs)/_layout.tsx`
- [ ] Create `apps/mobile-v4/app/(tabs)/(home)/_layout.tsx`
- [ ] Create `apps/mobile-v4/app/(tabs)/(home)/index.tsx` (placeholder)
- [ ] Test: Route should load (even if empty)

## Phase 2: Move Chat Screen
- [ ] Copy `app/(tabs)/(home)/index.tsx` content
- [ ] Create `apps/mobile-v4/src/features/chat/HomeChatScreen.tsx`
- [ ] Rename `HomeScreen` → `HomeChatScreen`
- [ ] Update route to import `HomeChatScreen`
- [ ] Test: Chat screen should render

## Phase 3: Extract Components
- [ ] Extract `Header` → `features/chat/components/ChatHeader.tsx`
- [ ] Extract `SuggestionCard` → `features/chat/components/SuggestionCard.tsx`
- [ ] Extract `EmptyState` → `features/chat/components/ChatEmptyState.tsx`
- [ ] Extract `Bubble` → `features/chat/components/ChatBubble.tsx`
- [ ] Extract `Composer` → `features/chat/components/ChatComposer.tsx`
- [ ] Update `HomeChatScreen.tsx` to use extracted components
- [ ] Test: All components render correctly

## Phase 4: Extract Types & Constants
- [ ] Create `features/chat/types.ts` (ChatRole, ChatMessage)
- [ ] Create `features/chat/constants.ts` (SUGGESTIONS)
- [ ] Update imports in components
- [ ] Test: No TypeScript errors

## Phase 5: Setup Path Aliases
- [ ] Update `apps/mobile-v4/tsconfig.json` (add `@/*` → `src/*`)
- [ ] Update `apps/mobile-v4/babel.config.js` (if needed)
- [ ] Update all `@/components/ui/*` imports
- [ ] Test: All imports resolve

## Phase 6: Move UI Components
- [ ] Verify `@/components/ui/*` location
- [ ] Move or create in `src/ui/components/`
- [ ] Move `useColor` hook to `src/ui/hooks/useColor.ts`
- [ ] Update imports
- [ ] Test: UI components work

## Phase 7: Create Service Stubs
- [ ] Create `services/apiClient.ts` (stub)
- [ ] Create `services/entitlement.ts` (stub)
- [ ] Create `services/audio/audioEngine.ts` (stub)
- [ ] Create `storage/localDb.ts` (stub)

## Phase 8: Add Library Route
- [ ] Create `app/(tabs)/library/_layout.tsx`
- [ ] Create `app/(tabs)/library/index.tsx`
- [ ] Import `LibraryScreen` from features
- [ ] Test: Library route works

## Phase 9: Final Testing
- [ ] Test all routes navigate correctly
- [ ] Test chat functionality
- [ ] Verify no TypeScript errors
- [ ] Verify no runtime errors
- [ ] Test build: `npm run build` or `expo build`

## Phase 10: Cleanup
- [ ] Verify new structure works completely
- [ ] Rename `app/` → `app.old/` (keep as backup)
- [ ] Update any documentation
- [ ] Commit changes

---

## Quick Commands

```bash
# Test Expo Router
cd apps/mobile-v4
npx expo start

# Check TypeScript
npx tsc --noEmit

# Find all imports to update
grep -r "@/components" apps/mobile-v4/src
```

---

## Common Issues & Fixes

**Issue:** Expo Router not finding routes
- **Fix:** Ensure `app/` is at `apps/mobile-v4/app/` (not `src/app/`)

**Issue:** Path alias `@/` not resolving
- **Fix:** Check `tsconfig.json` paths and `babel.config.js` plugins

**Issue:** Components not found
- **Fix:** Verify file paths match imports exactly (case-sensitive)

**Issue:** TypeScript errors after move
- **Fix:** Restart TypeScript server, check `tsconfig.json` includes
