# UI Components Overview

**Date**: January 2025  
**Purpose**: Comprehensive documentation of all UI components in the Affirmation Beats V3 mobile app

---

## Component Architecture

All UI components are located in `apps/mobile/src/components/` and exported through a central `index.ts` file for easy importing. Components follow a consistent design system based on theme tokens.

### Component Location
```
apps/mobile/src/components/
├── index.ts                    # Central export file
├── AppScreen.tsx               # Screen wrapper component
├── PrimaryButton.tsx           # Primary action button
├── IconButton.tsx              # Icon-only button
├── SessionTile.tsx             # Session card component
├── SectionHeader.tsx           # Section header with optional action
├── MiniPlayer.tsx              # Global mini player
├── BottomTabs.tsx              # Bottom navigation tabs
├── BottomSheet.tsx             # Modal bottom sheet
├── PlayerMenu.tsx              # Player screen menu
├── SaveMixPresetSheet.tsx      # Mix preset save sheet
├── Chip.tsx                    # Tag/chip component
├── Card.tsx                    # Generic card component
├── ScienceCard.tsx             # Educational science content card
├── PrimerAnimation.tsx         # Breathing animation for audio loading
├── AudioDebugger.tsx           # Debug component (dev only)
└── TestDataHelper.tsx          # Test data helper (dev only)
```

---

## Core Components

### 1. AppScreen
**Purpose**: Standard screen wrapper with safe area and background gradient

**Props**:
- `children`: React.ReactNode
- `style?`: ViewStyle
- `gradient?`: boolean (default: true)
- `backgroundColor?`: string

**Features**:
- Safe area handling (top, left, right edges)
- Optional gradient background or solid color
- Consistent layout across all screens

**Usage**:
```tsx
<AppScreen>
  {/* Screen content */}
</AppScreen>
```

---

### 2. PrimaryButton
**Purpose**: Primary action button with consistent styling and accessibility

**Props**:
- `label`: string
- `onPress`: () => void
- `icon?`: MaterialIcons icon name
- `iconPosition?`: "left" | "right" (default: "left")
- `disabled?`: boolean (default: false)
- `variant?`: "primary" | "gradient" | "highlight" (default: "gradient")
- `size?`: "sm" | "md" | "lg" (default: "md")
- `style?`: ViewStyle

**Features**:
- Minimum 44px height for accessibility
- Three variants: gradient (default), primary, highlight
- Three sizes: sm (44px), md (56px), lg (64px)
- Optional icon support (left or right)
- Press and disabled states

**Usage**:
```tsx
<PrimaryButton
  label="Start Session"
  onPress={handleStart}
  icon="play-arrow"
  variant="gradient"
  size="md"
/>
```

---

### 3. IconButton
**Purpose**: Icon-only button with consistent styling

**Props**:
- `icon`: MaterialIcons icon name
- `onPress`: () => void
- `size?`: number (default: 24)
- `color?`: string
- `variant?`: "default" | "filled" | "subtle" (default: "default")
- `disabled?`: boolean (default: false)
- `style?`: ViewStyle
- `accessibilityLabel?`: string

**Features**:
- Minimum 44px touch target for accessibility
- Three variants: default, filled (with background), subtle (semi-transparent)
- Automatic size calculation to meet accessibility requirements

**Usage**:
```tsx
<IconButton
  icon="menu"
  onPress={handleMenu}
  variant="filled"
  accessibilityLabel="Open menu"
/>
```

---

### 4. SessionTile
**Purpose**: Standard session card component for displaying sessions

**Props**:
- `sessionId`: string (required)
- `id?`: string (fallback)
- `title`: string
- `goalTag?`: string
- `onPress`: () => void
- `onToggleSaved?`: () => void
- `isSaved?`: boolean
- `variant?`: "default" | "compact" | "large" (default: "default")
- `style?`: ViewStyle
- `icon?`: MaterialIcons icon name

**Features**:
- Three size variants: default (140px), compact (120px), large (180px)
- Automatic icon selection based on goalTag
- Session art image support
- Bookmark/save functionality
- Play overlay indicator
- Gradient overlay for text visibility

**Usage**:
```tsx
<SessionTile
  sessionId="session-123"
  title="Morning Focus"
  goalTag="focus"
  onPress={() => navigateToSession("session-123")}
  onToggleSaved={handleToggleSaved}
  isSaved={false}
  variant="default"
/>
```

---

### 5. SectionHeader
**Purpose**: Standard section header with optional action button

**Props**:
- `title`: string
- `actionLabel?`: string
- `onActionPress?`: () => void
- `style?`: ViewStyle

**Features**:
- Consistent typography (sectionHeading style)
- Optional right-aligned action button
- Proper spacing and padding

**Usage**:
```tsx
<SectionHeader
  title="Browse by Goal"
  actionLabel="See All"
  onActionPress={handleSeeAll}
/>
```

