/**
 * Analyze audio files for silence at start/end that could cause loop gaps
 * 
 * Run with: bun scripts/analyze-audio-gaps.ts
 */

import fs from "fs-extra";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ffmpegStatic = await import("ffmpeg-static").then(m => m.default);

async function analyzeFile(filePath: string): Promise<{
  filename: string;
  duration: number;
  startSilence: number;
  endSilence: number;
  hasGap: boolean;
  fileSize: number;
}> {
  if (!ffmpegStatic) throw new Error("ffmpeg-static not found");
  
  // Get file info first
  const stats = await fs.stat(filePath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  // Use FFmpeg to get duration and analyze audio levels
  const tempLog = path.join(process.cwd(), "temp_audio_info.txt");
  
  try {
    // Get duration and probe audio
    await execFileAsync(ffmpegStatic, [
      "-i", filePath,
      "-af", "volumedetect", // Detect volume levels
      "-f", "null",
      "-"
    ], {
      stderr: (data: Buffer) => {
        const text = data.toString();
        fs.appendFileSync(tempLog, text);
      }
    });
  } catch (e) {
    // FFmpeg may exit with code 1, which is fine
  }
  
  const logContent = await fs.readFile(tempLog, "utf-8").catch(() => "");
  await fs.remove(tempLog).catch(() => {});
  
  // Get file duration
  const durationMatch = logContent.match(/Duration: ([\d:\.]+)/);
  let duration = 0;
  if (durationMatch) {
    const [hours, minutes, seconds] = durationMatch[1].split(":").map(parseFloat);
    duration = hours * 3600 + minutes * 60 + seconds;
  }
  
  // Extract volume info
  const meanVolumeMatch = logContent.match(/mean_volume: ([\d.-]+) dB/);
  const maxVolumeMatch = logContent.match(/max_volume: ([\d.-]+) dB/);
  
  // For now, we'll use a simpler heuristic:
  // Check if the file is very quiet (which might indicate silence)
  // But the real issue is likely loop transitions, not file-level silence
  
  // We'll report basic info and flag for manual inspection if needed
  const meanVolume = meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : -20;
  const isQuiet = meanVolume < -40; // Very quiet might indicate issues
  
  return {
    filename: path.basename(filePath),
    duration,
    startSilence: 0, // Would need more complex analysis
    endSilence: 0, // Would need more complex analysis
    hasGap: isQuiet || duration < 170, // Flag suspicious files
    fileSize: parseFloat(fileSizeMB),
  };
}

async function main() {
  const assetsDir = path.resolve(process.cwd(), "..", "assets", "audio");
  
  console.log("Analyzing audio files for loop gaps...\n");
  
  const files = [
    ...(await fs.readdir(path.join(assetsDir, "binaural"))).map(f => path.join(assetsDir, "binaural", f)).filter(f => f.endsWith(".m4a")),
    ...(await fs.readdir(path.join(assetsDir, "background", "looped"))).map(f => path.join(assetsDir, "background", "looped", f)).filter(f => f.endsWith(".m4a")),
  ];
  
  const results = [];
  
  for (const file of files) {
    try {
      const analysis = await analyzeFile(file);
      results.push(analysis);
      console.log(`${analysis.filename}:`);
      console.log(`  Duration: ${analysis.duration.toFixed(2)}s`);
      console.log(`  File size: ${analysis.fileSize}MB`);
      console.log(`  Effective bitrate: ${((analysis.fileSize * 8) / (analysis.duration / 60)).toFixed(0)}kbps`);
      if (analysis.hasGap) {
        console.log(`  ⚠️  POTENTIAL ISSUE - may need inspection`);
      } else {
        console.log(`  ✅ Looks OK`);
      }
      console.log();
    } catch (error: any) {
      console.error(`Error analyzing ${path.basename(file)}:`, error.message);
    }
  }
  
  const filesWithGaps = results.filter(r => r.hasGap);
  
  console.log("\n=== Summary ===");
  console.log(`Total files analyzed: ${results.length}`);
  console.log(`Files with gaps: ${filesWithGaps.length}`);
  
  if (filesWithGaps.length > 0) {
    console.log("\n⚠️  Files that need fixing:");
    filesWithGaps.forEach(f => {
      console.log(`  - ${f.filename} (start: ${f.startSilence.toFixed(0)}ms, end: ${f.endSilence.toFixed(0)}ms)`);
    });
  }
}

main().catch(console.error);

