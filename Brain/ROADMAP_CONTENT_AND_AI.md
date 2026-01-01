# Entrain: Content & AI Integration Roadmap

**Created**: December 2024  
**Status**: Planning  
**Goal**: Transform Entrain from working plumbing into a complete, differentiated meditation app

---

## The Problem

The V3 architecture is solid. The audio pipeline works. But a user opening Entrain today gets an empty experience — no personalized content, no AI-generated affirmations, no voice, no science education. This roadmap addresses that.

---

## Phase 1: Core AI Pipeline (Week 1-2)

**Goal**: End-to-end flow from user input → personalized affirmations → spoken audio

### 1.1 OpenAI Affirmation Generation

**What**: Integrate OpenAI API to generate values-based affirmations

**Implementation**:
```
apps/api/src/services/affirmation-generator.ts
```

**Core Logic**:
- Input: User's selected values (from onboarding), session type (Focus, Sleep, etc.), duration
- Output: 3-6 core affirmations (per your research — repetition > variety)
- Prompt engineering considerations:
  - First-person statements ("I am..." not "You are...")
  - Values-connected (not generic positivity)
  - Present tense, believable stretch (not delusional)
  - Appropriate for user's self-esteem level (avoid backfire effect)

**Example Prompt Structure**:
```
Generate {count} affirmations for a {session_type} session.

User's core values: {values}
User's current struggle: {struggle} (optional)
Session duration: {duration} minutes

Requirements:
- First-person, present tense
- Connected to at least one stated value
- Believable stretch, not fantasy
- No generic positivity ("I am amazing")
- Each affirmation 8-15 words
```

**API Endpoint**:
```
POST /api/affirmations/generate
Body: { values: string[], sessionType: string, duration: number }
Response: { affirmations: string[], reasoning?: string }
```

**Database**: Store generated affirmations in `Affirmation` table linked to session

---

### 1.2 ElevenLabs TTS Integration

**What**: Convert affirmation text to natural spoken audio

**Implementation**:
```
apps/api/src/services/tts-service.ts
```

**Configuration**:
- Voice selection: Calm, warm, gender-neutral options
- Model: `eleven_multilingual_v2` (or `eleven_turbo_v2` for speed)
- Output format: MP3, 128kbps, 44.1kHz (matches your AUDIO_PROFILE_V3)
- Stability: ~0.5 (some variation, not robotic)
- Similarity boost: ~0.75

**Core Function**:
```typescript
async function generateAffirmationAudio(
  affirmation: string,
  voiceId: string
): Promise<Buffer> {
  // Call ElevenLabs API
  // Return MP3 buffer
}
```

**Caching Strategy**:
- Hash affirmation text + voice ID → check if audio exists
- Store in `/audio-cache/{hash}.mp3`
- Prevents re-generating identical affirmations

**Silence Gaps**:
- Insert 4-6 second silence between affirmations (per research)
- Use existing FFmpeg silence generation

---

### 1.3 Stitching Pipeline Update

**What**: Update existing audio stitching to use real TTS output

**Current Flow** (broken):
```
Placeholder audio → Silence → Concat → Output
```

**New Flow**:
```
OpenAI generates text → ElevenLabs generates audio per affirmation → 
Add silence gaps → Concat all → Mix with binaural → Output
```

**Update `ensure-audio` Job**:
1. Check if session has generated affirmations (text)
2. If not, call OpenAI to generate
3. For each affirmation, check TTS cache
4. Generate missing TTS audio via ElevenLabs
5. Stitch with silence gaps
6. Store final audio bundle URL

---

## Phase 2: Values Onboarding (Week 2-3)

**Goal**: Capture user values to power personalization

### 2.1 Values Assessment Flow

**What**: First-run onboarding that identifies 3-5 core values

**Screen Flow**:
```
Welcome → Why Values Matter (education) → Value Selection → Value Ranking → Complete
```

**Value Categories** (research-backed):
- Achievement & Success
- Connection & Relationships  
- Health & Vitality
- Creativity & Expression
- Peace & Balance
- Growth & Learning
- Freedom & Independence
- Purpose & Contribution
- Security & Stability
- Adventure & Excitement

