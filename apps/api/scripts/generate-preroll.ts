import ffmpegStatic from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs-extra";

const execFileAsync = promisify(execFile);

/**
 * Generate pre-roll atmosphere audio asset.
 * 
 * Creates a 12-second pink/brown noise file with spectral shaping:
 * - High-pass: 60-80 Hz
 * - Low-pass: 8-10 kHz  
 * - Mid dip: -2 to -4 dB at 1.5-3 kHz
 * - Target: -38 LUFS (very quiet)
 * 
 * Output: apps/mobile/assets/audio/preroll_atmosphere.m4a
 */
async function generatePrerollAsset() {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static not found");
  }

  // Resolve path from project root (where script is run from)
  const projectRoot = path.resolve(__dirname, "..", "..", "..");
  const outputDir = path.join(projectRoot, "apps", "mobile", "assets", "audio");
  const outputPath = path.join(outputDir, "preroll_atmosphere.m4a");

  // Ensure directory exists
  await fs.ensureDir(outputDir);

  console.log("🎵 Generating pre-roll atmosphere asset...");
  console.log(`Output: ${outputPath}`);

  // FFmpeg command to generate pink/brown noise with spectral shaping
  // Using anoisesrc for pink noise (1/f) and brown noise (1/f²)
  // Mixing both at very low levels, then applying filters
  
  const args = [
    // Generate pink noise (base layer)
    "-f", "lavfi",
    "-i", "anoisesrc=color=pink:duration=12:sample_rate=44100",
    
    // Generate brown noise (warmth layer) - we'll mix this in
    "-f", "lavfi", 
    "-i", "anoisesrc=color=brown:duration=12:sample_rate=44100",
    
    // Mix the two noise sources (pink at 70%, brown at 30% for warmth)
    "-filter_complex", [
      "[0:a]volume=0.7[pink]",
      "[1:a]volume=0.3[brown]",
      "[pink][brown]amix=inputs=2:duration=first:dropout_transition=0[mixed]",
      // Apply spectral shaping
      "[mixed]highpass=f=70[hp]",  // High-pass at 70 Hz
      "[hp]lowpass=f=9000[lp]",    // Low-pass at 9 kHz
      "[lp]equalizer=f=2000:width_type=h:width=1500:g=-3[eq]", // Mid dip at 2kHz, -3dB
      // Normalize to very quiet level (target -38 LUFS, but FFmpeg uses dB)
      // -38 LUFS ≈ -38 dB, but we want it quieter, so we'll use -40 dB as starting point
      "[eq]volume=-40dB:precision=fixed[out]"
    ].join(";"),
    
    "-map", "[out]",
    
    // Output format: M4A (AAC codec, better for mobile)
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2", // Stereo
    
    "-y", // Overwrite
    outputPath
  ];

  try {
    await execFileAsync(ffmpegStatic, args);
    console.log("✅ Pre-roll atmosphere asset generated successfully!");
    console.log(`\nFile: ${outputPath}`);
    console.log("\nNote: The loudness may need fine-tuning to exactly -38 LUFS.");
    console.log("You can verify/adjust using audio analysis tools if needed.");
  } catch (error) {
    console.error("❌ Failed to generate pre-roll asset:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.main) {
  generatePrerollAsset().catch(console.error);
}

export { generatePrerollAsset };

