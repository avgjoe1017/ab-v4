/**
 * Text-to-Speech Service
 * Supports multiple TTS providers with fallback to beep generation
 */

import fs from "fs-extra";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";
import { CHUNKS_DIR } from "./constants";

const execFileAsync = promisify(execFile);

export type TTSProvider = "openai" | "elevenlabs" | "azure" | "beep";

export interface TTSOptions {
  text: string;
  voiceId: string;
  pace: string;
  variant: number; // 1 or 2 for prosody variation
}

/**
 * Voice activity segment from TTS timestamp data
 * Used for ducking (lowering background/binaural during speech)
 */
export interface TTSTimestamp {
  startMs: number;
  endMs: number;
}

/**
 * Result of TTS generation with optional timing data
 * When timestamps are available, we skip FFmpeg voice activity detection
 */
export interface TTSResult {
  /** Duration of the generated audio in milliseconds */
  durationMs: number;
  /** Voice activity segments (when TTS provider supports timestamps) */
  timestamps?: TTSTimestamp[];
  /** Whether timestamps were extracted from TTS (vs FFmpeg fallback needed) */
  hasTimestamps: boolean;
}

/**
 * Generate audio using the configured TTS provider
 * Falls back to beep generation if TTS is unavailable or fails
 * 
 * Returns TTSResult with optional timestamp data for voice activity detection.
 * When timestamps are available, we skip FFmpeg silencedetect entirely.
 */
export async function generateTTSAudio(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  const provider = getTTSProvider();
  console.log(`[TTS] Using provider: ${provider}`);

  try {
    switch (provider) {
      case "openai":
        console.log(`[TTS] Generating with OpenAI TTS...`);
        const openaiResult = await generateOpenAITTS(options, outputPath);
        console.log(`[TTS] ✅ OpenAI TTS generation complete`);
        return openaiResult;
      case "elevenlabs":
        console.log(`[TTS] Generating with ElevenLabs TTS (with timestamps)...`);
        const elevenResult = await generateElevenLabsTTSWithTimestamps(options, outputPath);
        console.log(`[TTS] ✅ ElevenLabs TTS generation complete (${elevenResult.hasTimestamps ? 'with' : 'without'} timestamps)`);
        return elevenResult;
      case "azure":
        console.log(`[TTS] Generating with Azure TTS...`);
        const azureResult = await generateAzureTTS(options, outputPath);
        console.log(`[TTS] ✅ Azure TTS generation complete`);
        return azureResult;
      case "beep":
      default:
        console.log(`[TTS] ⚠️  Using beep fallback (TTS not configured)`);
        console.log(`[TTS] To enable real TTS, add to root .env file:`);
        console.log(`[TTS]   TTS_PROVIDER=openai`);
        console.log(`[TTS]   OPENAI_API_KEY=sk-your-key-here`);
        return await generateBeepFallback(options, outputPath);
    }
  } catch (error) {
    console.error(`[TTS] ❌ ${provider} failed:`, error);
    console.warn(`[TTS] Falling back to beep generation`);
    return await generateBeepFallback(options, outputPath);
  }
}

/**
 * Get configured TTS provider from environment
 */
function getTTSProvider(): TTSProvider {
  const provider = process.env.TTS_PROVIDER?.toLowerCase();
  
  // Check if API keys are available
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return "openai";
  }
  if (provider === "elevenlabs" && process.env.ELEVENLABS_API_KEY) {
    return "elevenlabs";
  }
  if (provider === "azure" && process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    return "azure";
  }
  
  // Default to beep if no provider configured
  return "beep";
}

/**
 * Generate TTS audio using OpenAI API
 * OpenAI TTS supports natural voices with prosody control
 * Note: OpenAI TTS does not provide timestamps, so FFmpeg fallback is needed
 */
