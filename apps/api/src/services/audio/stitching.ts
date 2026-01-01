import { execFile } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs-extra";
import path from "path";
import { TEMP_DIR, MERGED_DIR } from "./constants";
import { AUDIO_PROFILE_V3 } from "@ab/contracts";

const execFileAsync = promisify(execFile);

/**
 * Stitch audio files with WAV→AAC pipeline for gapless playback
 * Follows Audio Experience Implementation Spec:
 * 1. Decode chunks to WAV 48k stereo
 * 2. Concatenate as PCM
 * 3. Normalize loudness (two-pass)
 * 4. Encode to AAC .m4a
 */
export async function stitchAudioFiles(
    filePaths: string[],
    outputId: string,
    options?: {
        targetLUFS?: number; // Target loudness (default: -20 for affirmations)
        targetTP?: number; // Target true peak (default: -1.5)
        addLoopPadding?: boolean; // Add 500ms prepend + 750ms append for loop crossfade
    }
): Promise<string> {
    if (!ffmpegStatic) throw new Error("ffmpeg-static not found");

    await fs.ensureDir(TEMP_DIR);
    await fs.ensureDir(MERGED_DIR);

    const targetLUFS = options?.targetLUFS ?? -20;
    const targetTP = options?.targetTP ?? -1.5;
    const addLoopPadding = options?.addLoopPadding ?? false;

    // Intermediate WAV file
    const wavPath = path.join(TEMP_DIR, `${outputId}.wav`);
    // Final AAC .m4a output
    const outputPath = path.join(MERGED_DIR, `${outputId}.${AUDIO_PROFILE_V3.CONTAINER}`);

    // Step 1: Create concat list file
    const listFileName = `list-${outputId}.txt`;
    const listFilePath = path.join(TEMP_DIR, listFileName);

    const fileContent = filePaths
        .map((p) => {
            const relPath = path.relative(TEMP_DIR, p);
            return `file '${relPath.replace(/\\/g, "/")}'`;
        })
        .join("\n");

    await fs.writeFile(listFilePath, fileContent);

    try {
        // Step 2: Decode and concatenate to WAV 48k stereo
        console.log(`[Stitching] Concatenating ${filePaths.length} chunks to WAV...`);
        await execFileAsync(ffmpegStatic, [
            "-f", "concat",
            "-safe", "0",
            "-i", listFilePath,
            "-ar", AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ.toString(),
            "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
            "-c:a", "pcm_s24le", // 24-bit PCM
            "-y",
            wavPath
        ]);

        // Step 3: Two-pass loudness normalization
        console.log(`[Stitching] Normalizing loudness to ${targetLUFS} LUFS...`);
        
        // Pass 1: Measure
        const { stderr: measureStderr } = await execFileAsync(ffmpegStatic, [
            "-i", wavPath,
            "-af", `loudnorm=I=${targetLUFS}:TP=${targetTP}:LRA=7:print_format=json`,
            "-f", "null",
            "-"
        ], { maxBuffer: 10 * 1024 * 1024 });

        // Extract measurement from stderr
        const jsonMatch = measureStderr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Failed to extract loudness measurement from FFmpeg");
        }
        const measurement = JSON.parse(jsonMatch[0]);
        
        // Pass 2: Apply normalization
        const normalizedWavPath = path.join(TEMP_DIR, `${outputId}_normalized.wav`);
        await execFileAsync(ffmpegStatic, [
            "-i", wavPath,
            "-af", `loudnorm=I=${targetLUFS}:TP=${targetTP}:LRA=7:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true:print_format=json`,
            "-ar", AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ.toString(),
            "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
            "-c:a", "pcm_s24le",
            "-y",
            normalizedWavPath
        ]);

        // Step 4: Add loop padding if requested (for affirmations)
        let finalWavPath = normalizedWavPath;
        if (addLoopPadding) {
            console.log(`[Stitching] Adding loop padding (500ms prepend, 750ms append)...`);
            const paddedWavPath = path.join(TEMP_DIR, `${outputId}_padded.wav`);
            
            // Generate room tone (very low-level noise)
            const prependTone = path.join(TEMP_DIR, `${outputId}_prepend.wav`);
            const appendTone = path.join(TEMP_DIR, `${outputId}_append.wav`);
            
            // Generate 500ms prepend tone
            await execFileAsync(ffmpegStatic, [
                "-f", "lavfi",
                "-i", `anullsrc=r=${AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ}:cl=stereo`,
                "-t", "0.5",
                "-ar", AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ.toString(),
                "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
                "-c:a", "pcm_s24le",
                "-af", "volume=-60dB", // Very quiet room tone
                "-y",
                prependTone
            ]);
            
            // Generate 750ms append tone
            await execFileAsync(ffmpegStatic, [
                "-f", "lavfi",
                "-i", `anullsrc=r=${AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ}:cl=stereo`,
                "-t", "0.75",
                "-ar", AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ.toString(),
                "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
                "-c:a", "pcm_s24le",
                "-af", "volume=-60dB", // Very quiet room tone
                "-y",
                appendTone
            ]);
            
            // Concatenate: prepend + normalized + append
            const paddingListPath = path.join(TEMP_DIR, `padding-${outputId}.txt`);
            await fs.writeFile(paddingListPath, [
                `file '${path.relative(TEMP_DIR, prependTone).replace(/\\/g, "/")}'`,
                `file '${path.relative(TEMP_DIR, normalizedWavPath).replace(/\\/g, "/")}'`,
                `file '${path.relative(TEMP_DIR, appendTone).replace(/\\/g, "/")}'`
            ].join("\n"));
            
            await execFileAsync(ffmpegStatic, [
                "-f", "concat",
                "-safe", "0",
                "-i", paddingListPath,
                "-ar", AUDIO_PROFILE_V3.INTERMEDIATE_SAMPLE_RATE_HZ.toString(),
                "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
                "-c:a", "pcm_s24le",
                "-y",
                paddedWavPath
            ]);
            
            finalWavPath = paddedWavPath;
            
            // Cleanup padding files
            await fs.remove(prependTone).catch(() => {});
            await fs.remove(appendTone).catch(() => {});
            await fs.remove(paddingListPath).catch(() => {});
        }

        // Step 5: Encode to AAC .m4a
        console.log(`[Stitching] Encoding to AAC .m4a...`);
        await execFileAsync(ffmpegStatic, [
            "-i", finalWavPath,
            "-c:a", "aac",
            "-b:a", `${AUDIO_PROFILE_V3.BITRATE_KBEPS}k`,
            "-ar", AUDIO_PROFILE_V3.SAMPLE_RATE_HZ.toString(),
            "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
            "-movflags", "+faststart", // Enable streaming
            "-y",
            outputPath
        ]);

        // Cleanup intermediate files
        await fs.remove(listFilePath).catch(console.error);
        await fs.remove(wavPath).catch(console.error);
        await fs.remove(normalizedWavPath).catch(console.error);
        if (finalWavPath !== normalizedWavPath) {
            await fs.remove(finalWavPath).catch(console.error);
        }

        console.log(`[Stitching] ✅ Complete: ${outputPath}`);
        return outputPath;
    } catch (err) {
        console.error("[Stitching] FFmpeg error:", err);
        throw err;
    }
}