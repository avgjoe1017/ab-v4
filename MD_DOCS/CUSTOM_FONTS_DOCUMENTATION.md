# Custom Fonts Documentation

**Date:** 2025-01-27  
**Status:** Documented - Not Implemented

## Overview

The design inspiration files reference custom fonts (Spline Sans, Noto Sans, Lora, Nunito) that are not currently implemented in the React Native app. This document explains the current approach and provides guidance for future font implementation.

## Current Implementation

The app currently uses **system fonts** (platform default fonts):
- iOS: San Francisco
- Android: Roboto

This is defined in `apps/mobile/src/theme/tokens.ts`:
```typescript
fontFamily: {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
}
```

## Design Inspiration Fonts

The design inspiration files (`DESIGN_INSPO/`) reference these fonts:

### 1. **Spline Sans** (Display Font)
- **Usage**: Primary display text, headings
- **Weights**: 300, 400, 500, 600, 700
- **Source**: Google Fonts
- **Design Inspiration**: Used in homepage and explore screens

### 2. **Noto Sans** (Body Font)
- **Usage**: Body text, UI elements
- **Weights**: 400, 500, 700
- **Source**: Google Fonts
- **Design Inspiration**: Used in homepage and explore screens

### 3. **Lora** (Serif Font)
- **Usage**: Hero question text, italic quotes
- **Weights**: 400, 500 (italic)
- **Source**: Google Fonts
- **Design Inspiration**: Used for "What do you need to hear today?" (italic)
- **Current Workaround**: Using `fontStyle: "italic"` with system font

### 4. **Nunito** (Rounded Font)
- **Usage**: Player screen
- **Weights**: 400, 600, 700, 800
- **Source**: Google Fonts
- **Design Inspiration**: Used in player screen for friendly, rounded appearance

## Why System Fonts Are Currently Used

1. **Performance**: System fonts load instantly, no download time
2. **Bundle Size**: Custom fonts add to app bundle size
3. **Platform Consistency**: System fonts match platform conventions
4. **Accessibility**: System fonts respect user accessibility settings
5. **Simplicity**: No font loading logic needed

## Current Typography Approach

The app uses a **typography scale** with system fonts:
- Font sizes are carefully defined (xs: 10px → 4xl: 32px)
- Font weights use system font weights (400, 500, 600, 700)
- Letter spacing and line heights are tuned for readability
- Italic styling is applied where needed (hero question)

## Future Implementation (If Needed)

If custom fonts are desired, here's the implementation path:

### Step 1: Install Fonts

1. Download font files from Google Fonts:
   - Spline Sans (Regular, Medium, SemiBold, Bold)
   - Noto Sans (Regular, Medium, Bold)
   - Lora (Regular, Medium - Italic)
   - Nunito (Regular, SemiBold, Bold, ExtraBold)

2. Add fonts to `apps/mobile/assets/fonts/`

### Step 2: Configure Expo

Update `app.json`:
```json
{
  "expo": {
    "fonts": [
      "./assets/fonts/SplineSans-Regular.ttf",
      "./assets/fonts/SplineSans-Medium.ttf",
      "./assets/fonts/SplineSans-SemiBold.ttf",
      "./assets/fonts/SplineSans-Bold.ttf",
      "./assets/fonts/NotoSans-Regular.ttf",
      "./assets/fonts/NotoSans-Medium.ttf",
      "./assets/fonts/NotoSans-Bold.ttf",
      "./assets/fonts/Lora-Regular.ttf",
      "./assets/fonts/Lora-Medium.ttf",
      "./assets/fonts/Lora-Italic.ttf",
      "./assets/fonts/Lora-MediumItalic.ttf",
      "./assets/fonts/Nunito-Regular.ttf",
      "./assets/fonts/Nunito-SemiBold.ttf",
      "./assets/fonts/Nunito-Bold.ttf",
      "./assets/fonts/Nunito-ExtraBold.ttf"
    ]
  }
}
```

### Step 3: Update Theme Tokens

Update `apps/mobile/src/theme/tokens.ts`:
```typescript
fontFamily: {
  display: "SplineSans-Regular",      // Spline Sans for headings
  body: "NotoSans-Regular",            // Noto Sans for body text
  serif: "Lora-Regular",               // Lora for hero text
  player: "Nunito-Regular",            // Nunito for player screen
  // ... weight variants
}
```

### Step 4: Use Fonts in Components

Update text styles to use custom fonts:
```typescript
heroQuestion: {
  fontFamily: theme.typography.fontFamily.serif,
  fontStyle: "italic",
  // ...
}
```

## Recommendation

**Current Status**: System fonts are sufficient and provide good performance.

**Consider Custom Fonts If**:
- Brand identity requires specific typography
- Design team insists on exact font matching
- App has reached production and typography polish is a priority

**Keep System Fonts If**:
- Performance and bundle size are priorities
- Platform consistency is valued
- Current typography scale works well

## Notes

- The hero question currently uses `fontStyle: "italic"` with system font as a workaround
- All other typography uses system fonts with careful sizing and spacing
- The design system is flexible enough to accommodate custom fonts if needed later

