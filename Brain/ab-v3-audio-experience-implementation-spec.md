# Audio Experience Implementation Spec (V3)
Date: 2025-12-14  
Target: Current V3 stack (API generates assets, mobile `packages/audio-engine` uses `expo-audio`)

---

## Goals
- Voice is always intelligible and emotionally present.
- No audible seams, clicks, or level jumps (loops and transitions are invisible).
- Mix never causes fatigue over long listening (especially on earbuds).
- Behavior is deterministic (no “random” DSP surprises), compatible with `expo-audio`.

## Non-goals
- Real-time DSP analysis of audio amplitude on device (not available in `expo-audio` today).
- Full studio-grade mastering in-app (do it server-side during asset generation).

---

## Audio Asset Standards (enforced server-side)

### 1) Formats
- **Processing intermediate:** WAV, 48 kHz, 24-bit, stereo
- **Shipping / playback:** AAC LC in `.m4a` (48 kHz, stereo, 160–192 kbps VBR or CBR)
- Avoid MP3 for the final “core experience” assets (encoder delay and non-gapless behavior increases seam risk).

### 2) Loudness targets (consistent across sessions)
Normalize each stem so the default mix works consistently across content.

- **Affirmations stem**
  - Target integrated loudness: **-20 LUFS**
  - True peak: **≤ -1.5 dBTP**
  - LRA (loudness range): clamp gently (do not over-compress)

- **Background stem**
  - Target integrated loudness: **-32 LUFS**
  - True peak: **≤ -2.0 dBTP**

- **Binaural stem**
  - Target integrated loudness: **-34 LUFS**
  - True peak: **≤ -2.0 dBTP**

> Rationale: This creates ~12–14 LU of separation between voice and the beds before any ducking. The runtime mix then becomes stable and predictable.

### 3) Loop readiness rules
- Background and binaural assets must be “loop clean”:
  - no clicks at the boundary
  - first and last 250 ms match in RMS and spectral profile within tolerance
- Affirmations merged file must include loop padding:
  - prepend **500 ms** room tone (very low-level noise) or near-silence
  - append **750 ms** room tone or near-silence  
  This is specifically to allow a loop crossfade without doubling audible speech.

---

## Contract additions (minimal, optional fields)

### PlaybackBundleVM additions
Add optional metadata used by the engine for ducking and quality reporting.

```ts
// packages/contracts/src/schemas.ts
voiceActivity?: {
  // Speech presence windows in the merged affirmations stem
  segments: { startMs: number; endMs: number }[];
  // Settings used for generation (debuggable)
  thresholdDb?: number;
  minSilenceMs?: number;
}
```

Also actually populate the existing optional `loudness` block:
```ts
loudness?: {
  affirmationsLUFS?: number;
  backgroundLUFS?: number;
  binauralLUFS?: number;
}
```

---

## API Pipeline Changes (server-side)

### A) Produce final assets as AAC `.m4a` (not stitched MP3 copies)
Current stitching uses `-c copy` for MP3 segments. Replace with a concat that re-encodes to a single consistent target.

#### 1) Stitch chunks to a single WAV (recommended)
- Decode each chunk to WAV 48k stereo
- Concatenate as PCM
- Then normalize and encode to AAC

Example (conceptual):
- Create a concat list of WAVs
- `ffmpeg -f concat -safe 0 -i list.txt -ar 48000 -ac 2 -c:a pcm_s24le merged.wav`

#### 2) Normalize loudness (two-pass loudnorm)
For affirmations:
- Pass 1: measure
- Pass 2: apply `loudnorm=I=-20:TP=-1.5:LRA=7`

Example:
- `ffmpeg -i merged.wav -af loudnorm=I=-20:TP=-1.5:LRA=7:print_format=json -f null -`
- Parse JSON, then run second pass with measured values.

Repeat similarly for background and binaural using their targets.

#### 3) Encode to AAC `.m4a`
- `ffmpeg -i normalized.wav -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart out.m4a`

### B) Generate voice activity segments for ducking (silence detection)
After producing the final affirmations `.m4a`, derive “speech present” windows.

- Use `silencedetect`:
  - threshold: **-35 dB**
  - min silence duration: **0.20 s**
- Invert silence windows into speech windows.

Example:
- `ffmpeg -i affirmations.m4a -af silencedetect=noise=-35dB:d=0.20 -f null -`

Parse logs:
- `silence_start: X`
- `silence_end: Y`

Derive speech segments:
- From previous `silence_end` to next `silence_start`
- Clamp very short bursts (discard < 120 ms)
- Add a small lookahead baked into playback (handled client-side)