**UI Pattern**:
- Show ~15-20 value words
- User selects top 5-7
- Then ranks top 3
- Optional: Add custom value

**Implementation**:
```
apps/mobile/src/screens/onboarding/
  ├── WelcomeScreen.tsx
  ├── ValuesEducationScreen.tsx
  ├── ValueSelectionScreen.tsx
  ├── ValueRankingScreen.tsx
  └── OnboardingCompleteScreen.tsx
```

**Storage**:
- Store in user profile (API + local)
- Schema: `UserValues` table with `userId`, `valueId`, `rank`, `createdAt`

---

### 2.2 Optional Struggle/Goal Input

**What**: Let users specify what they're working on (optional, increases personalization)

**Examples**:
- "I'm dealing with imposter syndrome at work"
- "I want to be more present with my family"
- "I'm training for a marathon"

**Implementation**:
- Text input during onboarding (skippable)
- Can update in Settings
- Passed to OpenAI for more targeted affirmations

---

### 2.3 Re-assessment Flow

**What**: Let users update values over time

**Trigger Points**:
- Settings → "Update My Values"
- After 30 days, gentle prompt
- After major life event (user-initiated)

---

## Phase 3: Catalog Content (Week 3-4)

**Goal**: Pre-built sessions that work out of the box

### 3.1 Seed Sessions with Real Content

**What**: The 8 playlist types need actual, high-quality default content

**Per Session Type**:

| Session | Binaural Hz | Duration | Affirmation Theme |
|---------|-------------|----------|-------------------|
| Wake Up | 14-20 Hz (Beta) | 10 min | Energy, intention, capability |
| Meditate | 7-8 Hz (Alpha) | 15 min | Presence, peace, awareness |
| Focus | 12-15 Hz (SMR) | 25 min | Clarity, concentration, flow |
| Sleep | 2-4 Hz (Delta) | 20 min | Release, safety, rest |
| Pre-Performance | 10-12 Hz (Alpha) | 10 min | Confidence, readiness, calm |
| Anxiety Relief | 10 Hz (Alpha) | 15 min | Safety, grounding, control |
| Creativity | 6-10 Hz (Theta-Alpha) | 20 min | Openness, curiosity, expression |
| Coffee Replacement | 18-25 Hz (Beta) | 15 min | Alertness, energy, vitality |

**Approach**:
- Generate "generic but good" affirmations for each type
- Pre-generate TTS audio
- Store as seed data
- These play for users who skip onboarding or before values are set

---

### 3.2 Binaural Beat Assets

**What**: Real binaural beat audio files (not placeholders)

**Requirements**:
- 400 Hz carrier frequency (per your research)
- Specific offset for each brainwave state:
  - Delta: 400 Hz left, 402-404 Hz right
  - Theta: 400 Hz left, 406-408 Hz right
  - Alpha: 400 Hz left, 410-412 Hz right
  - Beta: 400 Hz left, 414-425 Hz right
- Background pink noise layer
- Seamlessly loopable (critical)

**Options**:
1. Generate programmatically (FFmpeg can do this)
2. Commission from audio engineer
3. License from binaural beat library

**Storage**:
- `/assets/binaural/delta.mp3`
- `/assets/binaural/theta.mp3`
- etc.

---

### 3.3 Background Ambient Audio

**What**: Optional ambient soundscapes

**Tracks Needed**:
- Rain
- Ocean waves
- Forest
- White noise
- Pink noise
- Silence (just binaural)

**Source**: In assets folder

---

## Phase 4: Science & Education (Week 4-5)

**Goal**: Deliver on "the honest binaural beat app" positioning

### 4.1 Frequency Transparency

**What**: Show users exactly what frequencies they're hearing

**UI Elements**:
- During playback: "Currently playing: 10 Hz Alpha waves"
- Session details: Explain why this frequency for this session
- Settings: Let users see/adjust (advanced)

**Implementation**:
- Add `frequencyHz` and `brainwaveState` to session schema
- Display in PlayerScreen
- Optional: Real-time frequency visualization (future)

---

### 4.2 Science Cards

**What**: Bite-sized education throughout the app

**Placement**:
- Home screen: "Did you know?" cards
- Session detail: "Why this works" section
- Onboarding: Brief explainer

