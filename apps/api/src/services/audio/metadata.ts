/**
 * Audio File Metadata Utilities
 * Extract metadata from audio files using ffprobe
 */

import { execFile } from "child_process";
import { promisify } from "util";
import ffprobeStatic from "ffprobe-static";
import fs from "fs-extra";
import path from "path";

const execFileAsync = promisify(execFile);

// Get ffprobe path from ffprobe-static package
function getFfprobePath(): string {
  // ffprobe-static provides the path directly
  if (ffprobeStatic?.path) {
    return ffprobeStatic.path;
  }
  // Fallback: try ffprobe in PATH
  return "ffprobe";
}

export interface AudioMetadata {
  durationMs: number;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  fileSize?: number;
}

/**
 * Get audio file metadata using ffprobe
 */
export async function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  // Get file size
  const stats = await fs.stat(filePath).catch(() => null);
  const fileSize = stats?.size;

  // For S3 URLs, we can't probe them directly
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return {
      durationMs: 0, // Unknown for remote files
      fileSize: undefined,
    };
  }

  // Check if file exists
  if (!(await fs.pathExists(filePath))) {
    return {
      durationMs: 0,
      fileSize,
    };
  }

  try {
    const ffprobePath = getFfprobePath();
    
    // Use ffprobe to get metadata
    const { stdout } = await execFileAsync(ffprobePath, [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
      "-of", "json",
      filePath,
    ]);

    const metadata = JSON.parse(stdout);
    const format = metadata.format || {};
    const stream = metadata.streams?.[0] || {};

    return {
      durationMs: format.duration ? Math.round(parseFloat(format.duration) * 1000) : 0,
      codec: stream.codec_name || undefined,
      sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
      channels: stream.channels ? parseInt(stream.channels, 10) : undefined,
      fileSize,
    };
  } catch (error) {
    console.warn(`[Metadata] Failed to probe ${filePath}:`, error);
    // Return basic info if probing fails
    return {
      durationMs: 0,
      fileSize,
    };
  }
}

/**
 * Calculate SHA-256 checksum of a file
 */
export async function calculateFileChecksum(filePath: string): Promise<string | undefined> {
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return undefined; // Can't checksum remote files
  }

  try {
    const crypto = await import("crypto");
    const fs = await import("fs-extra");
    const buffer = await fs.readFile(filePath);
    return crypto.createHash("sha256").update(buffer).digest("hex");
  } catch (error) {
    console.warn(`[Metadata] Failed to calculate checksum for ${filePath}:`, error);
    return undefined;
  }
}

