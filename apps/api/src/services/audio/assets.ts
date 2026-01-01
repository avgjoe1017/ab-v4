import path from "path";
import fs from "fs-extra";
import { STORAGE_PUBLIC_BASE_URL, ASSETS_PUBLIC_BASE_URL } from "../../index";
import { isS3Configured, getS3Config, fileExistsInS3 } from "../storage/s3";

/**
 * V3 Compliance: Resolve binaural and background assets from AudioAsset table or constants.
 * Returns platform-aware URLs for playback bundle.
 * 
 * iOS uses S3 URLs (HTTPS) to avoid App Transport Security issues.
 * Android can use local HTTP URLs.
 */

// ============================================================================
// S3 EXISTENCE CACHE
// Caches S3 HEAD request results to avoid repeated network calls on hot paths.
// In production, we ASSUME default assets exist (they're uploaded during deploy).
// ============================================================================

interface S3CacheEntry {
  exists: boolean;
  cachedAt: number;
}

// In-memory cache for S3 existence checks
const s3ExistsCache = new Map<string, S3CacheEntry>();

// Cache TTL: 5 minutes in dev, 1 hour in production (assets don't change often)
const S3_CACHE_TTL_MS = process.env.NODE_ENV === "production" ? 60 * 60 * 1000 : 5 * 60 * 1000;

// Known default assets that definitely exist in S3 (skip HEAD check in prod)
const KNOWN_S3_ASSETS = new Set([
  "audio/binaural/alpha_10hz_400_3min.m4a",
  "audio/binaural/theta_7hz_400_3min.m4a", 
  "audio/binaural/smr_13.5hz_400_3min.m4a",
  "audio/binaural/delta_3hz_400_3min.m4a",
  "audio/binaural/beta_low_17hz_400_3min.m4a",
  "audio/binaural/beta_high_21.5hz_400_3min.m4a",
  "audio/background/Babbling Brook.m4a",
]);

/**
 * Cached S3 existence check - avoids repeated HEAD requests on hot paths
 */
async function cachedFileExistsInS3(s3Key: string): Promise<boolean> {
  // In production, assume known assets exist (skip network call)
  if (process.env.NODE_ENV === "production" && KNOWN_S3_ASSETS.has(s3Key)) {
    return true;
  }
  
  // Check cache
  const cached = s3ExistsCache.get(s3Key);
  const now = Date.now();
  if (cached && (now - cached.cachedAt) < S3_CACHE_TTL_MS) {
    return cached.exists;
  }
  
  // Cache miss - do the actual check
  try {
    const exists = await fileExistsInS3(s3Key);
    s3ExistsCache.set(s3Key, { exists, cachedAt: now });
    return exists;
  } catch (error) {
    console.warn(`[Assets] S3 existence check failed for ${s3Key}:`, error);
    // On error, assume it exists to avoid blocking playback
    return true;
  }
}

// Get project root: when running from apps/api, go up two levels to reach project root
// process.cwd() is apps/api when running the API server
// apps/api -> apps -> project root
const PROJECT_ROOT = path.resolve(process.cwd(), "..", "..");
const APPS_ASSETS_ROOT = path.resolve(PROJECT_ROOT, "apps", "assets");
const ROOT_ASSETS_ROOT = path.resolve(PROJECT_ROOT, "assets");
const ASSETS_ROOT = fs.existsSync(APPS_ASSETS_ROOT) ? APPS_ASSETS_ROOT : ROOT_ASSETS_ROOT;

// Default binaural/background asset IDs (can be configured per session later)
const DEFAULT_BINAURAL_HZ = 10; // Alpha 10Hz
const DEFAULT_BACKGROUND_ID = "Babbling Brook"; // From assets/audio/background/looped/