async function generateOpenAITTS(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // OpenAI TTS model and voice selection
  // Use calm, neutral voices suitable for affirmations
  const model = "tts-1"; // or "tts-1-hd" for higher quality (more expensive)
  const voice = mapVoiceIdToOpenAI(options.voiceId);
  
  // Adjust speed based on pace (slow = 0.75 for meditative, normal = 1.0, fast = 1.1)
  // V3 uses "slow" pace only, set to 0.75 for slower, more meditative delivery
  const speed = options.pace === "slow" ? 0.75 : options.pace === "fast" ? 1.1 : 1.0;
  
  // For variant 2, slightly adjust speed to create prosody variation
  const variantSpeed = options.variant === 2 ? speed * 1.02 : speed;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: options.text,
      voice,
      speed: variantSpeed, // Slight speed variation for variant 2
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS failed: ${response.status} ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(audioBuffer));

  // Convert to MP3 with FFmpeg to match V3 audio profile (128kbps, 44.1kHz)
  await convertToMP3(outputPath);
  
  // Get duration from the generated file
  const durationMs = await getAudioDurationMs(outputPath);
  
  // OpenAI TTS doesn't provide timestamps, so FFmpeg fallback is needed
  return {
    durationMs,
    hasTimestamps: false,
  };
}

/**
 * Map voiceId to OpenAI voice name
 * OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
 * Use calm, neutral voices for affirmations
 */
function mapVoiceIdToOpenAI(voiceId: string): string {
  // Default mapping - can be customized per voiceId
  const voiceMap: Record<string, string> = {
    "default": "nova", // Calm, neutral female voice
    "male": "onyx", // Calm, neutral male voice
    "female": "nova",
    "alloy": "alloy",
    "echo": "echo",
    "fable": "fable",
    "onyx": "onyx",
    "nova": "nova",
    "shimmer": "shimmer",
  };

  return voiceMap[voiceId.toLowerCase()] || "nova";
}

/**
 * Generate TTS audio using ElevenLabs API WITH TIMESTAMPS
 * Uses the "with-timestamps" endpoint to get word-level timing data.
 * This eliminates the need for FFmpeg voice activity detection.
 * 
 * ElevenLabs provides highly realistic voices with emotional control
 * Configured for slow, meditative, calming, ASMR-like delivery
 */
async function generateElevenLabsTTSWithTimestamps(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not configured");
  }

  // Map voiceId to ElevenLabs voice ID
  const voiceId = mapVoiceIdToElevenLabs(options.voiceId);
  
  // Meditative/ASMR settings: Lower stability = slower, more deliberate delivery
  // Lower similarity_boost = softer, more relaxed tone
  // These settings create a calming, ASMR-like quality with slower pacing
  // Reduced stability further for even slower, more meditative delivery
  // Variant 1: Slightly more stable for consistency
  // Variant 2: Slightly less stable for natural prosody variation
  const stability = options.variant === 1 ? 0.25 : 0.2;
  const similarityBoost = options.variant === 1 ? 0.5 : 0.45;

  // Use the "with-timestamps" endpoint to get word-level timing
  // API docs: https://elevenlabs.io/docs/api-reference/text-to-speech-with-timestamps
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: "eleven_monolingual_v1", // or "eleven_multilingual_v2" for multi-language
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0.0, // Neutral style for calm affirmations
          use_speaker_boost: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    // If timestamps endpoint fails, fall back to regular endpoint
    console.warn(`[TTS] ElevenLabs timestamps endpoint failed (${response.status}), falling back to standard API`);
    return await generateElevenLabsTTSFallback(options, outputPath);
  }

  // Response is JSON with base64 audio and alignment data
  const data = await response.json() as {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };

  // Decode and save audio
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');
  await fs.writeFile(outputPath, audioBuffer);

  // Convert to MP3 with FFmpeg
  await convertToMP3(outputPath);
  
  // Extract voice activity segments from character timing
  // Group contiguous speech into segments (gaps > 150ms = new segment)
  const timestamps = extractVoiceActivityFromAlignment(data.alignment);
  
  // Get total duration from the last character end time
  const charEndTimes = data.alignment.character_end_times_seconds;
  const durationMs = charEndTimes.length > 0 
    ? Math.round(charEndTimes[charEndTimes.length - 1]! * 1000)
    : await getAudioDurationMs(outputPath);

  console.log(`[TTS] Extracted ${timestamps.length} voice activity segments from ElevenLabs timestamps`);
  
  return {
    durationMs,
    timestamps,
    hasTimestamps: true,
  };
}

/**
 * Extract voice activity segments from ElevenLabs character alignment data
 * Groups contiguous characters into speech segments, splitting on gaps > 150ms
 */
