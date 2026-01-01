/**
 * Generate Binaural Beat Assets
 * 
 * Phase 3.2: Create real binaural beat audio files according to roadmap specifications
 * 
 * Requirements:
 * - 400 Hz carrier frequency (base)
 * - Specific offsets for each brainwave state:
 *   - Delta: 400 Hz left, 402-404 Hz right (2-4 Hz beat)
 *   - Theta: 400 Hz left, 406-408 Hz right (6-8 Hz beat)
 *   - Alpha: 400 Hz left, 410-412 Hz right (10-12 Hz beat)
 *   - Beta: 400 Hz left, 414-425 Hz right (14-25 Hz beat)
 * - Background pink noise layer
 * - Seamlessly loopable (critical)
 * 
 * Uses FFmpeg to generate sine waves and mix them
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs-extra";
import ffmpegStatic from "ffmpeg-static";

const execFileAsync = promisify(execFile);

// Get project root
// When running from apps/api, process.cwd() is apps/api, so go up two levels to get project root
const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "apps", "assets", "audio", "binaural");

// Binaural beat specifications from roadmap
const BINAURAL_SPECS = [
    {
        name: "delta",
        brainwaveState: "Delta",
        frequencyHz: 3, // Average of 2-4 Hz
        leftHz: 400,
        rightHz: 403, // 400 + 3 = 403 Hz (creates 3 Hz beat)
        description: "Deep sleep, restoration",
    },
    {
        name: "theta",
        brainwaveState: "Theta",
        frequencyHz: 7, // Average of 6-8 Hz
        leftHz: 400,
        rightHz: 407, // 400 + 7 = 407 Hz (creates 7 Hz beat)
        description: "Deep meditation, creativity",
    },
    {
        name: "alpha",
        brainwaveState: "Alpha",
        frequencyHz: 10, // Common alpha frequency
        leftHz: 400,
        rightHz: 410, // 400 + 10 = 410 Hz (creates 10 Hz beat)
        description: "Relaxed alertness, calm focus",
    },
    {
        name: "alpha_12hz",
        brainwaveState: "Alpha",
        frequencyHz: 12,
        leftHz: 400,
        rightHz: 412, // 400 + 12 = 412 Hz (creates 12 Hz beat)
        description: "Pre-performance calm",
    },
    {
        name: "smr",
        brainwaveState: "SMR",
        frequencyHz: 13.5, // Average of 12-15 Hz
        leftHz: 400,
        rightHz: 413.5, // 400 + 13.5 = 413.5 Hz (creates 13.5 Hz beat)
        description: "Focus, concentration",
    },
    {
        name: "beta_low",
        brainwaveState: "Beta",
        frequencyHz: 17, // Average of 14-20 Hz
        leftHz: 400,
        rightHz: 417, // 400 + 17 = 417 Hz (creates 17 Hz beat)
        description: "Wake up, alertness",
    },
    {
        name: "beta_high",
        brainwaveState: "Beta",
        frequencyHz: 21.5, // Average of 18-25 Hz
        leftHz: 400,
        rightHz: 421.5, // 400 + 21.5 = 421.5 Hz (creates 21.5 Hz beat)
        description: "Coffee replacement, high energy",
    },
] as const;

// Duration: 3 minutes (180 seconds) - long enough to loop seamlessly
const DURATION_SEC = 180;
const SAMPLE_RATE = 44100;
const BITRATE = "128k";

/**
 * Generate pink noise using FFmpeg
 * Pink noise has equal energy per octave (more natural than white noise)
 */
async function generatePinkNoise(outputPath: string, durationSec: number): Promise<void> {
    // FFmpeg seed must be in range [-1, 4294967295], so use a smaller random number
    const seed = Math.floor(Math.random() * 1000000);
    await execFileAsync(ffmpegStatic!, [
        "-f", "lavfi",
        "-i", `anoisesrc=duration=${durationSec}:color=pink:seed=${seed}`,
        "-ar", SAMPLE_RATE.toString(),
        "-ac", "2", // Stereo
        "-c:a", "aac",
        "-b:a", BITRATE,
        "-y",
        outputPath,
    ]);
}