---

### 6. MiniPlayer
**Purpose**: Global mini player component that appears when a session is active

**Props**:
- `onPress?`: () => void (navigates to full player)
- `sessionId?`: string | null

**Features**:
- Auto-hides when no active session
- Displays session title and art
- Play/pause controls
- Audio visualizer animation
- Positioned above bottom navigation (85px from bottom)
- Fetches session data automatically

**Usage**:
```tsx
<MiniPlayer
  onPress={() => navigation.navigate("Player", { sessionId })}
  sessionId={activeSessionId}
/>
```

---

### 7. BottomTabs
**Purpose**: Global bottom navigation component

**Props**:
- `activeRoute`: TabRoute ("Today" | "Explore" | "Programs" | "Library")
- `onNavigate`: (route: TabRoute) => void
- `showBadge?`: boolean (default: false)

**Features**:
- Four main navigation tabs
- Active state highlighting
- Optional badge indicator
- Fixed position at bottom of screen
- Consistent icon and label styling

**Usage**:
```tsx
<BottomTabs
  activeRoute="Today"
  onNavigate={(route) => navigation.navigate(route)}
  showBadge={hasNewContent}
/>
```

---

### 8. BottomSheet
**Purpose**: Modal bottom sheet component with slide-up animation

**Props**:
- `visible`: boolean
- `onClose`: () => void
- `children`: React.ReactNode
- `height?`: number | string (default: "50%")
- `snapPoints?`: number[] (for future snapping behavior)

**Features**:
- Smooth slide-up/down animations
- Backdrop with tap-to-dismiss
- Configurable height (pixels or percentage)
- Handle indicator for visual affordance
- Platform-specific shadows

**Usage**:
```tsx
<BottomSheet
  visible={isOpen}
  onClose={() => setIsOpen(false)}
  height={400}
>
  {/* Sheet content */}
</BottomSheet>
```

---

### 9. PlayerMenu
**Purpose**: Menu for Player screen actions (sleep timer, restart, end session)

**Props**:
- `visible`: boolean
- `onClose`: () => void
- `sleepTimerDuration`: SleepTimerDuration (number | null)
- `onSetSleepTimer`: (duration: SleepTimerDuration) => void
- `onRestart`: () => void
- `onEndSession`: () => void
- `onSOS?`: () => void
- `onSaveMix?`: () => void

**Features**:
- Sleep timer options (5, 10, 15, 30, 60 minutes, Off)
- Session actions (restart, end)
- Optional SOS quick help
- Optional save mix preset
- Uses BottomSheet component internally

**Usage**:
```tsx
<PlayerMenu
  visible={menuOpen}
  onClose={() => setMenuOpen(false)}
  sleepTimerDuration={sleepTimer}
  onSetSleepTimer={setSleepTimer}
  onRestart={handleRestart}
  onEndSession={handleEndSession}
  onSOS={handleSOS}
  onSaveMix={handleSaveMix}
/>
```

---

### 10. SaveMixPresetSheet
**Purpose**: Bottom sheet for naming and saving a mix preset

**Props**:
- `visible`: boolean
- `onClose`: () => void
- `onSave`: (name: string) => void

**Features**:
- Text input for preset name
- Auto-focus on open
- Submit on Enter key
- Cancel and Save actions
- Uses BottomSheet component internally

**Usage**:
```tsx
<SaveMixPresetSheet
  visible={saveSheetOpen}
  onClose={() => setSaveSheetOpen(false)}
  onSave={(name) => savePreset(name)}
/>
```

---

### 11. Chip
**Purpose**: Tag/chip component for filters and labels

**Props**:
- `label`: string
- `onPress?`: () => void (makes it pressable)
- `active?`: boolean (default: false)
- `variant?`: "default" | "primary" (default: "default")
- `style?`: ViewStyle
- `textStyle?`: TextStyle

**Features**:
- Two variants: default (outlined), primary (filled)
- Active state styling
- Can be pressable or static
- Consistent border radius (pill shape)

**Usage**:
```tsx
<Chip
  label="Focus"
  onPress={() => setFilter("focus")}
  active={filter === "focus"}
  variant="default"
/>
```

---

### 12. Card
**Purpose**: Generic card component with consistent styling

**Props**:
- `children`: React.ReactNode
- `style?`: ViewStyle | ViewStyle[]
- `variant?`: "default" | "elevated" | "surface" (default: "default")
- `onPress?`: () => void (makes it pressable)
- All PressableProps (when onPress is provided)

**Features**:
- Three variants: default, elevated (with shadow), surface (secondary background)
- Can be pressable or static
- Consistent padding and border radius
- Press state handling

**Usage**:
```tsx
<Card variant="elevated" onPress={handlePress}>
  <Text>Card content</Text>
</Card>
```

---

