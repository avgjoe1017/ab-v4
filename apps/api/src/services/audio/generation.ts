import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import ffmpegStatic from "ffmpeg-static";
import { AUDIO_PROFILE_V3 } from "@ab/contracts"; // Constants export might need adjustment if not direct
import { stitchAudioFiles } from "./stitching";
import { CHUNKS_DIR, SILENCE_DURATIONS_MS } from "./constants";
import { execFile } from "child_process";
import { promisify } from "util";
import { generateTTSAudio } from "./tts";
import { measureLoudness } from "./loudness";
import { generateVoiceActivitySegments } from "./voiceActivity";
import { generateAffirmations } from "../affirmation-generator";
import { uploadToS3, generateS3Key, isS3Configured } from "../storage/s3";
import { getAudioMetadata, calculateFileChecksum } from "./metadata";
import { moderateAffirmation } from "../moderation";
const execFileAsync = promisify(execFile);

// Temporary fix for simple imports if contracts export isn't fully set up with types in this context
// We'll rely on our local constants if needed, but try contracts first.

import { prisma } from "../../lib/db";

// Set path again here to be safe (or import from stitching if exported, but safer to set)


// Helper to calculate hash
function hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
}

async function ensureDirectory(dir: string) {
    await fs.ensureDir(dir);
}

/**
 * V3 Compliance: Pre-generate silence chunks during seed.
 * This function is only called during seed/migration, never during runtime.
 */
export async function generateSilenceFile(filePath: string, durationMs: number) {
    if (!ffmpegStatic) throw new Error("ffmpeg-static not found");
    const durationSec = durationMs / 1000;

    await execFileAsync(ffmpegStatic, [
        "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-t", durationSec.toString(),
        "-c:a", "libmp3lame",
        "-b:a", "128k",
        "-y", // Overwrite
        filePath
    ]);
}

/**
 * Pre-generate all silence chunks as per V3 spec.
 * Call this during seed/migration, not during runtime.
 */
export async function pregenerateSilenceChunks(): Promise<void> {
    console.log("🔇 Pre-generating silence chunks (V3 compliance)...");
    await ensureDirectory(CHUNKS_DIR);

    for (const durationMs of SILENCE_DURATIONS_MS) {
        const hash = `silence_${durationMs}`;
        const filename = `${hash}.mp3`;
        const filePath = path.join(CHUNKS_DIR, filename);

        // Check if already exists
        const existing = await prisma.audioAsset.findUnique({
            where: { kind_hash: { kind: "silence", hash } },
        });

        if (existing && await fs.pathExists(existing.url)) {
            console.log(`  ✓ Silence ${durationMs}ms already exists`);
            continue;
        }

        // Generate if missing
        if (!(await fs.pathExists(filePath))) {
            console.log(`  Generating silence ${durationMs}ms...`);
            await generateSilenceFile(filePath, durationMs);
        }

        // Save to DB
        await prisma.audioAsset.upsert({
            where: { kind_hash: { kind: "silence", hash } },
            update: { url: filePath },
            create: {
                kind: "silence",
                hash,
                url: filePath,
            },
        });

        console.log(`  ✓ Silence ${durationMs}ms ready`);
    }

    console.log("✅ All silence chunks pre-generated");
}

/**
 * Result of affirmation chunk generation
 * Includes optional timestamp data for voice activity detection (skips FFmpeg silencedetect)
 */
export interface AffirmationChunkResult {
    hash: string;
    url: string;
    /** Duration of this chunk in milliseconds */
    durationMs?: number;
    /** Voice activity timestamps (when TTS provider supports them) */
    timestamps?: Array<{ startMs: number; endMs: number }>;
    /** Whether TTS provided timestamps (vs needing FFmpeg fallback) */
    hasTimestamps?: boolean;
}

/**
 * Ensure affirmation chunk exists, return hash, URL, and optional timestamp data
 * Hash is stable across environments (not based on file paths)
 * 
 * When using ElevenLabs with timestamps, voice activity segments are extracted
 * directly from TTS response - no FFmpeg silencedetect needed.
 */
