# Affirmation Generation Pipeline and Player System

**Document Created:** 2025-01-14  
**Purpose:** Comprehensive overview of the affirmation generation pipeline and audio player architecture

---

## Overview

Affirmation Beats V3 uses a sophisticated pipeline that:
1. **Generates personalized affirmations** using OpenAI GPT with neuroscience-based rules
2. **Converts affirmations to audio** using TTS (ElevenLabs with beep fallback)
3. **Stitches audio chunks** into a seamless looping track with silence pauses
4. **Plays three synchronized tracks** (affirmations, binaural, background) with mix controls

---

## Part 1: Affirmation Generation Pipeline

### 1.1 Core Service: `affirmation-generator.ts`

**Location:** `apps/api/src/services/affirmation-generator.ts`

**Key Features:**
- Uses OpenAI Chat Completions API with Prompt Caching for cost efficiency
- Implements neuroscience-based generation rules (5 Linguistic Commandments, 3 Frameworks)
- Validates output against strict rules (present tense, no negatives, 5-12 words, etc.)
- Supports automatic retry with lower temperature if validation fails

**Input (`AffirmationGenerationRequest`):**
```typescript
{
  values?: string[];           // User's core values from onboarding
  sessionType: string;         // "Focus", "Sleep", "Meditate", etc.
  struggle?: string;           // Optional user struggle/context
  goal?: string;               // Written goal for session
  count?: number;              // Number of affirmations (default: 4)
}
```

**Output (`AffirmationGenerationResponse`):**
```typescript
{
  affirmations: string[];      // Array of generated affirmations
  reasoning?: string;          // Optional explanation
}
```

**Generation Rules (from `Brain/affirmation_rules.md`):**

1. **Cognitive Now (Present Tense)**: Never use future tense
2. **Exclusive Positivity**: Frame only around desired state, never the problem
3. **Verbs Over Adjectives**: Use dynamic verbs rather than static adjectives
4. **Brevity and Rhythm**: 5-12 words, rhythmic and chantable
5. **Specificity and Plausibility**: Avoid vague generalizations, keep believable

**Frameworks:**
- **Framework A (Bridge)**: For anxiety/depression/low confidence - uses progressive verbs (learning, becoming, willing)
- **Framework B (Value Anchor)**: For identity/resilience - ties to core values (value, honor, respect)
- **Framework C (Power Statement)**: For performance/goals - uses strong action verbs (building, creating, taking)

**Prompt Caching:**
- Static prefix (rules, schema, examples) is cached by OpenAI (>= 1024 tokens)
- Dynamic tail (user values, struggle, session type) changes per request
- Maximizes cache hits to reduce costs and latency

**Validation:**
- Post-validates each affirmation against rules
- Checks for banned words, future tense, word count, duplicates
- Enforces goal keyword coverage (70% threshold if goal provided)
- Retries with lower temperature if validation fails

### 1.2 Generation Flow

When a session needs affirmations (during `processEnsureAudioJob`):

1. **Check if affirmations exist**: If session already has affirmations in DB, skip generation
2. **Extract user context**: Get user values (top 5), struggle, session type from goalTag/title
3. **Call `generateAffirmations()`**: Pass context to OpenAI with prompt caching
4. **Validate and save**: Store affirmations in `SessionAffirmation` table with idx ordering
5. **Update session hash**: Store hash of all affirmations for cache invalidation

**Code Reference:**
```235:320:apps/api/src/services/audio/generation.ts
const SILENCE_BETWEEN_READS_MS = 1500; // 1.5 seconds of silence between first and second read of same phrase
const FIXED_SILENCE_MS = 4000; // 4 seconds of silence after second read, before next phrase

export async function processEnsureAudioJob(payload: { sessionId: string }) {
    const { sessionId } = payload;
    console.log(`Processing audio for session ${sessionId}`);

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { 
            affirmations: { orderBy: { idx: "asc" } },
            ownerUser: {
                include: {
                    values: {
                        orderBy: { rank: "asc" },
                        take: 5, // Top 5 values
                    },
                },
            },
        },
    });

    if (!session) throw new Error("Session not found");

    // Phase 1.1: Generate affirmations if they don't exist
    if (!session.affirmations || session.affirmations.length === 0) {
        console.log(`[Audio] No affirmations found, generating with AI...`);
        
        // Get user values if available
        const userValues = session.ownerUser?.values?.map(v => v.valueText) || [];
        
        // Get user struggle if available
        const userStruggle = session.ownerUser?.struggle || undefined;
        
        // Determine session type from goalTag or title
        const sessionType = session.goalTag || 
            (session.title.toLowerCase().includes("focus") ? "Focus" :
             session.title.toLowerCase().includes("sleep") ? "Sleep" :
             session.title.toLowerCase().includes("meditate") ? "Meditate" :
             session.title.toLowerCase().includes("anxiety") ? "Anxiety Relief" :
             "Meditate"); // Default

        try {
            // Generate affirmations
            const generated = await generateAffirmations({
                values: userValues,
                sessionType,
                struggle: userStruggle,
                count: 4, // Default to 4 affirmations
            });

            // Save affirmations to database
            await prisma.sessionAffirmation.createMany({
                data: generated.affirmations.map((text, idx) => ({
                    sessionId: session.id,
                    idx,
                    text,
                })),
            });

            // Update session hash
            const newHash = hashContent(generated.affirmations.join("|"));
            await prisma.session.update({
                where: { id: sessionId },
                data: { affirmationsHash: newHash },
            });

            console.log(`[Audio] ✅ Generated ${generated.affirmations.length} affirmations`);
            
            // Reload session with new affirmations
            const updatedSession = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { affirmations: { orderBy: { idx: "asc" } } },
            });
            
            if (!updatedSession || !updatedSession.affirmations.length) {
                throw new Error("Failed to save generated affirmations");
            }
            
            // Use updated session for rest of processing
            session.affirmations = updatedSession.affirmations;
        } catch (error) {
            console.error(`[Audio] ❌ Failed to generate affirmations:`, error);
            throw new Error(`Failed to generate affirmations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