Persist into DB (or sidecar JSON) and return in `PlaybackBundleVM.voiceActivity`.

### C) Loop validation for background and binaural
Add a simple loop validator job that checks:
- RMS of first 250 ms vs last 250 ms
- Peak at boundary
- If mismatch beyond tolerance, mark asset as “requires runtime crossfade”

Store:
```ts
loopQuality?: { needsRuntimeCrossfade: boolean; seamRiskScore: number }
```
This can live in `AudioAsset.metaJson` and can be optional in the bundle later.

---

## Mobile Audio Engine Changes (`packages/audio-engine`)

### Overview
Replace ad-hoc fades + direct volume sets with a single deterministic “mix controller” that runs at a stable tick rate and owns:
- state transitions (preroll → playing)
- equal-power crossfades
- ducking
- smoothing
- optional runtime loop crossfading (A/B) for beds

### 1) Add a high-frequency control loop
Current polling is 250 ms for position. Keep that for UI, but add a separate control tick:

- `CONTROL_TICK_MS = 25` (40 Hz)
- Runs only when preroll or playing (and while fading).

Responsibilities per tick:
1) Compute desired target volumes for each layer.
2) Smoothly move actual player volumes toward targets (no zipper noise).
3) If using A/B loop crossfade layers, schedule and execute crossfades.

### 2) Mixer architecture (single source of truth)

#### Inputs
- `userMix`: `snapshot.mix` (0..1 per stem)
- `stateMultipliers`: depends on status (preroll vs playing)
- `duckingMultiplier`: computed from voice activity + attack/release smoothing
- `automationMultiplier`: intro ramp, optional “focus mode” behavior
- `safetyCeiling`: hard cap per stem (prevents weird content from going too loud)

#### Output
- `targetVolumes` for each player (0..1)

Formula (per stem):
```
target = clamp01(userMix[stem] * stateMult[stem] * duckMult[stem] * autoMult[stem]) * safetyCeiling[stem]
```

### 3) Replace linear fades with equal-power curves
Equal-power crossfades feel “invisible” compared to linear.

Define:
- `p = clamp01(elapsed / duration)`
- `mainGain = sin(p * π/2)`
- `prerollGain = cos(p * π/2)`

Use this in:
- preroll → main transition
- A/B loop crossfades (beds)
- any future transitions

### 4) Gain smoothing (no volume steps)
Replace `setMix()` writing volume directly with a smoother.

Implement `GainSmoother` per player:
- Maintains `current`, `target`
- Uses one-pole smoothing with separate attack/release
- Updated every control tick

Parameters:
- `ATTACK_MS = 80`
- `RELEASE_MS = 250`
- `MIX_CHANGE_ATTACK_MS = 150` (for user slider changes)
- `MIX_CHANGE_RELEASE_MS = 250`

Pseudo:
```ts
alpha = 1 - exp(-dt / tau)
current += (target - current) * alpha
```

### 5) Ducking (speech-first mix without real-time DSP)
Use `PlaybackBundleVM.voiceActivity.segments` computed server-side.

#### Behavior
When voice is active:
- background ducks by **-4 dB** (multiplier ≈ 0.63)
- binaural ducks by **-2 dB** (multiplier ≈ 0.79)
- affirmations unchanged

When voice ends:
- beds return smoothly

Parameters:
- `LOOKAHEAD_MS = 80` (start duck slightly before speech)
- `ATTACK_MS = 90`
- `RELEASE_MS = 350`
- `MIN_DUCK_INTERVAL_MS = 120` (ignore micro-blips)

Implementation:
- At each control tick:
  - Determine `isVoiceActive(positionMs + LOOKAHEAD_MS)`
  - Set ducking targets:
    - `bgDuckTarget = isVoiceActive ? 0.63 : 1.0`
    - `binDuckTarget = isVoiceActive ? 0.79 : 1.0`
  - Smooth those targets with attack/release
  - Apply into mix formula

### 6) Runtime loop crossfading (A/B) for beds when needed
If platform loop playback is not reliably gapless, implement A/B looping for:
- background
- binaural  
Optionally affirmations if you detect gaps, but do that only if loop padding exists.

#### LoopingBed abstraction
Create `LoopingBed` that owns:
- `playerA`, `playerB`
- `active: "A" | "B"`
- `crossfadeMs = 250` (beds)
- `scheduleThresholdMs = crossfadeMs + 80`

Algorithm:
1) Start active player at normal volume
2) When `timeRemaining <= scheduleThresholdMs`:
   - start inactive player from `0` position at volume 0
   - equal-power crossfade from active → inactive over `crossfadeMs`
   - stop and rewind old active
   - swap active flag
3) Repeat