function extractVoiceActivityFromAlignment(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): TTSTimestamp[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  
  if (characters.length === 0) return [];
  
  const segments: TTSTimestamp[] = [];
  let segmentStart = character_start_times_seconds[0]! * 1000;
  let segmentEnd = character_end_times_seconds[0]! * 1000;
  
  const GAP_THRESHOLD_MS = 150; // Gap > 150ms = new segment
  
  for (let i = 1; i < characters.length; i++) {
    const charStart = character_start_times_seconds[i]! * 1000;
    const charEnd = character_end_times_seconds[i]! * 1000;
    const gap = charStart - segmentEnd;
    
    // Skip whitespace-only gaps that are small
    const char = characters[i];
    if (char && /\s/.test(char) && gap < GAP_THRESHOLD_MS) {
      segmentEnd = charEnd;
      continue;
    }
    
    if (gap > GAP_THRESHOLD_MS) {
      // Close current segment and start new one
      if (segmentEnd - segmentStart >= 50) { // Min 50ms segment
        segments.push({
          startMs: Math.round(segmentStart),
          endMs: Math.round(segmentEnd),
        });
      }
      segmentStart = charStart;
    }
    
    segmentEnd = charEnd;
  }
  
  // Close final segment
  if (segmentEnd - segmentStart >= 50) {
    segments.push({
      startMs: Math.round(segmentStart),
      endMs: Math.round(segmentEnd),
    });
  }
  
  return segments;
}

/**
 * Fallback to standard ElevenLabs API (without timestamps)
 * Used when the with-timestamps endpoint is unavailable
 */
async function generateElevenLabsTTSFallback(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not configured");
  }

  const voiceId = mapVoiceIdToElevenLabs(options.voiceId);
  // Reduced stability for slower, more meditative delivery
  const stability = options.variant === 1 ? 0.25 : 0.2;
  const similarityBoost = options.variant === 1 ? 0.5 : 0.45;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: options.text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0.0,
          use_speaker_boost: false,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    const errorMessage = `ElevenLabs TTS failed: ${response.status} ${error}`;
    
    // If fallback also fails, don't throw - let the outer catch handle beep fallback
    // This prevents double fallback attempts
    console.error(`[TTS] ${errorMessage}`);
    throw new Error(errorMessage);
  }

  const audioBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(audioBuffer));
  await convertToMP3(outputPath);
  
  const durationMs = await getAudioDurationMs(outputPath);
  
  return {
    durationMs,
    hasTimestamps: false, // FFmpeg fallback needed
  };
}

/**
 * Map voiceId to ElevenLabs voice ID
 * Uses free tier default voices for meditative, calming delivery
 */
function mapVoiceIdToElevenLabs(voiceId: string): string {
  // ElevenLabs free tier default voices (meditative, calming, ASMR-like)
  // MALE default: xGDJhCwcqw94ypljc95Z
  // FEMALE default: KGZeK6FsnWQdrkDHnDNA
  const voiceMap: Record<string, string> = {
    "default": "KGZeK6FsnWQdrkDHnDNA", // Female default - free tier
    "male": "xGDJhCwcqw94ypljc95Z", // Male default - free tier
    "female": "KGZeK6FsnWQdrkDHnDNA", // Female default - free tier
    "alloy": "xGDJhCwcqw94ypljc95Z", // Male - calm, steady
    "onyx": "xGDJhCwcqw94ypljc95Z", // Male - strong, confident
    "shimmer": "KGZeK6FsnWQdrkDHnDNA", // Female - gentle, supportive
    "nova": "KGZeK6FsnWQdrkDHnDNA", // Female
    "echo": "xGDJhCwcqw94ypljc95Z", // Male
    "fable": "KGZeK6FsnWQdrkDHnDNA", // Female
  };

  return voiceMap[voiceId.toLowerCase()] || "KGZeK6FsnWQdrkDHnDNA";
}

/**
 * Generate TTS audio using Azure Cognitive Services
 * Azure provides neural voices with SSML support
 * Note: Azure TTS does not provide timestamps in this implementation
 */