**Content Examples**:
- "Alpha waves (8-12 Hz) are associated with relaxed alertness. Studies show a 26.3% reduction in anxiety with alpha-frequency binaural beats."
- "Repetition matters: Research shows hearing the same affirmation multiple times is more effective than hearing many different ones."
- "Values-based affirmations work better because they connect to your identity, not just wishful thinking."

**Implementation**:
- `ScienceCard` component
- Content stored in `science-content.json` or CMS
- Rotate/randomize display

---

### 4.3 "Why We Don't" Section

**What**: Explain what Entrain deliberately excludes

**Content**:
- "Why we don't use subliminal affirmations" (no evidence they work)
- "Why we don't play affirmations while you sleep" (minimal benefit)
- "Why we limit session types" (evidence-based selection)

**Placement**: Settings → "Our Approach" or dedicated Education tab

---

## Phase 6: Production Readiness (Week 7-8)

### 6.1 Authentication
- Replace `default-user-id`
- Implement Clerk/Supabase auth
- Secure all endpoints

### 6.2 Database Migration
- SQLite → Postgres (Supabase/Neon)
- Update Prisma schema
- Data migration script

### 6.3 Payments
- RevenueCat integration
- Pro tier unlocks:
  - Unlimited sessions
  - Longer durations
  - All voices
  - Manifestation tools

### 6.4 Cloud Storage
- S3 for audio files
- CloudFront CDN
- Update audio URLs to use CDN

---

## Implementation Priority

| Phase | Effort | Impact | Do First? |
|-------|--------|--------|-----------|
| Phase 1: AI Pipeline | High | Critical | ✅ Yes |
| Phase 2: Values Onboarding | Medium | High | ✅ Yes |
| Phase 3: Catalog Content | Medium | High | ✅ Yes |
| Phase 4: Science Education | Low | Medium | After core works |
| Phase 6: Production | High | Critical | Before launch |

---

## Recommended Order

```
Week 1-2: Phase 1 (AI Pipeline)
          └── Get one session generating real audio end-to-end

Week 2-3: Phase 2 (Values Onboarding) + Phase 3 (Catalog)
          └── New users can onboard and play pre-built sessions

Week 4:   Phase 4 (Science Education)
          └── Differentiation and credibility

Week 5-6: Phase 6 (Production Readiness)
          └── Auth, payments, database — prepare for launch


```

---

## Success Criteria

**Phase 1 Complete When**:
- [ ] User creates session → OpenAI generates 3-6 affirmations → ElevenLabs speaks them → Audio plays with binaural beats
- [ ] Affirmations are cached (no re-generation for identical text)
- [ ] Audio quality matches AUDIO_PROFILE_V3 spec

**Phase 2 Complete When**:
- [ ] New user completes values onboarding
- [ ] Values stored in database
- [ ] Values passed to affirmation generation

**Phase 3 Complete When**:
- [ ] All 8 session types have working default content
- [ ] Real binaural beat files (not placeholders)
- [ ] At least 2 ambient background options

**Phase 4 Complete When**:
- [ ] Frequency shown during playback
- [ ] At least 10 science cards in rotation
- [ ] "Our Approach" section explains methodology

**MVP Launch Ready When**:
- [ ] Phases 1-4 complete
- [ ] Phase 6 (auth, payments, database) complete
- [ ] At least 50 test sessions generated without errors
- [ ] Binaural beat quality verified by listening test

---

## API Keys Required

| Service | Purpose | Status |
|---------|---------|--------|
| OpenAI | Affirmation generation | ✅ In codebase |
| ElevenLabs | Text-to-speech | ✅ In codebase |
| Stripe/RevenueCat | Payments | ❌ Needed |
| Supabase/Clerk | Auth | ❌ Needed |
| AWS S3 | Audio storage | ❌ Needed |

---

## Notes

- **Repetition > Variety**: Generate 3-6 affirmations, repeat them throughout session (don't generate 20 different ones)
- **400 Hz Carrier**: All binaural beats use 400 Hz base frequency
- **15-30 Min Minimum**: Sessions should be at least 15 minutes for binaural effectiveness
- **Values First**: Without values onboarding, affirmations fall back to "good but generic"
- **Cache Aggressively**: TTS is expensive — hash and cache everything