```

---

## Part 2: Audio Generation Pipeline

### 2.1 TTS Chunk Generation

**Location:** `apps/api/src/services/audio/generation.ts` → `ensureAffirmationChunk()`

**Process:**
1. **Hash calculation**: Creates unique hash from `voiceId:pace:text:variant:VERSION`
2. **Cache check**: Looks up in `AudioAsset` table by `kind="affirmationChunk"` and hash
3. **TTS generation**: If not cached, calls `generateTTSAudio()` which:
   - Uses ElevenLabs API if configured (`ELEVENLABS_API_KEY`)
   - Falls back to beep TTS if not configured
   - Generates variant 1 (neutral) and variant 2 (variation) for each affirmation
4. **Storage**: Saves file to `storage/chunks/{hash}.mp3` and records in DB

**Delivery Pattern (per `Loop-and-delivery.md`):**
- Each affirmation is spoken **twice** with slight prosody variation
- Pattern: `[Read 1] → [1.5s silence] → [Read 2] → [4s silence] → [Next affirmation]`
- This creates integration space between phrases

### 2.2 Audio Stitching

**Process:**
1. **Gather chunks**: For each affirmation, gets 2 TTS chunks + 2 silence chunks
2. **Calculate merged hash**: Hash of all file paths + audio profile version
3. **Stitch audio**: Uses `stitchAudioFiles()` with FFmpeg to concatenate:
   - Applies loudness normalization (-20 LUFS for affirmations)
   - Adds loop padding (500ms prepend, 750ms append) for seamless looping
4. **Voice activity detection**: Generates segments for ducking (lowering background during speech)
5. **Upload to S3**: If configured, uploads merged file to S3/CloudFront
6. **Store metadata**: Saves loudness measurements and voice activity segments in `metaJson`

**Code Reference:**
```322:468:apps/api/src/services/audio/generation.ts
    // 1. Gather all chunks
    const filePaths: string[] = [];
    // Force pace to "slow" regardless of DB (Migration safety)
    const effectivePace = "slow";

    for (const aff of session.affirmations) {
        // Read 1 (Neutral)
        const path1 = await ensureAffirmationChunk(aff.text, session.voiceId, effectivePace, 1);
        filePaths.push(path1);

        // Silence between reads (1.5 seconds)
        const silenceBetweenReads = await ensureSilence(SILENCE_BETWEEN_READS_MS);
        filePaths.push(silenceBetweenReads);

        // Read 2 (Variation)
        const path2 = await ensureAffirmationChunk(aff.text, session.voiceId, effectivePace, 2);
        filePaths.push(path2);

        // Silence after second read (4 seconds before next phrase)
        const silenceAfterRead = await ensureSilence(FIXED_SILENCE_MS);
        filePaths.push(silenceAfterRead);
    }

    // 2. Stitch
    // Calculate merged hash
    const mergedHash = hashContent(filePaths.join("|") + AUDIO_PROFILE_V3.VERSION);

    // Check if merged already exists
    const existingMerged = await prisma.audioAsset.findUnique({
        where: { kind_hash: { kind: "affirmationMerged", hash: mergedHash } }
    });

    let mergedPath = "";
    let mergedAssetId = "";

    // Check if existing merged file is available (either S3 URL or local file)
    if (existingMerged) {
        // If it's an S3 URL (starts with http/https), use it directly
        if (existingMerged.url.startsWith("http://") || existingMerged.url.startsWith("https://")) {
            mergedPath = existingMerged.url;
            mergedAssetId = existingMerged.id;
        } 
        // If it's a local path, check if file exists
        else if (await fs.pathExists(existingMerged.url)) {
            mergedPath = existingMerged.url;
            mergedAssetId = existingMerged.id;
            
            // If S3 is configured and we have a local file, try to upload it
            // This handles the case where S3 was added after files were generated
            if (isS3Configured() && !existingMerged.url.startsWith("http")) {
                try {
                    console.log(`[Audio] Uploading existing merged audio to S3...`);
                    const s3Key = generateS3Key("affirmationMerged", mergedHash, "mp3");
                    const s3Url = await uploadToS3(existingMerged.url, {
                        key: s3Key,
                        contentType: "audio/mpeg",
                        cacheControl: "public, max-age=31536000",
                    });
                    
                    // Update database with S3 URL
                    await prisma.audioAsset.update({
                        where: { id: existingMerged.id },
                        data: { url: s3Url },
                    });
                    
                    mergedPath = s3Url;
                    console.log(`[Audio] ✅ Migrated to S3: ${s3Url}`);
                } catch (s3Error: any) {
                    console.warn(`[Audio] ⚠️  Failed to migrate to S3: ${s3Error.message}`);
                    // Continue with local path
                }
            }
        }
    } else {
        // Stitched output with new WAV→AAC pipeline
        console.log(`[Audio] Stitching ${filePaths.length} chunks with loop padding...`);
        mergedPath = await stitchAudioFiles(filePaths, mergedHash, {
            targetLUFS: -20, // Affirmations target: -20 LUFS
            targetTP: -1.5,  // True peak: -1.5 dBTP
            addLoopPadding: true, // Add 500ms prepend + 750ms append for loop crossfade
        });

        // Measure final loudness (should match target, but verify)
        console.log(`[Audio] Verifying loudness of merged file...`);
        const loudness = await measureLoudness(mergedPath);
        
        // Generate voice activity segments for ducking
        console.log(`[Audio] Generating voice activity segments...`);
        const voiceActivity = await generateVoiceActivitySegments(mergedPath);
        
        // Store metadata in metaJson
        const metaJson = JSON.stringify({
            loudness,
            voiceActivity: voiceActivity.segments.length > 0 ? voiceActivity : undefined,
        });

        // Upload to S3 if configured, otherwise use local path
        let finalUrl = mergedPath;
        if (isS3Configured()) {
            try {
                console.log(`[Audio] Uploading merged audio to S3...`);
                const s3Key = generateS3Key("affirmationMerged", mergedHash, "mp3");
                const s3Url = await uploadToS3(mergedPath, {
                    key: s3Key,
                    contentType: "audio/mpeg",
                    cacheControl: "public, max-age=31536000", // 1 year cache
                });
                finalUrl = s3Url;
                console.log(`[Audio] ✅ Uploaded to S3: ${s3Url}`);
            } catch (s3Error: any) {
                console.error(`[Audio] ⚠️  S3 upload failed, using local path: ${s3Error.message}`);
                // Fall back to local path if S3 upload fails
                finalUrl = mergedPath;
            }
        }

        const asset = await prisma.audioAsset.upsert({
            where: { kind_hash: { kind: "affirmationMerged", hash: mergedHash } },
            update: { 
                url: finalUrl, // Store S3 URL if available, otherwise local path
                metaJson: metaJson,
            },
            create: {
                kind: "affirmationMerged",
                hash: mergedHash,
                url: finalUrl, // Store S3 URL if available, otherwise local path
                metaJson: metaJson,
            }
        });
        mergedAssetId = asset.id;
    }

    // 3. Link to Session
    await prisma.sessionAudio.upsert({
        where: { sessionId },
        create: {
            sessionId,
            mergedAudioAssetId: mergedAssetId,
        },
        update: {
            mergedAudioAssetId: mergedAssetId,
            generatedAt: new Date(),
        }
    });

    return { mergedUrl: mergedPath, mergedAssetId };
}
```

---

## Part 3: Playback Bundle API

### 3.1 Endpoint: `GET /sessions/:id/playback-bundle`

**Location:** `apps/api/src/index.ts`

**Returns:** `PlaybackBundleVM` with:
- `sessionId`: Session identifier
- `affirmationsMergedUrl`: URL to merged affirmations audio (S3 or local)
- `background`: Background ambience asset (platform-aware URLs)
- `binaural`: Binaural frequency asset (based on session's `frequencyHz`)
- `mix`: Default mix levels (affirmations: 1.0, binaural: 0.3, background: 0.3)
- `effectiveAffirmationSpacingMs`: Spacing between affirmations (calculated)
- `loudness`: Loudness measurements (LUFS) if available
- `voiceActivity`: Voice activity segments for ducking if available

**Flow:**
1. Fetches session with audio relationship
2. Checks if audio exists (returns 404 if not ready)
3. Resolves binaural asset based on session's `frequencyHz`
4. Resolves background asset (default)
5. Constructs affirmations URL (S3 or local file serving)
6. Parses metadata (loudness, voice activity) from `metaJson`
7. Returns validated `PlaybackBundleVM`

**Code Reference:**
```439:572:apps/api/src/index.ts
app.get("/sessions/:id/playback-bundle", async (c) => {
  try {
    const parsed = uuidParam.safeParse({ id: c.req.param("id") });
    if (!parsed.success) return c.json(error("INVALID_SESSION_ID", "Session id must be a UUID", parsed.error.flatten()), 400);

    const session = await prisma.session.findUnique({
      where: { id: parsed.data.id },
      include: { audio: { include: { mergedAudioAsset: true } } }
    });

    if (!session) return c.json(error("NOT_FOUND", "Session not found"), 404);

    if (!session.audio) {
      return c.json(error("AUDIO_NOT_READY", "Audio not generated", { sessionId: session.id }), 404);
      // Client should see this error and call ensure-audio
    }

    // V3 Compliance: Resolve real binaural/background assets
    // Use request host to construct URLs that work for physical devices
    const host = c.req.header("host") || "localhost:8787";
    const protocol = c.req.header("x-forwarded-proto") || "http";
    const apiBaseUrl = `${protocol}://${host}`;
    
    const { getBinauralAsset, getBackgroundAsset } = await import("./services/audio/assets");
    
    // Get real asset URLs (platform-aware) with error handling
    // Pass apiBaseUrl as argument instead of mutating process.env
    let binaural;
    let background;
    
    // Phase 4.1: Use session's frequencyHz if available, otherwise default to 10Hz
    const binauralHz = session.frequencyHz ?? 10;
    try {
      binaural = await getBinauralAsset(binauralHz, apiBaseUrl);
    } catch (binauralError: any) {
      console.error("[API] Failed to get binaural asset:", binauralError);
      return c.json(error("ASSET_ERROR", `Binaural asset not available: ${binauralError.message}`, binauralError), 500);
    }
    
    try {
      background = await getBackgroundAsset(undefined, apiBaseUrl); // Default background
    } catch (backgroundError: any) {
      console.error("[API] Failed to get background asset:", backgroundError);
      return c.json(error("ASSET_ERROR", `Background asset not available: ${backgroundError.message}`, backgroundError), 500);
    }
    
    // Construct affirmations URL
    if (!session.audio.mergedAudioAsset?.url) {
      return c.json(error("ASSET_ERROR", "Merged audio asset URL not found"), 500);
    }
    
    const filePath = session.audio.mergedAudioAsset.url;
    let affirmationsUrl: string;
    
    // If URL is already an S3/CloudFront URL (starts with http/https), use it directly
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      affirmationsUrl = filePath;
    } else {
      // Local file path - construct URL for local serving
      // File path is relative to apps/api, e.g., "storage/merged/file.mp3"
      // Static server serves /storage/* from apps/api/, so we need to construct the URL correctly
      let affirmationsUrlRelative: string;
      
      // If path is absolute, make it relative to process.cwd() (apps/api)
      if (path.isAbsolute(filePath)) {
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
        // If relative path already starts with "storage", use it directly
        affirmationsUrlRelative = relativePath.startsWith("storage/") 
          ? `/${relativePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${relativePath}`;
      } else {
        // Path is already relative, ensure it starts with /storage/
        affirmationsUrlRelative = filePath.startsWith("storage/") 
          ? `/${filePath}` 
          : `${STORAGE_PUBLIC_BASE_URL}/${filePath}`;
      }
      
      // Convert to absolute URL using request host (works for localhost, IP addresses, etc.)
      affirmationsUrl = affirmationsUrlRelative.startsWith("http") 
        ? affirmationsUrlRelative 
        : `${protocol}://${host}${affirmationsUrlRelative}`;
    }

    // Parse loudness and voiceActivity from metaJson if available
    let loudness: { affirmationsLUFS?: number; backgroundLUFS?: number; binauralLUFS?: number } | undefined;
    let voiceActivity: { segments: Array<{ startMs: number; endMs: number }>; thresholdDb?: number; minSilenceMs?: number } | undefined;
    
    if (session.audio.mergedAudioAsset?.metaJson) {
      try {
        const meta = JSON.parse(session.audio.mergedAudioAsset.metaJson);
        if (meta.loudness) {
          loudness = {
            affirmationsLUFS: meta.loudness.input_i,
            // Background and binaural loudness will be measured separately
            // For now, we only measure affirmations during generation
          };
        }
        if (meta.voiceActivity && meta.voiceActivity.segments) {
          voiceActivity = {
            segments: meta.voiceActivity.segments.map((seg: any) => ({
              startMs: Math.round(seg.startMs),
              endMs: Math.round(seg.endMs),
            })),
            thresholdDb: meta.voiceActivity.thresholdDb,
            minSilenceMs: meta.voiceActivity.minSilenceMs,
          };
        }
      } catch (e) {
        console.warn("[API] Failed to parse metaJson:", e);
      }
    }

    try {
      const bundle = PlaybackBundleVMSchema.parse({
        sessionId: session.id,
        affirmationsMergedUrl: affirmationsUrl,
        background,
        binaural,
        mix: { affirmations: 1, binaural: 0.3, background: 0.3 }, // Default to 30% for binaural and background
        effectiveAffirmationSpacingMs: session.affirmationSpacingMs ?? 3000, // Default to 3s if null
        loudness, // Include loudness measurements if available
        voiceActivity, // Include voice activity segments for ducking
      });

      return c.json({ bundle });
    } catch (parseError: any) {
      console.error("[API] Failed to parse PlaybackBundleVM:", parseError);
      return c.json(error("VALIDATION_ERROR", "Failed to construct playback bundle", parseError), 500);
    }
  } catch (err: any) {
    console.error("[API] Unexpected error in playback-bundle:", err);
    return c.json(error("INTERNAL_ERROR", "Internal server error", err.message), 500);
  }
});
```

---

## Part 4: Audio Player System

### 4.1 Architecture: AudioEngine Singleton

**Location:** `packages/audio-engine/src/AudioEngine.ts`

**Key Concepts:**
- **Singleton pattern**: One `AudioEngine` instance per app process
- **3-track model**: Affirmations, Binaural, Background (all loop independently)
- **State machine**: `idle` → `loading` → `preroll` → `playing` → `paused`
- **Pre-roll atmosphere**: Starts within 100-300ms while main tracks load
- **Crossfade**: Smooth transition from pre-roll to main mix (1.75s equal-power curve)

**States:**
- `idle`: No audio loaded
- `loading`: Bundle being loaded (players created, not playing)
- `preroll`: Pre-roll atmosphere playing (main tracks loading)
- `ready`: All tracks loaded, ready to play
- `playing`: Main mix playing
- `paused`: Playback paused
- `stopping`: Transitioning to stopped
- `error`: Error state

**Modules:**
- `AudioSession`: Configures iOS/Android audio session
- `PlayerManager`: Handles player lifecycle (creation, readiness, release)
- `PrerollManager`: Manages pre-roll atmosphere playback
- `MixerController`: Handles mix automation, crossfade, ducking
- `DriftCorrector`: Corrects timing drift between looping tracks

### 4.2 Player Flow

**Loading (`load()`):**
1. Configure audio session (iOS/Android)
2. Create 3 players: `affPlayer`, `binPlayer`, `bgPlayer`
3. Set loop=true for all tracks (infinite sessions)
4. Apply mix levels (preserve user adjustments if set)
5. Set state to `ready` (or `preroll` if pre-roll active)

**Playing (`play()`):**
1. If `idle`: Start pre-roll immediately, load bundle in parallel
2. If `preroll`: Crossfade to main mix when ready
3. If `ready`/`paused`: Rolling start sequence:
   - Background fades in over 4s (starts first)
   - Binaural fades in over 4s (starts after 2s delay)
   - Affirmations start immediately (no fade)
4. Start control loop (25ms tick for mixer/ducking)
5. Start position polling (250ms for UI)

**Pausing (`pause()`):**
- Pauses all players
- Stops control loop and position polling
- Fades out pre-roll if active (400ms)
- Sets state to `paused`

**Stopping (`stop()`):**
- Stops all players
- Seeks all players to 0
- Fades out pre-roll (250ms)
- Resets automation
- Sets state to `idle`

**Code Reference:**
```525:825:packages/audio-engine/src/AudioEngine.ts
  play(): Promise<void> {
    return this.enqueue(async () => {
      // Ensure audio session is configured before playing
      await this.audioSession.ensureConfigured();
      
      // If idle, start pre-roll immediately (within 100-300ms)
      if (this.snapshot.status === "idle") {
        this.setState({ status: "preroll" });
        await this.prerollManager.start();
        
        // If bundle exists, load it in parallel (pre-roll continues)
        if (this.currentBundle) {
          // Load will happen, but we don't await it here - pre-roll continues
          this.load(this.currentBundle).catch(err => {
            console.error("[AudioEngine] Failed to load bundle:", err);
          });
        }
        this.startControlLoop();
        return; // Pre-roll is now playing, will crossfade when ready
      }

      // If in preroll state and main tracks are ready, crossfade to them
      if (this.snapshot.status === "preroll") {
        if (this.affPlayer && this.binPlayer && this.bgPlayer) {
          await this.crossfadeToMainMix();
          return;
        }
        // Main tracks not ready yet, pre-roll continues
        // Start control loop for preroll
        this.startControlLoop();
        return;
      }
      
      // If in loading state, start pre-roll if not already started
      if (this.snapshot.status === "loading") {
        if (!this.prerollManager.isActive()) {
          await this.prerollManager.start();
          this.setState({ status: "preroll" });
          this.startControlLoop(); // Start control loop for preroll
        }
        return; // Wait for load to complete
      }

      // Standard play from ready or paused
      // If already playing, just return (idempotent - safe to call multiple times)
      if (this.snapshot.status === "playing") {
        // Already playing, no-op (this is fine, just means user tapped Play again)
        return;
      }
      
      // If idle and no bundle, can't play (should have been handled above, but double-check)
      // Note: This check is defensive - status shouldn't be "idle" here after the checks above
      if (!this.currentBundle) {
        console.warn("[AudioEngine] Cannot play without a bundle loaded");
        return;
      }
      
      if (this.snapshot.status !== "ready" && this.snapshot.status !== "paused") {
        console.warn("[AudioEngine] Cannot play from status:", this.snapshot.status);
        return;
      }

      // If resuming from pause and pre-roll was active, restart it if needed
      if (this.snapshot.status === "paused" && !this.affPlayer) {
        // Main tracks not ready, restart pre-roll
        this.setState({ status: "preroll" });
        await this.prerollManager.start();
        this.startControlLoop();
        return;
      }

      // Start main mix (may be muted initially if crossfading)
      if (!this.affPlayer || !this.binPlayer || !this.bgPlayer) {
        console.warn("[AudioEngine] Cannot play - players not loaded:", {
          aff: !!this.affPlayer,
          bin: !!this.binPlayer,
          bg: !!this.bgPlayer
        });
        return;
      }

      // If resuming from pause, just resume at current volumes (no rolling start)
      if (this.snapshot.status === "paused") {
        console.log("[AudioEngine] Resuming from pause at current volumes:", {
          aff: this.affPlayer.volume,
          bin: this.binPlayer.volume,
          bg: this.bgPlayer.volume
        });
        
        // Simply resume all players at their current volumes
        await Promise.all([
          this.affPlayer.play(),
          this.binPlayer.play(),
          this.bgPlayer.play()
        ]);
        
        this.mixerController.startIntroAutomation(); // Restart intro automation
        this.startControlLoop();
        this.startPolling();
        this.setState({ status: "playing" });
        console.log("[AudioEngine] Resumed playback");
        return;
      }

      // Rolling start only for initial play (from ready state)
      console.log("[AudioEngine] Playing main mix with rolling start:", {
        volumes: {
          aff: this.snapshot.mix.affirmations,
          bin: this.snapshot.mix.binaural,
          bg: this.snapshot.mix.background
        }
      });

      // Initialize all players at volume 0 for rolling start
      // Use smoothers for smooth intro automation
      this.mixerController.resetSmoothers(0);
      
      if (this.affPlayer) this.affPlayer.volume = 0;
      if (this.binPlayer) this.binPlayer.volume = 0;
      if (this.bgPlayer) this.bgPlayer.volume = 0;
      
      try {
        // Rolling start sequence:
        // 1. Background starts first, fades in over 3 seconds
        // 2. Binaural starts after background begins, fades in over 1 second
        // 3. Affirmations start after binaural begins (no fade, immediate)
        
        // Get URLs from currentBundle for logging
        const getUrl = this.currentBundle ? ((asset: { urlByPlatform: { ios: string, android: string } }) => {
          return Platform.OS === "ios" ? asset.urlByPlatform.ios : asset.urlByPlatform.android;
        }) : null;
        
        console.log("[AudioEngine] Step 1: Starting background player...");
        const bgUrl = this.currentBundle && getUrl ? getUrl(this.currentBundle.background) : "unknown";
        console.log("[AudioEngine] Background URL:", bgUrl);
        
        try {
          // Call play() to trigger loading
          console.log("[AudioEngine] Calling play() on background player...");
          await this.bgPlayer!.play();
          console.log("[AudioEngine] Background play() called, waiting for ready...");
          
          // Wait for ready with shorter timeout - network files should load quickly from S3
          try {
            await waitForPlayerReady(this.bgPlayer!, "Background", 5000); // Reduced to 5s
          } catch (waitError) {
            console.warn("[AudioEngine] ⚠️  Background waitForPlayerReady timed out, but continuing anyway");
            // Don't wait - just continue
          }
          
          // Quick retry if not playing
          if (!this.bgPlayer!.playing) {
            await this.bgPlayer!.play();
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait
          }
          
          if (this.bgPlayer!.playing) {
            console.log("[AudioEngine] ✅ Background started, intro automation will fade in over 4s");
          } else {
            console.error("[AudioEngine] ❌ Background player failed to start after multiple attempts!");
            console.error("[AudioEngine] Check if audio file exists and is accessible:", bgUrl);
            // Continue anyway - control loop will handle it
            console.warn("[AudioEngine] Continuing playback - background may start later");
          }
        } catch (error) {
          console.error("[AudioEngine] ❌ Error starting background player:", error);
          console.error("[AudioEngine] Audio file URL:", bgUrl);
          // Continue anyway - don't block other players
        }
        
        // Brief pause before starting binaural (staggered start)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log("[AudioEngine] Step 2: Starting binaural player...");
        const binUrl = this.currentBundle && getUrl ? getUrl(this.currentBundle.binaural) : "unknown";
        console.log("[AudioEngine] Binaural URL:", binUrl);
        
        try {
          // Call play() to trigger loading
          console.log("[AudioEngine] Calling play() on binaural player...");
          await this.binPlayer!.play();
          console.log("[AudioEngine] Binaural play() called, waiting for ready...");
          
          // Wait for ready with shorter timeout
          try {
            await waitForPlayerReady(this.binPlayer!, "Binaural", 5000); // Reduced to 5s
          } catch (waitError) {
            console.warn("[AudioEngine] ⚠️  Binaural waitForPlayerReady timed out, but continuing anyway");
            // Don't wait - just continue
          }
          
          // Quick retry if not playing
          if (!this.binPlayer!.playing) {
            await this.binPlayer!.play();
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait
          }
          
          if (this.binPlayer!.playing) {
            console.log("[AudioEngine] ✅ Binaural started, intro automation will fade in over 4s (after 2s delay)");
          } else {
            console.error("[AudioEngine] ❌ Binaural player failed to start after multiple attempts!");
            console.error("[AudioEngine] Check if audio file exists and is accessible:", binUrl);
            // Continue anyway - control loop will handle it
            console.warn("[AudioEngine] Continuing playback - binaural may start later");
          }
        } catch (error) {
          console.error("[AudioEngine] ❌ Error starting binaural player:", error);
          console.error("[AudioEngine] Audio file URL:", binUrl);
          // Continue anyway - don't block other players
        }
        
        // Brief pause before starting affirmations (staggered start)
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log("[AudioEngine] Step 3: Starting affirmations player...");
        const affUrl = this.currentBundle?.affirmationsMergedUrl || "unknown";
        
        try {
          // Call play() to trigger loading, then wait for it to be ready
          await this.affPlayer!.play();
          
          // Wait for ready with shorter timeout
          try {
            await waitForPlayerReady(this.affPlayer!, "Affirmations", 5000); // Reduced to 5s
          } catch (waitError) {
            console.warn("[AudioEngine] ⚠️  Affirmations waitForPlayerReady timed out, but continuing anyway");
            // Don't wait - just continue
          }
          
          // Quick retry if not playing
          if (!this.affPlayer!.playing) {
            await this.affPlayer!.play();
            await new Promise(resolve => setTimeout(resolve, 200)); // Reduced wait
          }
          
          if (this.affPlayer!.playing) {
            console.log("[AudioEngine] ✅ Affirmations started");
          } else {
            console.error("[AudioEngine] ❌ Affirmations player failed to start after loading!");
            console.error("[AudioEngine] Check if file exists and is accessible:", affUrl);
          }
        } catch (error) {
          console.error("[AudioEngine] ❌ Error starting affirmations player:", error);
          console.error("[AudioEngine] Audio file URL:", affUrl);
        }
        
        console.log("[AudioEngine] ✅ All players started with rolling start sequence");
        
        // Verify all players are actually playing after a brief delay
        setTimeout(() => {
          console.log("[AudioEngine] Player status check (after 500ms):", {
            aff: { 
              playing: this.affPlayer?.playing, 
              volume: this.affPlayer?.volume,
              duration: this.affPlayer?.duration 
            },
            bin: { 
              playing: this.binPlayer?.playing, 
              volume: this.binPlayer?.volume,
              duration: this.binPlayer?.duration,
              loop: this.binPlayer?.loop
            },
            bg: { 
              playing: this.bgPlayer?.playing, 
              volume: this.bgPlayer?.volume,
              duration: this.bgPlayer?.duration,
              loop: this.bgPlayer?.loop
            }
          });
          
          // Log warnings if players aren't playing
          if (this.affPlayer && !this.affPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Affirmations player not playing after play() call!");
          }
          if (this.binPlayer && !this.binPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Binaural player not playing! Check volume and audio file.");
          }
          if (this.bgPlayer && !this.bgPlayer.playing) {
            console.warn("[AudioEngine] ⚠️  Background player not playing! Check volume and audio file.");
          }
        }, 500);
        
        // Start control loop and position polling
        this.mixerController.startIntroAutomation(); // Start intro automation
        this.startControlLoop();
        this.startPolling();
        this.setState({ status: "playing" });
        console.log("[AudioEngine] All players started, status set to playing");
      } catch (error) {
        console.error("[AudioEngine] ❌ CRITICAL ERROR starting players:", error);
        console.error("[AudioEngine] Error type:", typeof error);
        console.error("[AudioEngine] Error message:", error instanceof Error ? error.message : String(error));
        console.error("[AudioEngine] Error stack:", error instanceof Error ? error.stack : "No stack");
        // Set error state but don't throw - let playback continue with available players
        this.setState({ status: "error", error: { message: error instanceof Error ? error.message : String(error) } });
        // Still start polling and set playing so UI doesn't hang
        this.startPolling();
        this.setState({ status: "playing" });
      }
    });
  }