export async function ensureAffirmationChunk(
    text: string,
    voiceId: string,
    pace: string,
    variant: number = 1
): Promise<AffirmationChunkResult> {
    // 1. Calc Hash (variant included) - this is stable across environments
    const hash = hashContent(`${voiceId}:${pace}:${text}:${variant}:${AUDIO_PROFILE_V3.VERSION}`);
    const filename = `${hash}.mp3`;
    const filePath = path.join(CHUNKS_DIR, filename);

    // 2. Check DB / File (including cached timestamp data)
    const existing = await prisma.audioAsset.findUnique({
        where: { kind_hash: { kind: "affirmationChunk", hash } },
    });

    if (existing && (await fs.pathExists(existing.url))) {
        // Try to extract cached timestamp data from metaJson
        let cachedTimestamps: AffirmationChunkResult | undefined;
        if (existing.metaJson) {
            try {
                const meta = JSON.parse(existing.metaJson);
                cachedTimestamps = {
                    hash,
                    url: existing.url,
                    durationMs: meta.durationMs,
                    timestamps: meta.timestamps,
                    hasTimestamps: meta.hasTimestamps,
                };
            } catch {
                // Ignore parse errors
            }
        }
        return cachedTimestamps || { hash, url: existing.url };
    }

    // 3. Generate using TTS service (falls back to beep if TTS not configured)
    await ensureDirectory(CHUNKS_DIR);

    let ttsResult: { durationMs: number; timestamps?: Array<{ startMs: number; endMs: number }>; hasTimestamps: boolean } | undefined;

    if (!(await fs.pathExists(filePath))) {
        const provider = process.env.TTS_PROVIDER?.toLowerCase() || "beep";
        console.log(`[TTS] Generating affirmation chunk (v${variant}) using provider: ${provider}`);
        console.log(`[TTS] Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        try {
            ttsResult = await generateTTSAudio(
                { text, voiceId, pace, variant },
                filePath
            );
            console.log(`[TTS] ✅ Audio generated successfully: ${filename} (timestamps: ${ttsResult.hasTimestamps})`);
        } catch (error) {
            console.error(`[TTS] ❌ Failed to generate audio for ${filename}:`, error);
            throw error; // Re-throw to let caller handle
        }
    } else {
        console.log(`[TTS] Using cached audio: ${filename}`);
        // Try to load cached timestamp metadata from DB
        const cached = await prisma.audioAsset.findUnique({
            where: { kind_hash: { kind: "affirmationChunk", hash } },
        });
        if (cached?.metaJson) {
            try {
                const meta = JSON.parse(cached.metaJson);
                ttsResult = {
                    durationMs: meta.durationMs,
                    timestamps: meta.timestamps,
                    hasTimestamps: meta.hasTimestamps,
                };
            } catch {
                // Ignore parse errors - will use undefined (no timestamps)
            }
        }
    }

    // 4. Save to DB with timestamp metadata
    const metaJson = ttsResult ? JSON.stringify({
        durationMs: ttsResult.durationMs,
        timestamps: ttsResult.timestamps,
        hasTimestamps: ttsResult.hasTimestamps,
    }) : undefined;

    await prisma.audioAsset.upsert({
        where: { kind_hash: { kind: "affirmationChunk", hash } },
        update: { url: filePath, metaJson },
        create: {
            kind: "affirmationChunk",
            hash,
            url: filePath,
            metaJson,
        },
    });

    return {
        hash,
        url: filePath,
        durationMs: ttsResult?.durationMs,
        timestamps: ttsResult?.timestamps,
        hasTimestamps: ttsResult?.hasTimestamps,
    };
}

/**
 * V3 Compliance: Silence must be pre-generated, never generated dynamically.
 * This function only retrieves pre-generated silence chunks and composes them if needed.
 */
/**
 * Ensure silence chunk exists, return both hash and URL
 * Hash is stable across environments
 */
export async function ensureSilence(durationMs: number): Promise<{ hash: string; url: string }> {
    // Quantize to nearest pre-generated duration
    const quantizedDuration = Math.max(100, Math.round(durationMs / 100) * 100);
    
    // Check if we have an exact match in pre-generated chunks
    const hash = `silence_${quantizedDuration}`;
    const exactAsset = await prisma.audioAsset.findUnique({
        where: { kind_hash: { kind: "silence", hash } },
    });

    if (exactAsset && await fs.pathExists(exactAsset.url)) {
        return { hash, url: exactAsset.url };
    }

    // If no exact match, find the largest pre-generated chunk that fits
    // and compose multiple chunks if needed
    const availableDurations = SILENCE_DURATIONS_MS.filter(d => d <= quantizedDuration).sort((a, b) => b - a);
    
    if (availableDurations.length === 0) {
        throw new Error(`No pre-generated silence chunks available for ${quantizedDuration}ms. Run seed to generate chunks.`);
    }

    // Use the largest available chunk that fits
    const useDuration = availableDurations[0]!; // Safe: we checked length above
    const useHash = `silence_${useDuration}`;
    const useAsset = await prisma.audioAsset.findUnique({
        where: { kind_hash: { kind: "silence", hash: useHash } },
    });

    if (!useAsset || !(await fs.pathExists(useAsset.url))) {
        throw new Error(`Pre-generated silence chunk ${useHash} not found. Run seed to generate chunks.`);
    }

    // If we need more than one chunk, compose them
    if (quantizedDuration > useDuration) {
        const chunksNeeded = Math.ceil(quantizedDuration / useDuration);
        const filePaths: string[] = [];
        
        for (let i = 0; i < chunksNeeded; i++) {
            filePaths.push(useAsset.url);
        }

        // Stitch multiple chunks together
        const composedHash = `silence_composed_${quantizedDuration}_from_${useDuration}x${chunksNeeded}`;
        const composedPath = path.join(CHUNKS_DIR, `${composedHash}.mp3`);
        
        // Check if composed version already exists
        const existingComposed = await prisma.audioAsset.findUnique({
            where: { kind_hash: { kind: "silence", hash: composedHash } },
        });

        if (existingComposed && await fs.pathExists(existingComposed.url)) {
            return existingComposed.url;
        }

        // Stitch the chunks
        await ensureDirectory(CHUNKS_DIR);
        const stitchedPath = await stitchAudioFiles(filePaths, composedHash);
        
        // Save composed chunk
        await prisma.audioAsset.upsert({
            where: { kind_hash: { kind: "silence", hash: composedHash } },
            update: { url: stitchedPath },
            create: {
                kind: "silence",
                hash: composedHash,
                url: stitchedPath,
            },
        });

        return { hash: composedHash, url: stitchedPath };
    }

    return { hash: useHash, url: useAsset.url };
}

const SILENCE_BETWEEN_READS_MS = 1500; // 1.5 seconds of silence between first and second read of same phrase
const FIXED_SILENCE_MS = 4000; // 4 seconds of silence after second read, before next phrase

export async function processEnsureAudioJob(payload: { sessionId: string }) {
    const { sessionId } = payload;
    console.log(`Processing audio for session ${sessionId}`);

    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { 
            affirmations: { orderBy: { idx: "asc" } },
            ownerUser: true, // Only need user for struggle, not values
        },
    });

    if (!session) throw new Error("Session not found");

    // Phase 1.1: Generate affirmations if they don't exist
    if (!session.affirmations || session.affirmations.length === 0) {
        console.log(`[Audio] No affirmations found, generating with AI...`);
        
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
                sessionType,
                struggle: userStruggle,
                count: 4, // Default to 4 affirmations
            });

            // Save affirmations to database with moderation check
            const affirmationData = await Promise.all(
                generated.affirmations.map(async (text, idx) => {
                    // Run moderation check
                    const moderation = await moderateAffirmation(text);
                    return {
                        sessionId: session.id,
                        idx,
                        text,
                        moderationStatus: moderation.shouldFlag ? "flagged" : "pending",
                        moderationReason: moderation.reason,
                        autoFlagged: moderation.autoFlagged,
                    };
                })
            );

            await prisma.sessionAffirmation.createMany({
                data: affirmationData,
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

    // OPTIMIZATION: Pre-fetch silence chunks ONCE before the loop
    // These only use two fixed durations, so we avoid repeated DB lookups
    console.log(`[Audio] Pre-fetching silence chunks (1x lookup per duration)...`);
    const [silenceBetweenReads, silenceAfterRead] = await Promise.all([
        ensureSilence(SILENCE_BETWEEN_READS_MS),  // 1500ms - fetched once
        ensureSilence(FIXED_SILENCE_MS),           // 4000ms - fetched once
    ]);
    
    // 1. Build list of required chunks (parallelize TTS generation only)
    // Silence chunks are now pre-fetched, so we just need to generate affirmation TTS
    type ChunkTask = { type: "affirmation"; text: string; variant: number };
    
    const chunkTasks: ChunkTask[] = [];
    // Force pace to "slow" regardless of DB (Migration safety)
    const effectivePace = "slow";

    // Build affirmation tasks only - silence will be interleaved after
    for (const aff of session.affirmations) {
        chunkTasks.push({ type: "affirmation", text: aff.text, variant: 1 });
        chunkTasks.push({ type: "affirmation", text: aff.text, variant: 2 });
    }

    // 2. Generate TTS chunks in parallel with concurrency limit
    // This is where most of the time is spent (network calls to ElevenLabs/OpenAI)
    // NOTE: ElevenLabs free tier allows max 3 concurrent requests - use 2 to stay safe
    const CONCURRENCY_LIMIT = 2;
    const affirmationChunks: AffirmationChunkResult[] = [];
    
    // Process TTS chunks in batches (no silence in the batch - already fetched)
    for (let i = 0; i < chunkTasks.length; i += CONCURRENCY_LIMIT) {
        const batch = chunkTasks.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.all(
            batch.map(task => ensureAffirmationChunk(task.text, session.voiceId, effectivePace, task.variant))
        );
        affirmationChunks.push(...batchResults);
    }
    
    // Check if we have timestamps from TTS (avoids FFmpeg silencedetect)
    const hasAllTimestamps = affirmationChunks.every(c => c.hasTimestamps === true);
    console.log(`[Audio] TTS timestamps available: ${hasAllTimestamps ? 'YES (skipping FFmpeg)' : 'NO (FFmpeg fallback)'}`);
    
    // Collect TTS timestamps for merged voice activity (if all chunks have them)
    let ttsVoiceActivity: { segments: Array<{ startMs: number; endMs: number }> } | null = null;
    if (hasAllTimestamps) {
        // Build voice activity from TTS timestamps
        // Account for silence durations between chunks
        const segments: Array<{ startMs: number; endMs: number }> = [];
        let currentOffset = 0;
        
        for (let i = 0; i < affirmationChunks.length; i += 2) {
            const variant1 = affirmationChunks[i];
            const variant2 = affirmationChunks[i + 1];
            
            // Variant 1 timestamps (offset by current position)
            if (variant1?.timestamps) {
                for (const ts of variant1.timestamps) {
                    segments.push({
                        startMs: currentOffset + ts.startMs,
                        endMs: currentOffset + ts.endMs,
                    });
                }
            }
            currentOffset += variant1?.durationMs || 0;
            
            // Add silence between reads
            currentOffset += SILENCE_BETWEEN_READS_MS;
            
            // Variant 2 timestamps (offset by current position)
            if (variant2?.timestamps) {
                for (const ts of variant2.timestamps) {
                    segments.push({
                        startMs: currentOffset + ts.startMs,
                        endMs: currentOffset + ts.endMs,
                    });
                }
            }
            currentOffset += variant2?.durationMs || 0;
            
            // Add silence after read
            currentOffset += FIXED_SILENCE_MS;
        }
        
        if (segments.length > 0) {
            ttsVoiceActivity = { segments };
            console.log(`[Audio] Built voice activity from TTS timestamps: ${segments.length} segments`);
        }
    }
    
    // 3. Interleave silence chunks with affirmation chunks
    // Pattern: [variant1, silence_1500, variant2, silence_4000, variant1, silence_1500, ...]
    const chunkData: Array<{ hash: string; url: string }> = [];
    for (let i = 0; i < affirmationChunks.length; i += 2) {
        // Variant 1
        chunkData.push(affirmationChunks[i]!);
        // Silence between reads (1500ms)
        chunkData.push(silenceBetweenReads);
        // Variant 2
        if (affirmationChunks[i + 1]) {
            chunkData.push(affirmationChunks[i + 1]!);
        }
        // Silence after read (4000ms)
        chunkData.push(silenceAfterRead);
    }

    // 3. Build file paths from chunk data
    const filePaths = chunkData.map(c => c.url);

    // 2. Stitch
    // Calculate merged hash from chunk hashes + sequence + parameters (stable across environments)
    const chunkHashesString = chunkData.map(c => c.hash).join("|");
    const mergedHash = hashContent(`${chunkHashesString}|${AUDIO_PROFILE_V3.VERSION}`);

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
                    // Use m4a container and audio/mp4 content type per AUDIO_PROFILE_V3
                    const s3Key = generateS3Key("affirmationMerged", mergedHash, AUDIO_PROFILE_V3.CONTAINER);
                    const s3Url = await uploadToS3(existingMerged.url, {
                        key: s3Key,
                        contentType: "audio/mp4", // AAC in M4A container
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
        // OPTIMIZATION: Use TTS timestamps if available (skips FFmpeg silencedetect)
        let voiceActivity: { segments: Array<{ startMs: number; endMs: number }> };
        if (ttsVoiceActivity && ttsVoiceActivity.segments.length > 0) {
            console.log(`[Audio] Using TTS-based voice activity (${ttsVoiceActivity.segments.length} segments, FFmpeg skipped)`);
            voiceActivity = ttsVoiceActivity;
        } else {
            console.log(`[Audio] Generating voice activity segments via FFmpeg silencedetect...`);
            voiceActivity = await generateVoiceActivitySegments(mergedPath);
        }
        
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
                // Use m4a container and audio/mp4 content type per AUDIO_PROFILE_V3
                const s3Key = generateS3Key("affirmationMerged", mergedHash, AUDIO_PROFILE_V3.CONTAINER);
                const s3Url = await uploadToS3(mergedPath, {
                    key: s3Key,
                    contentType: "audio/mp4", // AAC in M4A container
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
    const sessionAudio = await prisma.sessionAudio.upsert({
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

    // 4. Record SessionAudioAsset entries for tracking
    try {
        // Record individual affirmation line audio chunks
        for (let i = 0; i < session.affirmations.length; i++) {
            const aff = session.affirmations[i];
            const chunk1 = affirmationChunks[i * 2];
            const chunk2 = affirmationChunks[i * 2 + 1];
            
            if (chunk1?.url) {
                const metadata = await getAudioMetadata(chunk1.url);
                const checksum = await calculateFileChecksum(chunk1.url);
                
                // Find the AudioAsset for this chunk
                const chunkHash = hashContent(`${session.voiceId}:${effectivePace}:${aff.text}:1:${AUDIO_PROFILE_V3.VERSION}`);
                const audioAsset = await prisma.audioAsset.findUnique({
                    where: { kind_hash: { kind: "affirmationChunk", hash: chunkHash } },
                });
                
                const storageKey = chunk1.url.startsWith("http") ? new URL(chunk1.url).pathname : chunk1.url;
                
                await prisma.sessionAudioAsset.create({
                    data: {
                        sessionId,
                        kind: "affirmation_line",
                        lineIndex: i,
                        storageKey,
                        audioAssetId: audioAsset?.id,
                        durationMs: metadata.durationMs || chunk1.durationMs,
                        codec: metadata.codec || "aac",
                        sampleRate: metadata.sampleRate || 44100,
                        channels: metadata.channels || 2,
                        fileSize: metadata.fileSize,
                        checksum,
                    },
                }).catch(() => {
                    // Ignore duplicate errors (idempotent)
                });
            }
            
            if (chunk2?.url) {
                const metadata = await getAudioMetadata(chunk2.url);
                const checksum = await calculateFileChecksum(chunk2.url);
                
                const chunkHash = hashContent(`${session.voiceId}:${effectivePace}:${aff.text}:2:${AUDIO_PROFILE_V3.VERSION}`);
                const audioAsset = await prisma.audioAsset.findUnique({
                    where: { kind_hash: { kind: "affirmationChunk", hash: chunkHash } },
                });
                
                const storageKey = chunk2.url.startsWith("http") ? new URL(chunk2.url).pathname : chunk2.url;
                
                await prisma.sessionAudioAsset.create({
                    data: {
                        sessionId,
                        kind: "affirmation_line",
                        lineIndex: i,
                        storageKey,
                        audioAssetId: audioAsset?.id,
                        durationMs: metadata.durationMs || chunk2.durationMs,
                        codec: metadata.codec || "aac",
                        sampleRate: metadata.sampleRate || 44100,
                        channels: metadata.channels || 2,
                        fileSize: metadata.fileSize,
                        checksum,
                    },
                }).catch(() => {
                    // Ignore duplicate errors (idempotent)
                });
            }
        }
        
        // Record the final merged audio
        const mergedMetadata = await getAudioMetadata(mergedPath);
        const mergedChecksum = await calculateFileChecksum(mergedPath);
        const mergedStorageKey = mergedPath.startsWith("http") ? new URL(mergedPath).pathname : mergedPath;
        
        await prisma.sessionAudioAsset.create({
            data: {
                sessionId,
                kind: "final_mix",
                storageKey: mergedStorageKey,
                audioAssetId: mergedAssetId,
                durationMs: mergedMetadata.durationMs,
                codec: mergedMetadata.codec || "aac",
                sampleRate: mergedMetadata.sampleRate || 44100,
                channels: mergedMetadata.channels || 2,
                fileSize: mergedMetadata.fileSize,
                checksum: mergedChecksum,
            },
        }).catch(() => {
            // Ignore duplicate errors (idempotent)
        });
        
        console.log(`[Audio] ✅ Recorded ${session.affirmations.length * 2} affirmation line assets + 1 final mix asset`);
    } catch (assetError: any) {
        // Don't fail the job if asset recording fails
        console.warn(`[Audio] ⚠️  Failed to record SessionAudioAsset entries: ${assetError.message}`);
    }

    return { mergedUrl: mergedPath, mergedAssetId };
}