### 13. ScienceCard
**Purpose**: Educational science content card about binaural beats, affirmations, etc.

**Props**:
- `data`: ScienceCardData
  - `id`: string
  - `title`: string
  - `content`: string
  - `category`: string
  - `icon?`: string
- `variant?`: "default" | "compact" (default: "default")
- `style?`: ViewStyle
- `showIcon?`: boolean (default: true)

**Features**:
- Icon container with accent background
- Title and content text
- Compact variant for smaller spaces
- Uses Card component internally

**Usage**:
```tsx
<ScienceCard
  data={{
    id: "1",
    title: "Why Alpha Waves Work",
    content: "Alpha waves (8-12 Hz) are associated with relaxed awareness...",
    category: "science",
    icon: "science"
  }}
  variant="default"
/>
```

---

### 14. PrimerAnimation
**Purpose**: Breathing animation displayed during audio preparation (20-30 seconds)

**Props**:
- `onComplete`: () => void
- `duration?`: number (milliseconds, default: 25000)
- `skippable?`: boolean (default: true)
- `onSkip?`: () => void

**Features**:
- Breathing cycle animation (scale and opacity pulse)
- 4-second inhale, 5-second exhale cycles
- Fade out on completion
- Full-screen overlay
- Masks audio buffering time

**Usage**:
```tsx
<PrimerAnimation
  onComplete={() => setShowPrimer(false)}
  duration={25000}
  skippable={true}
  onSkip={() => setShowPrimer(false)}
/>
```

---

## Design System

### Theme Tokens
All components use the centralized theme system located in `apps/mobile/src/theme/tokens.ts`.

**Key Design Principles**:
- Dark theme with indigo/purple accents
- Inter font family (neutral, confident, adult)
- 4px spacing base unit
- Minimum 44px tap targets for accessibility
- Consistent border radius scale
- Platform-specific shadows (iOS/Android)

**Color Palette**:
- **Backgrounds**: Dark slate (#0f172a), Dark indigo (#1e1b4b)
- **Text**: White primary, light purple secondary/tertiary
- **Accents**: Indigo (#6366f1), Purple (#8b5cf6), Yellow highlight (#FDE047)
- **Semantic**: Success (green), Warning (amber), Error (red), Info (blue)

**Typography System**:
The app uses a bespoke typography system with 8 distinct styles:
1. **Affirmation Title** (28px, semibold) - Signature moment, used sparingly
2. **Section Heading** (20px, medium) - Structural headings
3. **Card Title** (17px, medium) - Program/session cards
4. **Body** (15px, regular) - Primary reading text
5. **Metadata** (13px, regular) - Supporting information
6. **Label** (12px, medium) - Pills, tags, filters
7. **Button** (15px, medium) - Action buttons
8. **Caption** (12px, regular) - Footnotes, educational asides

**Spacing Scale** (4px base):
- 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px

**Border Radius**:
- sm: 6px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, full: 9999px (pill)

---

## Component Usage Patterns

### Import Pattern
All components are imported from the central components index:
```tsx
import { AppScreen, PrimaryButton, SessionTile, SectionHeader } from "../components";
```

### Theme Usage
Theme tokens are imported and used directly:
```tsx
import { theme } from "../theme";

// In styles
backgroundColor: theme.colors.background.surface
padding: theme.spacing[6]
borderRadius: theme.radius.lg
```

### Common Patterns

1. **Screen Structure**:
```tsx
<AppScreen>
  <ScrollView>
    <SectionHeader title="Section" />
    <View style={styles.content}>
      {/* Content */}
    </View>
  </ScrollView>
  <MiniPlayer />
  <BottomTabs />
</AppScreen>
```

2. **Button Actions**:
```tsx
<PrimaryButton
  label="Action"
  onPress={handleAction}
  icon="arrow-forward"
  variant="gradient"
/>
```

3. **Session Lists**:
```tsx
<ScrollView horizontal>
  {sessions.map(session => (
    <SessionTile
      key={session.id}
      sessionId={session.id}
      title={session.title}
      goalTag={session.goalTag}
      onPress={() => handlePress(session.id)}
    />
  ))}
</ScrollView>
```

---

## Accessibility Features

All components follow accessibility best practices:

- **Minimum Tap Targets**: 44px minimum height/width for all interactive elements
- **Accessibility Labels**: IconButton and other icon-only components include accessibility labels
- **Color Contrast**: Text colors meet WCAG contrast requirements
- **Touch Feedback**: All pressable components have visual feedback (opacity changes)
- **Disabled States**: Clear visual indication of disabled state

---

## Notes

- **AudioDebugger** and **TestDataHelper** are development-only components
- Components use MaterialIcons from `@expo/vector-icons`
- All components are TypeScript with proper type definitions
- Components follow React Native best practices (StyleSheet, Pressable, etc.)
- Linear gradients use `expo-linear-gradient` package