```

### 4.3 Mix Controls

**Default Mix:**
- Affirmations: 100% (1.0)
- Binaural: 30% (0.3)
- Background: 30% (0.3)

**Mix Adjustment (`setMix()`):**
- Updates mix levels with smooth ramping (via control loop)
- Preserves user adjustments when reloading sessions
- Supports immediate updates when not playing

**Voice Activity Ducking:**
- Uses `VoiceActivityDucker` to lower background/binaural during speech
- Based on voice activity segments from `metaJson`
- Applied in control loop (25ms tick)

### 4.4 Player Screen Integration

**Location:** `apps/mobile/src/screens/PlayerScreen.tsx`

**Flow:**
1. **Fetch bundle**: Calls `GET /sessions/:id/playback-bundle`
2. **Auto-load**: If bundle available, automatically calls `engine.load(bundle)`
3. **Auto-play**: If loaded and ready, automatically calls `engine.play()`
4. **Subscribe to state**: Updates UI based on `AudioEngineSnapshot`
5. **Mix controls**: Sliders update mix levels via `engine.setMix()`
6. **Error handling**: Shows "Generate Audio" button if audio not ready

**Code Reference:**
```126:204:apps/mobile/src/screens/PlayerScreen.tsx
  // Auto-load and auto-play when bundle data is available
  useEffect(() => {
    if (!data) {
      if (error?.message === "AUDIO_NOT_READY" && !isGenerating) {
        handleGenerateAudio();
      }
      return;
    }

    const currentSessionId = data.sessionId;
    const isNewSession = lastLoadedSessionId !== currentSessionId;
    const isDifferentSession = snapshot.sessionId !== currentSessionId;
    
    const needsLoad = isNewSession || isDifferentSession;

    if (needsLoad) {
      // Resolve bundled assets (binaural/background) to local URIs for faster loading
      (async () => {
        try {
          const { resolveBundledAsset } = await import("../lib/bundledAssets");
          const resolvedData = {
            ...data,
            background: {
              ...data.background,
              urlByPlatform: {
                ios: await resolveBundledAsset(
                  Platform.OS === "ios" ? data.background.urlByPlatform.ios : data.background.urlByPlatform.android,
                  "background"
                ),
                android: await resolveBundledAsset(
                  Platform.OS === "android" ? data.background.urlByPlatform.android : data.background.urlByPlatform.ios,
                  "background"
                ),
              },
            },
            binaural: {
              ...data.binaural,
              urlByPlatform: {
                ios: await resolveBundledAsset(
                  Platform.OS === "ios" ? data.binaural.urlByPlatform.ios : data.binaural.urlByPlatform.android,
                  "binaural"
                ),
                android: await resolveBundledAsset(
                  Platform.OS === "android" ? data.binaural.urlByPlatform.android : data.binaural.urlByPlatform.ios,
                  "binaural"
                ),
              },
            },
          };
          
          engine.load(resolvedData).then(() => {
            setLastLoadedSessionId(currentSessionId);
          }).catch((error) => {
            console.error("[PlayerScreen] ❌ Auto-load failed:", error);
          });
        } catch (resolveError) {
          console.warn("[PlayerScreen] Failed to resolve bundled assets, using original URLs:", resolveError);
          // Fallback to original bundle if resolution fails
          engine.load(data).then(() => {
            setLastLoadedSessionId(currentSessionId);
          }).catch((error) => {
            console.error("[PlayerScreen] ❌ Auto-load failed:", error);
          });
        }
      })();
      return;
    }
    
    if (status === "ready" && 
        snapshot.sessionId === currentSessionId && 
        lastLoadedSessionId === currentSessionId &&
        snapshot.status !== "playing") {
      const timer = setTimeout(() => {
        engine.play().catch((error) => {
          console.error("[PlayerScreen] Auto-play failed:", error);
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, error, status, engine, lastLoadedSessionId, snapshot.sessionId, snapshot.status, isGenerating]);
```

---

## Key Design Decisions

### V3 Compliance (from `Loop-and-delivery.md`)

1. **Infinite Looping**: All sessions loop infinitely (no duration slider)
2. **Single Pace**: Always "slow" (locked, not configurable)
3. **Dual Read Pattern**: Each affirmation spoken twice with variation, silence after second read
4. **Pre-roll Atmosphere**: Starts within 100-300ms, crossfades to main mix
5. **3-Track Model**: Affirmations, Binaural, Background (all loop independently)

### Caching Strategy

1. **TTS Chunks**: Cached by hash (voiceId:pace:text:variant:VERSION)
2. **Merged Audio**: Cached by hash of all chunks + version
3. **Silence Chunks**: Pre-generated during seed (100ms-10s range)
4. **S3 Storage**: Uploaded after generation for CDN delivery

### Error Handling

1. **Graceful Degradation**: If one player fails, others continue
2. **Retry Logic**: Automatic retries for TTS generation (temperature adjustment)
3. **Fallback TTS**: Beep TTS if ElevenLabs not configured
4. **Buffering Recovery**: Automatic restart if players stop due to buffering

---

## Data Flow Summary

```
User creates session
  ↓
Session saved to DB (no affirmations yet)
  ↓
POST /sessions/:id/ensure-audio
  ↓
Job queue: processEnsureAudioJob()
  ↓
Generate affirmations (if missing)
  ├─ Extract user values, struggle, session type
  ├─ Call OpenAI with prompt caching
  ├─ Validate output
  └─ Save to SessionAffirmation table
  ↓
Generate TTS chunks for each affirmation
  ├─ Variant 1 (neutral) + Variant 2 (variation)
  ├─ Cache by hash
  └─ Store in AudioAsset table
  ↓
Stitch audio chunks
  ├─ [Read 1] → [1.5s silence] → [Read 2] → [4s silence] → [Next]
  ├─ Apply loudness normalization (-20 LUFS)
  ├─ Generate voice activity segments
  └─ Upload to S3 (if configured)
  ↓
Link to Session via SessionAudio table
  ↓
GET /sessions/:id/playback-bundle
  ├─ Fetch session with audio relationship
  ├─ Resolve binaural/background assets
  ├─ Construct affirmations URL (S3 or local)
  └─ Return PlaybackBundleVM
  ↓
Mobile app: engine.load(bundle)
  ├─ Create 3 players (aff, bin, bg)
  ├─ Set loop=true
  └─ Apply mix levels
  ↓
Mobile app: engine.play()
  ├─ Start pre-roll (if idle)
  ├─ Rolling start sequence
  ├─ Start control loop (mix automation, ducking)
  └─ Start position polling (UI updates)
  ↓
Continuous playback (infinite loop)
```

---

## Files Reference

**Affirmation Generation:**
- `apps/api/src/services/affirmation-generator.ts` - Core generation service
- `apps/api/src/prompts/affirmations.generator.v2.txt` - Prompt template
- `Brain/affirmation_rules.md` - Neuroscience-based rules

**Audio Generation:**
- `apps/api/src/services/audio/generation.ts` - TTS, stitching, job processing
- `apps/api/src/services/audio/tts.ts` - TTS provider abstraction
- `apps/api/src/services/audio/stitching.ts` - FFmpeg audio stitching
- `apps/api/src/services/audio/loudness.ts` - Loudness measurement
- `apps/api/src/services/audio/voiceActivity.ts` - Voice activity detection

**Player:**
- `packages/audio-engine/src/AudioEngine.ts` - Main engine singleton
- `packages/audio-engine/src/MixerController.ts` - Mix automation, crossfade
- `packages/audio-engine/src/PrerollManager.ts` - Pre-roll atmosphere
- `packages/audio-engine/src/PlayerManager.ts` - Player lifecycle
- `apps/mobile/src/screens/PlayerScreen.tsx` - Player UI

**API:**
- `apps/api/src/index.ts` - API routes (playback-bundle, ensure-audio)
- `packages/contracts/src/schemas.ts` - Zod schemas (PlaybackBundleVM, SessionV3)

---

**Last Updated:** 2025-01-14

