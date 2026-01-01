/**
 * Loudness measurement utilities
 * Uses FFmpeg to measure LUFS (Loudness Units relative to Full Scale)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs-extra";

const execFileAsync = promisify(execFile);

export interface LoudnessMeasurement {
    input_i: number;      // Integrated loudness (LUFS)
    input_tp: number;    // True peak (dB)
    input_lra: number;   // Loudness range (LU)
}

/**
 * Measure loudness of an audio file using FFmpeg's loudnorm filter
 * Returns LUFS (integrated loudness) and other metrics
 */
export async function measureLoudness(filePath: string): Promise<LoudnessMeasurement | null> {
    if (!ffmpegStatic) {
        console.warn("[Loudness] FFmpeg not available, skipping loudness measurement");
        return null;
    }

    if (!(await fs.pathExists(filePath))) {
        console.warn(`[Loudness] File not found: ${filePath}`);
        return null;
    }

    try {
        // Use FFmpeg's loudnorm filter in first pass to analyze
        // This runs the filter but doesn't output a file (we just want the stats)
        const { stdout, stderr } = await execFileAsync(ffmpegStatic, [
            "-i", filePath,
            "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
            "-f", "null",
            "-"
        ], {
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
        });

        // FFmpeg outputs JSON to stderr when using print_format=json
        const output = stderr || stdout;
        
        // Extract JSON from output (may be mixed with other logs)
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.warn("[Loudness] Could not extract JSON from FFmpeg output");
            return null;
        }

        const result = JSON.parse(jsonMatch[0]);
        
        // Extract the measurement values
        // FFmpeg loudnorm outputs both "input" and "output" sections
        // We want the "input" section which contains the measured values
        const input = result.input_i !== undefined ? {
            input_i: parseFloat(result.input_i) || 0,
            input_tp: parseFloat(result.input_tp) || 0,
            input_lra: parseFloat(result.input_lra) || 0,
        } : null;

        if (!input) {
            console.warn("[Loudness] Could not parse loudness measurement from FFmpeg output");
            return null;
        }

        console.log(`[Loudness] Measured: LUFS=${input.input_i.toFixed(2)}, TP=${input.input_tp.toFixed(2)}, LRA=${input.input_lra.toFixed(2)}`);
        return input;
    } catch (error: any) {
        console.error(`[Loudness] Failed to measure loudness for ${filePath}:`, error.message);
        return null;
    }
}