/**
 * Generate binaural beat by creating two sine waves (left and right channels)
 * and mixing them with pink noise
 */
async function generateBinauralBeat(
    spec: typeof BINAURAL_SPECS[number],
    pinkNoisePath: string
): Promise<void> {
    const outputPath = path.join(OUTPUT_DIR, `${spec.name}_${spec.frequencyHz}hz_400_3min.m4a`);
    
    console.log(`Generating ${spec.brainwaveState} binaural beat (${spec.frequencyHz} Hz)...`);
    console.log(`  Left: ${spec.leftHz} Hz, Right: ${spec.rightHz} Hz`);
    
    try {
        // FFmpeg approach:
        // 1. Generate left channel sine wave (400 Hz)
        // 2. Generate right channel sine wave (rightHz)
        // 3. Merge into stereo
        // 4. Mix with pink noise at lower volume
        // 5. Normalize for seamless looping
        
        await execFileAsync(ffmpegStatic!, [
            "-f", "lavfi",
            "-i", `sine=frequency=${spec.leftHz}:duration=${DURATION_SEC}:sample_rate=${SAMPLE_RATE}`,
            "-f", "lavfi",
            "-i", `sine=frequency=${spec.rightHz}:duration=${DURATION_SEC}:sample_rate=${SAMPLE_RATE}`,
            "-i", pinkNoisePath,
            "-filter_complex", [
                // Merge left and right sine waves into stereo
                `[0:a][1:a]amerge=inputs=2[stereo_sine]`,
                // Reduce pink noise volume to 10% before mixing
                `[2:a]volume=0.1[pink_low]`,
                // Mix sine waves with low-volume pink noise
                `[stereo_sine][pink_low]amix=inputs=2:duration=first:dropout_transition=0[mixed]`,
                // Normalize for seamless looping (target -20 LUFS)
                `[mixed]loudnorm=I=-20:TP=-1.5:LRA=7[output]`,
            ].join(";"),
            "-map", "[output]",
            "-ar", SAMPLE_RATE.toString(),
            "-ac", "2",
            "-c:a", "aac",
            "-b:a", BITRATE,
            "-y",
            outputPath,
        ]);
        
        console.log(`  ✓ Generated: ${path.basename(outputPath)}`);
    } catch (error) {
        console.error(`  ✗ Error generating ${spec.name}:`, error);
        throw error;
    }
}

async function main() {
    console.log("🎵 Generating Binaural Beat Assets (Phase 3.2)\n");
    console.log(`Output directory: ${OUTPUT_DIR}\n`);
    
    // Ensure output directory exists
    await fs.ensureDir(OUTPUT_DIR);
    
    // Generate pink noise first (reused for all binaural beats)
    const pinkNoisePath = path.join(OUTPUT_DIR, "_pink_noise_temp.m4a");
    console.log("Generating pink noise base...");
    await generatePinkNoise(pinkNoisePath, DURATION_SEC);
    console.log("  ✓ Pink noise ready\n");
    
    // Generate each binaural beat
    for (const spec of BINAURAL_SPECS) {
        try {
            await generateBinauralBeat(spec, pinkNoisePath);
        } catch (error) {
            console.error(`Failed to generate ${spec.name}:`, error);
            // Continue with next one
        }
    }
    
    // Clean up temporary pink noise file
    await fs.remove(pinkNoisePath);
    
    console.log("\n✅ Binaural beat generation complete!");
    console.log(`\nGenerated files:`);
    for (const spec of BINAURAL_SPECS) {
        const filename = `${spec.name}_${spec.frequencyHz}hz_400_3min.m4a`;
        const filePath = path.join(OUTPUT_DIR, filename);
        if (await fs.pathExists(filePath)) {
            const stats = await fs.stat(filePath);
            console.log(`  - ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        }
    }
}

main()
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });

