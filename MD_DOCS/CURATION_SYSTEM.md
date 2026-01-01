# FOR YOU Curation System

## Overview

The FOR YOU curation system replaces "Recent Intentions" with an intelligent, personalized recommendation engine that understands user behavior and provides the right sessions at the right time.

## Key Principles

1. **Feels intelligent without being creepy** - Uses behavioral signals, not sensitive data
2. **Reduces decisions while maintaining control** - Fixed 4-6 card slots, no scrolling lists
3. **Progression over history** - NEXT STEP card shows path advancement, not just "recently played"
4. **Transparency builds trust** - "Why this?" affordance on every card

## Card Slots

### 1. NEXT STEP (Slot #1, always top)
- Shows progression through an active transformation path
- Displays chapter number (e.g., "Chapter 2 of 6")
- Includes next micro-action in footer
- Only appears if user has an active path

### 2. RIGHT NOW (Slots #2-3, 2 cards)
- Time-of-day aware (morning = Focus, evening = Sleep)
- Based on completion patterns
- Shorter sessions if user has low completion rate

### 3. TONIGHT (Slot #4)
- Only shown if current time is evening (6 PM - 6 AM)
- Designed for wind-down
- Uses delta brainwave state

### 4. YOUR BEST (Slot #5)
- Highest completion rate session
- Uses user's most successful "recipe" (voice, brain, atmosphere combo)

### 5. TRY SOMETHING NEW (Slot #6)
- Controlled novelty injection
- Different from user's usual patterns
- Prevents repetition fatigue

## Curation Logic

### Signals Used (No Sensitive Data)
- Session starts, completions, abandon times
- Replays
- Mix adjustments (what user turns up/down)
- Time of day and day of week
- Duration patterns (what they actually finish)
- Skip behavior during affirmations

### Ranking Rules
1. **Heavily boost** what user finishes
2. **Downrank** what they abandon in first 90 seconds
3. **Cap repetition**: No same "recipe" more than 2 days in a row
4. **Inject novelty**: 1 out of 5 cards is "try new"

### Output Per Card
A "recipe" object containing:
- Duration (in seconds)
- Voice cadence preset
- Brain layer choice (binaural/solfeggio)
- Atmosphere choice
- Affirmation style preset (gentle, bridge, bold)

## Progressive Profiling: Tune Your For You

Instead of a big profile form, users answer 3 quick questions:

1. **Primary goal right now**: Calm, Focus, Sleep, Confidence, Reset
2. **Voice preference**: More space, Balanced, More guidance
3. **Sound preference**: Voice-forward, Balanced, Atmosphere-forward

**UX Pattern**:
- Small inline module under FOR YOU section
- One-screen tap flow
- Shows "Curation improved" after completion
- Never nags again
- "Refine" option available in settings

## Path/Chapter System

### Structure
Each path is a 6-chapter transformation arc:

1. **SETTLE THE ALARM** - Reduce threat response
2. **COLLECT RECEIPTS** - Anchor identity to evidence
3. **DEFINE 'GOOD' TODAY** - Stop vague standards
4. **ONE SENTENCE OF AUTHORITY** - Practice boundary/assertion
5. **VISIBLE WIN** - Share progress without cringe
6. **INTEGRATE IDENTITY** - Make competence feel normal

### Advancement Rules
- Session completed + action done → advance 1 step
- Session completed + action not done → repeat step with smaller action
- User abandons in first 90 seconds → step becomes shorter version (2-3 min)
- User returns after 3+ day gap → re-entry step (short reset) then resume

### Example Path: "Imposter to Impact"
- Path ID: `imposter_to_impact`
- 6 chapters with specific objectives
- Each chapter has a micro-action (60 seconds max)
- Progress tracked in `UserPath` model

## API Endpoints

### GET /me/curation
Returns array of `CurationCard` objects (4-6 cards max).

### POST /me/curation/preferences
Saves user preferences:
```json
{
  "primaryGoal": "Focus",
  "voicePreference": "Balanced",
  "soundPreference": "Voice-forward"
}
```

### GET /me/curation/preferences
Returns current user preferences.

### POST /sessions/:id/events
Tracks session events:
```json
{
  "eventType": "start" | "complete" | "abandon" | "replay" | "skip_affirmation" | "mix_adjust",
  "metadata": {
    "abandonTimeSec": 45,
    "mixAdjustments": { "voice": 0.8, "brain": 0.6 }
  }
}
```

## Database Schema

### SessionEvent
Tracks all user interactions with sessions:
- `eventType`: start, complete, abandon, replay, skip_affirmation, mix_adjust
- `metadata`: JSON string with event-specific data
- Indexed by userId, sessionId, eventType, occurredAt

### CurationPreferences
Stores user's 3-question preferences:
- `primaryGoal`: Calm, Focus, Sleep, Confidence, Reset
- `voicePreference`: More space, Balanced, More guidance
- `soundPreference`: Voice-forward, Balanced, Atmosphere-forward

### UserPath
Tracks active transformation paths:
- `pathId`: e.g., "imposter_to_impact"
- `stepIndex`: Current chapter (0-based)
- `totalSteps`: Total chapters in path
- `lastCompletedAt`: When last step was completed
- `lastActionDone`: Whether micro-action was completed
- `selfRating`: Optional 1-5 rating

## Card Title Examples

**Human, felt titles** (not technical):
- "Steady after a rough moment"
- "Quiet focus"
- "Downshift"
- "Soft reset"
- "Confidence without force"

**Avoid**:
- "10Hz Alpha Session"
- "Binaural Beat Meditation"
- Technical frequency labels in titles

Put Hz/brainwave info behind subtle "Info" tap if needed.

## Trust Features

### "Why this?" Affordance
Every card has a small "Why this?" link that opens a one-line explanation:
- "You finish 10-minute sessions most."
- "You usually lower the voice. This starts balanced."
- "You've replayed downshift sessions in the evening."

**One sentence. No data dump.**

### Reset Personalization
In Settings (future):
- "Reset personalization" option
- Clears all preferences and event history
- Starts fresh with default recommendations

## Implementation Status

✅ Database schema created
✅ API endpoints implemented
✅ Curation logic service created
✅ FOR YOU section component built
✅ TuneForYou progressive profiling component
✅ "Why this?" affordance on cards
✅ HomeScreen integration complete
✅ Session event tracking endpoint ready

### Next Steps
1. Integrate event tracking into PlayerScreen
2. Create path management API endpoints
3. Track mix adjustments in real-time
4. Implement micro-action completion system
5. Add "Reset personalization" to Settings

## Design Decisions

1. **Fixed 4-6 cards**: Prevents decision overload, ensures quality
2. **No scrolling lists**: Forces curation to be selective
3. **Human titles**: Makes recommendations feel personal, not algorithmic
4. **Progressive profiling**: 3 questions is the sweet spot
5. **Path system**: Makes app feel like a program, not a library
6. **One-line explanations**: Builds trust without overwhelming