// S3 URLs for static assets (uploaded via scripts/upload-static-assets-to-s3.ts)
function getS3AssetUrl(s3Key: string): string | null {
  const config = getS3Config();
  if (!config) return null;
  
  // URL-encode the key (handles spaces in filenames)
  const encodedKey = s3Key.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${encodedKey}`;
}

/**
 * Map frequency and brainwave state to binaural filename
 * Handles special cases like beta_low, beta_high
 */
function getBinauralFilename(hz: number, brainwaveState?: string): string {
    // Normalize brainwave state
    const state = brainwaveState?.toLowerCase() || "alpha";
    
    // Special cases for Beta frequencies
    if (state === "beta") {
        if (hz >= 17 && hz < 20) {
            return `beta_low_17hz_400_3min.m4a`;
        } else if (hz >= 20) {
            return `beta_high_21.5hz_400_3min.m4a`;
        } else {
            return `beta_13hz_400_3min.m4a`; // Fallback for other beta frequencies
        }
    }
    
    // Map brainwave state to filename prefix
    let prefix: string;
    switch (state) {
        case "delta":
            prefix = "delta";
            break;
        case "theta":
            prefix = "theta";
            break;
        case "alpha":
            prefix = "alpha";
            break;
        case "smr":
            prefix = "smr";
            break;
        default:
            prefix = "alpha"; // Default fallback
    }
    
    // Format frequency: keep decimals as-is (e.g., 13.5), integers as-is (e.g., 10)
    const hzStr = hz % 1 === 0 ? hz.toString() : hz.toString();
    
    return `${prefix}_${hzStr}hz_400_3min.m4a`;
}

/**
 * Get binaural asset URL by frequency (Hz) and brainwave state
 * Returns platform-aware URLs for iOS and Android
 * 
 * iOS: Uses S3 HTTPS URL to avoid App Transport Security issues
 * Android: Uses local HTTP URL (no ATS restrictions)
 * 
 * @param hz - Binaural frequency in Hz (default: 10)
 * @param apiBaseUrl - Base URL of the API server (e.g., "http://localhost:8787")
 * @param brainwaveState - Brainwave state: "Delta" | "Theta" | "Alpha" | "SMR" | "Beta" (optional, defaults to Alpha)
 */
export async function getBinauralAsset(
    hz: number = DEFAULT_BINAURAL_HZ,
    apiBaseUrl: string = "http://localhost:8787",
    brainwaveState?: "Delta" | "Theta" | "Alpha" | "SMR" | "Beta"
): Promise<{
    urlByPlatform: { ios: string; android: string };
    loop: true;
    hz: number;
}> {
    // Generate filename based on frequency and brainwave state
    const filename = getBinauralFilename(hz, brainwaveState);
    const s3Key = `audio/binaural/${filename}`;
    let s3Url: string | null = null;
    let actualHz = hz;
    
    // Check if the exact frequency file exists in S3 (cached to avoid repeated HEAD requests)
    if (isS3Configured()) {
      const exists = await cachedFileExistsInS3(s3Key);
      if (exists) {
        s3Url = getS3AssetUrl(s3Key);
      } else {
        // S3 file doesn't exist - will try local file system below
        // Don't set fallback here, let local file check handle it
      }
    }
    
    // For Android, use local HTTP URL
    // Try to find the file - it might have different carrier frequencies (100, 120, 400)
    const binauralDir = path.resolve(ASSETS_ROOT, "audio", "binaural");
    let foundFilename: string | null = null;
    let foundPath: string | null = null;
    
    // First, try the exact filename (with 400 carrier)
    const exactPath = path.resolve(binauralDir, filename);
    if (await fs.pathExists(exactPath)) {
        foundFilename = filename;
        foundPath = exactPath;
    } else {
        // Try to find a file matching the pattern with any carrier frequency
        // Pattern: {brainwave}_{hz}hz_{carrier}_3min.m4a
        try {
            const files = await fs.readdir(binauralDir);
            const hzStr = hz % 1 === 0 ? hz.toString() : hz.toString();
            
            // Build search pattern based on brainwave state
            let prefix: string;
            switch (brainwaveState?.toLowerCase()) {
                case "delta":
                    prefix = "delta";
                    break;
                case "theta":
                    prefix = "theta";
                    break;
                case "alpha":
                    prefix = "alpha";
                    break;
                case "smr":
                    prefix = "smr";
                    break;
                case "beta":
                    // Beta has special cases: beta_low, beta_high, or just beta
                    if (hz >= 17 && hz < 20) {
                        prefix = "beta_low";
                    } else if (hz >= 20) {
                        prefix = "beta_high";
                    } else {
                        prefix = "beta";
                    }
                    break;
                default:
                    prefix = "alpha";
            }
            
            // Try to find matching file (any carrier frequency)
            // Escape special regex characters in hzStr (e.g., 13.5 -> 13\.5)
            const escapedHz = hzStr.replace(".", "\\.");
            const pattern = new RegExp(`^${prefix}_${escapedHz}hz_\\d+_3min\\.m4a$`);
            foundFilename = files.find(f => {
                const matches = pattern.test(f);
                if (matches) {
                    console.log(`[Assets] Found matching binaural file: ${f} (pattern: ${pattern})`);
                }
                return matches;
            }) || null;
            
            if (foundFilename) {
                foundPath = path.resolve(binauralDir, foundFilename);
            }
        } catch (e) {
            // Ignore directory read errors
        }
    }
    
    // Check if local file exists (for Android URL)
    let localUrl: string;
    if (foundPath && await fs.pathExists(foundPath)) {
        // Found the requested file - reset actualHz to requested value
        actualHz = hz;
        const relativePath = path.relative(ASSETS_ROOT, foundPath).replace(/\\/g, "/");
        const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
        const encodedPath = basePath
          .split("/")
          .map(segment => segment ? encodeURIComponent(segment) : segment)
          .join("/");
        localUrl = `${apiBaseUrl}${encodedPath}`;
        
        // Also update S3 URL if we found the file locally (for iOS)
        if (!s3Url && foundFilename) {
            const foundS3Key = `audio/binaural/${foundFilename}`;
            s3Url = getS3AssetUrl(foundS3Key);
        }
    } else {
        // Try fallback: Alpha 10Hz (try any carrier)
        const fallbackPatterns = ["alpha_10hz_400_3min.m4a", "alpha_10hz_120_3min.m4a", "alpha_10hz_100_3min.m4a"];
        let fallbackPath: string | null = null;
        for (const fallbackPattern of fallbackPatterns) {
            const testPath = path.resolve(binauralDir, fallbackPattern);
            if (await fs.pathExists(testPath)) {
                fallbackPath = testPath;
                break;
            }
        }
        
        if (fallbackPath) {
            const relativePath = path.relative(ASSETS_ROOT, fallbackPath).replace(/\\/g, "/");
            const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
            const encodedPath = basePath
              .split("/")
              .map(segment => segment ? encodeURIComponent(segment) : segment)
              .join("/");
            localUrl = `${apiBaseUrl}${encodedPath}`;
            actualHz = 10;
            console.log(`[Assets] Using fallback binaural: 10Hz Alpha (requested: ${hz}Hz ${brainwaveState || "Alpha"} doesn't exist)`);
        } else {
            throw new Error(`Binaural asset not found for ${hz}Hz ${brainwaveState || "Alpha"}. Looked for: ${filename}`);
        }
    }
    
    // iOS gets S3 URL (HTTPS) if available, otherwise local URL
    // Android gets local URL (HTTP)
    const iosUrl = s3Url || localUrl;
    const androidUrl = localUrl;
    
    return {
        urlByPlatform: { ios: iosUrl, android: androidUrl },
        loop: true,
        hz: actualHz, // Return the actual Hz used (may be fallback)
    };
}