async function generateAzureTTS(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  
  if (!apiKey || !region) {
    throw new Error("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be configured");
  }

  // Get access token
  const tokenResponse = await fetch(
    `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
    }
  );

  if (!tokenResponse.ok) {
    throw new Error(`Azure token request failed: ${tokenResponse.status}`);
  }

  const accessToken = await tokenResponse.text();
  const voice = mapVoiceIdToAzure(options.voiceId);
  
  // Adjust prosody for slower, meditative delivery
  // Lower rate = slower speech (0.75 = 75% speed for meditative pace)
  const prosodyRate = options.variant === 2 ? "0.77" : "0.75"; // Slower for meditative delivery

  // Use SSML for prosody control
  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${voice}">
        <prosody rate="${prosodyRate}">
          ${options.text}
        </prosody>
      </voice>
    </speak>
  `.trim();

  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure TTS failed: ${response.status} ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(audioBuffer));
  
  // Azure already returns MP3, but ensure it matches V3 profile
  await convertToMP3(outputPath);
  
  const durationMs = await getAudioDurationMs(outputPath);
  
  return {
    durationMs,
    hasTimestamps: false, // Azure doesn't provide timestamps in this implementation
  };
}

/**
 * Map voiceId to Azure voice name
 * Use calm, neutral neural voices
 */
function mapVoiceIdToAzure(voiceId: string): string {
  // Azure neural voices (calm, neutral)
  const voiceMap: Record<string, string> = {
    "default": "en-US-AriaNeural", // Calm, neutral female
    "male": "en-US-GuyNeural", // Calm, neutral male
    "female": "en-US-AriaNeural",
  };

  return voiceMap[voiceId.toLowerCase()] || "en-US-AriaNeural";
}

/**
 * Fallback: Generate beep file (original stub implementation)
 * Used when TTS is not configured or fails
 * Returns synthetic timestamps for the beep duration
 */
async function generateBeepFallback(
  options: TTSOptions,
  outputPath: string
): Promise<TTSResult> {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static not found");
  }

  // Variant 1 = 440Hz, Variant 2 = 444Hz (Micro-variation simulation)
  const freq = options.variant === 1 ? 440 : 444;
  const durationSec = 1.5;
  const durationMs = durationSec * 1000;

  await execFileAsync(ffmpegStatic, [
    "-f", "lavfi",
    "-i", `sine=f=${freq}:b=4`,
    "-t", durationSec.toString(),
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    "-ar", "44100",
    "-y",
    outputPath
  ]);
  
  // Beep is "always speaking" - return single segment covering full duration
  return {
    durationMs,
    timestamps: [{ startMs: 0, endMs: durationMs }],
    hasTimestamps: true, // Synthetic but deterministic
  };
}

/**
 * Get audio file duration in milliseconds using FFprobe
 */
async function getAudioDurationMs(filePath: string): Promise<number> {
  if (!ffmpegStatic) {
    return 0;
  }
  
  try {
    // Use ffprobe (bundled with ffmpeg-static) to get duration
    // FFprobe is usually at the same location as ffmpeg
    const ffprobePath = ffmpegStatic.replace(/ffmpeg(\.exe)?$/, 'ffprobe$1');
    
    // Try ffprobe first, fall back to ffmpeg with -i
    try {
      const { stdout } = await execFileAsync(ffprobePath, [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filePath
      ]);
      const durationSec = parseFloat(stdout.trim());
      if (!isNaN(durationSec)) {
        return Math.round(durationSec * 1000);
      }
    } catch {
      // ffprobe not available, use ffmpeg fallback
    }
    
    // Fallback: Use ffmpeg -i to get duration from stderr
    try {
      await execFileAsync(ffmpegStatic, ["-i", filePath, "-f", "null", "-"]);
    } catch (e: any) {
      // FFmpeg writes info to stderr even on "error"
      const stderr = e.stderr || "";
      const match = stderr.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match && match[1] && match[2] && match[3]) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
      }
    }
    
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Convert audio file to MP3 matching V3 audio profile
 * V3 Profile: MP3, 128kbps, 44.1kHz, stereo
 */
async function convertToMP3(inputPath: string): Promise<void> {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static not found");
  }

  // If input is already MP3 with correct format, skip conversion
  // Otherwise, convert to match V3 profile
  const tempPath = inputPath.replace(/\.(mp3|wav|m4a)$/, ".temp.mp3");
  
  try {
    await execFileAsync(ffmpegStatic, [
      "-i", inputPath,
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-ar", "44100",
      "-ac", "2", // Stereo
      "-y",
      tempPath
    ]);

    // Replace original with converted file
    await fs.move(tempPath, inputPath, { overwrite: true });
  } catch (error) {
    // If conversion fails, try to keep original
    if (await fs.pathExists(tempPath)) {
      await fs.remove(tempPath);
    }
    throw error;
  }
}
