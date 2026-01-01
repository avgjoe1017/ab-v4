/**
 * Re-encode background and binaural audio files at 96kbps AAC
 * 
 * This reduces file sizes by ~50% while maintaining good quality for ambient/tonal content.
 * Voice/affirmations should remain at 192kbps for clarity.
 * 
 * Run with: bun scripts/re-encode-audio-96kbps.ts
 */

import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { AUDIO_PROFILE_V3 } from "@ab/contracts";

const execFileAsync = promisify(execFile);
const ffmpegStatic = await import("ffmpeg-static").then(m => m.default);

async function reencodeFile(
  inputPath: string,
  outputPath: string,
  bitrate: number = 96
): Promise<void> {
  if (!ffmpegStatic) throw new Error("ffmpeg-static not found");
  
  console.log(`Re-encoding: ${path.basename(inputPath)}`);
  console.log(`  Input: ${inputPath}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Bitrate: ${bitrate}kbps`);
  
  // FFmpeg can't edit in-place, so write to temp file first
  const tempPath = outputPath + ".tmp";
  
  // Re-encode with AAC at specified bitrate
  // Use -f ipod for .m4a files (FFmpeg needs explicit format)
  await execFileAsync(ffmpegStatic, [
    "-i", inputPath,
    "-c:a", "aac",
    "-b:a", `${bitrate}k`,
    "-ar", AUDIO_PROFILE_V3.SAMPLE_RATE_HZ.toString(),
    "-ac", AUDIO_PROFILE_V3.CHANNELS.toString(),
    "-f", "ipod", // M4A container format
    "-movflags", "+faststart", // Enable streaming
    "-y", // Overwrite
    tempPath
  ]);
  
  // Get file sizes before replacing
  const inputStats = await fs.stat(inputPath);
  const tempStats = await fs.stat(tempPath);
  
  // Replace original with re-encoded version
  await fs.move(tempPath, outputPath, { overwrite: true });
  
  const inputMB = (inputStats.size / 1024 / 1024).toFixed(2);
  const outputMB = (tempStats.size / 1024 / 1024).toFixed(2);
  const reduction = ((1 - tempStats.size / inputStats.size) * 100).toFixed(1);
  
  console.log(`  ✅ Complete: ${inputMB}MB → ${outputMB}MB (${reduction}% reduction)\n`);
}

async function main() {
  const assetsDir = path.resolve(process.cwd(), "..", "assets", "audio");
  const backupDir = path.resolve(process.cwd(), "..", "assets", "audio", "_backup_original");
  
  console.log("Re-encoding background and binaural files to 96kbps...\n");
  console.log(`Backup directory: ${backupDir}\n`);
  
  // Create backup directory
  await fs.ensureDir(backupDir);
  await fs.ensureDir(path.join(backupDir, "binaural"));
  await fs.ensureDir(path.join(backupDir, "background"));
  
  // Get all binaural files
  const binauralDir = path.join(assetsDir, "binaural");
  const binauralFiles = (await fs.readdir(binauralDir))
    .filter(f => f.endsWith(".m4a"))
    .map(f => path.join(binauralDir, f));
  
  // Get all background files
  const backgroundDir = path.join(assetsDir, "background", "looped");
  const backgroundFiles = (await fs.readdir(backgroundDir))
    .filter(f => f.endsWith(".m4a"))
    .map(f => path.join(backgroundDir, f));
  
  const allFiles = [...binauralFiles, ...backgroundFiles];
  
  console.log(`Found ${allFiles.length} files to re-encode:\n`);
  
  let totalInputSize = 0;
  let totalOutputSize = 0;
  
  for (const filePath of allFiles) {
    try {
      // Backup original
      const relativePath = path.relative(assetsDir, filePath);
      const backupPath = path.join(backupDir, relativePath);
      await fs.ensureDir(path.dirname(backupPath));
      
      if (!(await fs.pathExists(backupPath))) {
        console.log(`Backing up: ${path.basename(filePath)}`);
        await fs.copy(filePath, backupPath);
      }
      
      // Re-encode in place
      const inputStats = await fs.stat(filePath);
      totalInputSize += inputStats.size;
      
      await reencodeFile(filePath, filePath, AUDIO_PROFILE_V3.BACKGROUND_BITRATE_KBEPS);
      
      const outputStats = await fs.stat(filePath);
      totalOutputSize += outputStats.size;
      
    } catch (error: any) {
      console.error(`❌ Error processing ${path.basename(filePath)}:`, error.message);
    }
  }
  
  console.log("\n=== Summary ===");
  const totalInputMB = (totalInputSize / 1024 / 1024).toFixed(2);
  const totalOutputMB = (totalOutputSize / 1024 / 1024).toFixed(2);
  const totalReduction = ((1 - totalOutputSize / totalInputSize) * 100).toFixed(1);
  
  console.log(`Total input size: ${totalInputMB}MB`);
  console.log(`Total output size: ${totalOutputMB}MB`);
  console.log(`Total reduction: ${totalReduction}%`);
  console.log(`\n✅ Re-encoding complete!`);
  console.log(`Original files backed up to: ${backupDir}`);
  console.log(`\nNext step: Upload re-encoded files to S3:`);
  console.log(`  bun scripts/upload-static-assets-to-s3.ts`);
}

main().catch(console.error);