/**
 * Get solfeggio asset URL by frequency (Hz)
 * Returns platform-aware URLs for iOS and Android
 * 
 * iOS: Uses S3 HTTPS URL to avoid App Transport Security issues
 * Android: Uses local HTTP URL (no ATS restrictions)
 * 
 * @param hz - Solfeggio frequency in Hz (e.g., 528)
 * @param apiBaseUrl - Base URL of the API server (e.g., "http://localhost:8787")
 */
export async function getSolfeggioAsset(
    hz: number,
    apiBaseUrl: string = "http://localhost:8787"
): Promise<{
    urlByPlatform: { ios: string; android: string };
    loop: true;
    hz: number;
}> {
    // Generate filename: solfeggio_{hz}_3min.m4a
    const filename = `solfeggio_${hz}_3min.m4a`;
    const s3Key = `audio/solfeggio/${filename}`;
    let s3Url: string | null = null;
    
    // Check if the exact frequency file exists in S3 (cached to avoid repeated HEAD requests)
    if (isS3Configured()) {
      const exists = await cachedFileExistsInS3(s3Key);
      if (exists) {
        s3Url = getS3AssetUrl(s3Key);
      }
    }
    
    // For Android, use local HTTP URL
    const assetPath = path.resolve(ASSETS_ROOT, "audio", "solfeggio", filename);
    
    // Check if local file exists (for Android URL)
    let localUrl: string;
    if (await fs.pathExists(assetPath)) {
        const relativePath = path.relative(ASSETS_ROOT, assetPath).replace(/\\/g, "/");
        const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
        const encodedPath = basePath
          .split("/")
          .map(segment => segment ? encodeURIComponent(segment) : segment)
          .join("/");
        localUrl = `${apiBaseUrl}${encodedPath}`;
    } else {
        // Try fallback: 528Hz (most common solfeggio frequency)
        const fallbackPath = path.resolve(ASSETS_ROOT, "audio", "solfeggio", "solfeggio_528_3min.m4a");
        if (await fs.pathExists(fallbackPath)) {
            const relativePath = path.relative(ASSETS_ROOT, fallbackPath).replace(/\\/g, "/");
            const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
            const encodedPath = basePath
              .split("/")
              .map(segment => segment ? encodeURIComponent(segment) : segment)
              .join("/");
            localUrl = `${apiBaseUrl}${encodedPath}`;
            console.log(`[Assets] Using fallback solfeggio: 528Hz (requested: ${hz}Hz doesn't exist)`);
        } else {
            throw new Error(`Solfeggio asset not found for ${hz}Hz. Looked for: ${filename}`);
        }
    }
    
    // iOS gets S3 URL (HTTPS) if available, otherwise local URL
    // Android gets local URL (HTTP)
    const iosUrl = s3Url || localUrl;
    const androidUrl = localUrl;
    
    return {
        urlByPlatform: { ios: iosUrl, android: androidUrl },
        loop: true,
        hz,
    };
}

