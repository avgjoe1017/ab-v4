/**
 * Voice Activity Detection
 * Uses FFmpeg silencedetect to identify speech segments
 */

import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs-extra";

const execFileAsync = promisify(execFile);

export interface VoiceActivitySegment {
    startMs: number;
    endMs: number;
}

export interface VoiceActivityResult {
    segments: VoiceActivitySegment[];
    thresholdDb?: number;
    minSilenceMs?: number;
}

/**
 * Generate voice activity segments using FFmpeg silencedetect
 * Inverts silence windows into speech windows
 */
export async function generateVoiceActivitySegments(
    filePath: string,
    thresholdDb: number = -35,
    minSilenceMs: number = 200
): Promise<VoiceActivityResult> {
    if (!ffmpegStatic) {
        console.warn("[VoiceActivity] FFmpeg not available, skipping voice activity detection");
        return { segments: [], thresholdDb, minSilenceMs };
    }

    if (!(await fs.pathExists(filePath))) {
        console.warn(`[VoiceActivity] File not found: ${filePath}`);
        return { segments: [], thresholdDb, minSilenceMs };
    }

    try {
        // Run silencedetect
        const { stderr } = await execFileAsync(ffmpegStatic, [
            "-i", filePath,
            "-af", `silencedetect=noise=${thresholdDb}dB:d=${minSilenceMs / 1000}`,
            "-f", "null",
            "-"
        ], {
            maxBuffer: 10 * 1024 * 1024,
        });

        // Parse silence windows from stderr
        const silenceWindows: Array<{ start: number; end: number }> = [];
        const silenceStartRegex = /silence_start: ([\d.]+)/g;
        const silenceEndRegex = /silence_end: ([\d.]+)/g;

        let match;
        while ((match = silenceStartRegex.exec(stderr)) !== null) {
            const matchValue = match[1];
            if (!matchValue) continue;
            const start = parseFloat(matchValue) * 1000; // Convert to ms
            silenceWindows.push({ start, end: Infinity });
        }

        let endIndex = 0;
        while ((match = silenceEndRegex.exec(stderr)) !== null && endIndex < silenceWindows.length) {
            const matchValue = match[1];
            if (!matchValue) {
                // Skip invalid match without incrementing endIndex
                // This allows the next valid match to pair with the current window
                continue;
            }
            const end = parseFloat(matchValue) * 1000; // Convert to ms
            // Find the next unclosed silence window
            while (endIndex < silenceWindows.length) {
                const window = silenceWindows[endIndex];
                if (window && window.end !== Infinity) {
                    endIndex++;
                } else {
                    break;
                }
            }
            if (endIndex < silenceWindows.length) {
                const window = silenceWindows[endIndex];
                if (window) {
                    window.end = end;
                }
            }
            endIndex++;
        }

        // Get file duration to close any unclosed silence windows
        const durationMatch = stderr.match(/Duration: ([\d:]+\.\d+)/);
        let fileDurationMs = Infinity;
        if (durationMatch?.[1]) {
            const timeParts = durationMatch[1].split(":");
            if (timeParts.length >= 3 && timeParts[0] && timeParts[1] && timeParts[2]) {
                fileDurationMs = 
                    parseFloat(timeParts[0]) * 3600000 +
                    parseFloat(timeParts[1]) * 60000 +
                    parseFloat(timeParts[2]) * 1000;
            }
        }

        // Close any unclosed silence windows at file end
        for (const window of silenceWindows) {
            if (window.end === Infinity) {
                window.end = fileDurationMs;
            }
        }

        // Invert silence windows into speech segments
        const speechSegments: VoiceActivitySegment[] = [];
        let currentPos = 0;

        // Sort silence windows by start time
        silenceWindows.sort((a, b) => a.start - b.start);

        for (const silence of silenceWindows) {
            // If there's a gap before this silence, it's speech
            if (silence.start > currentPos + 120) { // Min 120ms segment
                speechSegments.push({
                    startMs: Math.round(currentPos),
                    endMs: Math.round(silence.start),
                });
            }
            currentPos = Math.max(currentPos, silence.end);
        }

        // If there's remaining time after last silence, it's speech
        if (currentPos < fileDurationMs - 120) {
            speechSegments.push({
                startMs: Math.round(currentPos),
                endMs: Math.round(fileDurationMs),
            });
        }

        // Filter out very short segments (< 120ms)
        const filteredSegments = speechSegments.filter(s => (s.endMs - s.startMs) >= 120);

        console.log(`[VoiceActivity] Detected ${filteredSegments.length} speech segments`);
        return {
            segments: filteredSegments,
            thresholdDb,
            minSilenceMs,
        };
    } catch (error: any) {
        console.error(`[VoiceActivity] Failed to detect voice activity for ${filePath}:`, error.message);
        return { segments: [], thresholdDb, minSilenceMs };
    }
}