Notes:
- Requires reliable `duration` and `currentTime`. If duration is unknown, fall back to `.loop = true` and skip A/B.

### 7) Preroll → main transition rework
Current crossfade is 1750 ms with 20-step linear changes. Replace with:
- duration: **1750 ms** (keep)
- curve: equal-power
- control loop drives it, not setInterval steps

Sequence:
1) `play()` called and status is `loading`:
   - start preroll immediately, fade preroll in to 0.10 over 250 ms
2) When main players exist:
   - start main players muted (0)
   - run equal-power crossfade:
     - preroll down from 0.10 to 0
     - main up to computed target volumes (including automation + ducking)
3) After crossfade:
   - stop and release preroll player

### 8) Intro automation (premium feel, deterministic)
Add a simple “intro ramp” that makes the environment feel like it’s settling in.

- Background automation:
  - start at 0
  - reach 100% of target in **1200 ms**
- Binaural automation:
  - start at 0
  - reach 100% of target in **2000 ms**
- Affirmations automation:
  - start at 0
  - reach 100% of target in **900 ms**
  - optional 200 ms delay so the bed appears first

These are multipliers in the mix formula, not direct volume writes.

### 9) Drift correction (keep layers aligned)
Every **5 seconds** while playing:
- read `affTime = aff.currentTime`
- read `bgTime`, `binTime`
- compute drift: `abs(bgTime - (affTime % bgDur))`
- if drift > **80 ms**, gently seek beds to the correct modulo position (do not hard-seek repeatedly)

This keeps the bed phase stable over long sessions.

### 10) Public API changes to AudioEngine
Add these methods and behaviors:

- `setMix(mix: Mix, opts?: { rampMs?: number; source?: "user" | "system" })`
  - uses smoothing and a specified ramp
  - sets `hasUserSetMix = true` for `source === "user"`

- `setVoiceProminence(x: number)`
  - optional convenience that maps a single slider into a mix
  - recommended mapping:
    - `aff = 1.0`
    - `bg = lerp(0.18, 0.38, 1-x)`
    - `bin = lerp(0.14, 0.32, 1-x)`

- `load(bundle)` must store:
  - `bundle.voiceActivity` and `bundle.loudness` if present

---

## File-Level Work Plan

### A) Contracts
- `packages/contracts/src/schemas.ts`
  - Add `voiceActivity` optional field to `PlaybackBundleVMSchema`
  - Ensure `loudness` is returned by API (stop leaving it empty)

### B) API audio generation
- `apps/api/src/services/audio/stitching.ts`
  - Replace `-c copy` concat with a consistent re-encode path to WAV then AAC
- `apps/api/src/services/audio/generation.ts`
  - Add `measureLoudness()` and `normalizeLoudness()` steps
  - Add `generateVoiceActivitySegments()` via `silencedetect`
  - Add loop padding to merged affirmations output
- `apps/api/src/index.ts`
  - Populate `PlaybackBundleVM.loudness`
  - Populate `PlaybackBundleVM.voiceActivity`

### C) Audio engine
- `packages/audio-engine/src/AudioEngine.ts`
  - Introduce control tick loop at 25 ms
  - Replace fade intervals with equal-power curves
  - Add gain smoothing and ducking
  - Add optional A/B looping beds abstraction if needed

Recommended new files:
- `packages/audio-engine/src/mixer.ts` (compute target volumes)
- `packages/audio-engine/src/smoothing.ts` (GainSmoother)
- `packages/audio-engine/src/ducking.ts` (voice activity -> duck multipliers)
- `packages/audio-engine/src/loopingBed.ts` (optional A/B loop crossfade)

---

## Definition of Done (audio)
- No audible clicks, pops, or gaps when:
  - starting playback (preroll → main)
  - pausing/resuming
  - seeking
  - looping beds
  - looping the affirmations track
- Voice intelligibility stays consistent across sessions.
- Background never masks voice, even on cheap earbuds, without the user touching controls.
- Session-to-session perceived loudness does not jump (LUFS normalization validated).
- On-device CPU remains stable (volume updates at 40 Hz do not stutter UI).

---

## QA Listening Protocol (required)
Test each build on:
- AirPods / Bluetooth earbuds
- cheap wired earbuds
- over-ear headphones
- phone speaker

For each device:
- low volume, medium volume, high volume
- 10-minute continuous listen for fatigue
- specifically listen for:
  - loop seams
  - level jumps
  - harsh sibilance or hiss
  - “ear pressure” from binaural layer
  - voice clarity during beds

Log failures with:
- sessionId
- timestamp in session
- device type
- what was heard (click, gap, mask, pump, etc.)