/**
 * Get background asset URL by ID
 * Returns platform-aware URLs for iOS and Android
 * 
 * iOS: Uses S3 HTTPS URL to avoid App Transport Security issues
 * Android: Uses local HTTP URL (no ATS restrictions)
 * 
 * @param backgroundId - Background asset ID (default: "Babbling Brook")
 * @param apiBaseUrl - Base URL of the API server (e.g., "http://localhost:8787")
 */
export async function getBackgroundAsset(
    backgroundId: string = DEFAULT_BACKGROUND_ID,
    apiBaseUrl: string = "http://localhost:8787"
): Promise<{
    urlByPlatform: { ios: string; android: string };
    loop: true;
}> {
    // For iOS, prefer S3 URL (HTTPS) to avoid ATS issues
    // Note: S3 key doesn't include "looped/" subdirectory
    const s3Key = `audio/background/${backgroundId}.m4a`;
    const s3Url = getS3AssetUrl(s3Key);
    
    // Fallback S3 URL
    const fallbackS3Key = `audio/background/${DEFAULT_BACKGROUND_ID}.m4a`;
    const fallbackS3Url = getS3AssetUrl(fallbackS3Key);
    
    // For Android, use local HTTP URL
    // Local files are in assets/audio/background/looped/
    const assetPath = path.resolve(ASSETS_ROOT, "audio", "background", "looped", `${backgroundId}.m4a`);
    
    // Check if local file exists (for Android URL)
    let localUrl: string;
    if (await fs.pathExists(assetPath)) {
        const relativePath = path.relative(ASSETS_ROOT, assetPath).replace(/\\/g, "/");
        const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
        const encodedPath = basePath
          .split("/")
          .map(segment => segment ? encodeURIComponent(segment) : segment)
          .join("/");
        localUrl = `${apiBaseUrl}${encodedPath}`;
    } else {
        // Try fallback
        const fallbackPath = path.resolve(ASSETS_ROOT, "audio", "background", "looped", `${DEFAULT_BACKGROUND_ID}.m4a`);
        if (await fs.pathExists(fallbackPath)) {
            const relativePath = path.relative(ASSETS_ROOT, fallbackPath).replace(/\\/g, "/");
            const basePath = `${ASSETS_PUBLIC_BASE_URL}/${relativePath}`;
            const encodedPath = basePath
              .split("/")
              .map(segment => segment ? encodeURIComponent(segment) : segment)
              .join("/");
            localUrl = `${apiBaseUrl}${encodedPath}`;
        } else {
            throw new Error(`Background asset not found: ${backgroundId}. Looked in: ${assetPath}`);
        }
    }
    
    // iOS gets S3 URL (HTTPS), Android gets local URL (HTTP)
    const iosUrl = s3Url || fallbackS3Url || localUrl;
    const androidUrl = localUrl;
    
    return {
        urlByPlatform: { ios: iosUrl, android: androidUrl },
        loop: true,
    };
}

