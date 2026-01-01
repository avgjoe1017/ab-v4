# Beginner Affirmations Sessions Setup

This document describes how to seed and generate audio for the four beginner affirmation sessions.

## Overview

The four beginner sessions are:
1. **EASE IN (NO-PRESSURE AFFIRMATIONS)** - Goal: beginner
2. **CALM DOWN FAST (BODY-FIRST RESET)** - Goal: anxiety
3. **HARD DAY, STRONG ME (RESILIENCE UNDER PRESSURE)** - Goal: resilience
4. **DO THE NEXT RIGHT THING (MOMENTUM + FOLLOW-THROUGH)** - Goal: productivity

## Prerequisites

1. **ElevenLabs API Key**: Set in `apps/api/.env`:
   ```
   TTS_PROVIDER=elevenlabs
   ELEVENLABS_API_KEY=your-api-key-here
   ```

2. **Database**: Ensure database is set up and migrations are run

## Steps

### 1. Seed Sessions to Database

Run the seed script to add the sessions to the database:

```bash
cd apps/api
pnpm prisma db seed
```

This will:
- Pre-generate silence chunks (V3 compliance)
- Create the four beginner sessions in the database
- Skip if sessions already exist

### 2. Generate Audio via ElevenLabs

Run the audio generation script:

```bash
cd apps/api
pnpm generate:beginner
```

This will:
- Check each beginner session
- Generate audio using ElevenLabs TTS for all affirmations
- Process through the full audio pipeline (stitching, loudness normalization, voice activity detection)
- Store the final merged audio assets

**Note**: This process can take several minutes as it:
- Generates TTS for each affirmation (variant 1 and 2)
- Stitches all chunks together
- Normalizes loudness to -20 LUFS
- Detects voice activity segments
- Adds loop padding

### 3. Verify on Home Screen

The home screen will automatically display the beginner sessions in the "Beginner Affirmations" section once they're in the database and have audio generated.

## Session Details

### EASE IN (NO-PRESSURE AFFIRMATIONS)
- **ID**: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Voice**: shimmer (gentle, supportive)
- **Goal Tag**: beginner
- **Affirmations**: ~40 (opener + beginner_ramp + core + closing)

### CALM DOWN FAST (BODY-FIRST RESET)
- **ID**: `b2c3d4e5-f6a7-8901-bcde-f12345678901`
- **Voice**: alloy (calm, steady)
- **Goal Tag**: anxiety
- **Affirmations**: ~36

### HARD DAY, STRONG ME (RESILIENCE UNDER PRESSURE)
- **ID**: `c3d4e5f6-a7b8-9012-cdef-123456789012`
- **Voice**: onyx (strong, confident)
- **Goal Tag**: resilience
- **Affirmations**: ~34

### DO THE NEXT RIGHT THING (MOMENTUM + FOLLOW-THROUGH)
- **ID**: `d4e5f6a7-b8c9-0123-defa-234567890123`
- **Voice**: alloy (clear, motivating)
- **Goal Tag**: productivity
- **Affirmations**: ~32

## Troubleshooting

### Sessions not appearing on home screen
- Check that sessions were seeded: `SELECT * FROM Session WHERE title LIKE '%EASE%' OR title LIKE '%CALM%';`
- Verify sessions have audio: `SELECT s.title, sa.sessionId FROM Session s LEFT JOIN SessionAudio sa ON s.id = sa.sessionId WHERE s.title LIKE '%EASE%';`

### Audio generation fails
- Verify `ELEVENLABS_API_KEY` is set correctly
- Check API key has sufficient credits
- Review server logs for specific error messages

### Audio generation is slow
- This is expected - each session has 30-40 affirmations
- Each affirmation generates 2 variants (neutral + variation)
- Total: ~60-80 TTS API calls per session
- Estimated time: 5-10 minutes per session depending on API rate limits
