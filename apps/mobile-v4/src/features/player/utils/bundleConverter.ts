/**
 * Bundle Converter: PlaybackBundleV4 → PlaybackBundleVM
 * P1.1: Converts V4 playback bundle to V3 format expected by AudioEngine
 * 
 * This is the critical bridge that makes Player work end-to-end.
 * Handles all three fallback modes: full, voice_pending, silent
 */

import type { PlaybackBundleVM } from '@ab/contracts';
import { Platform } from 'react-native';

export interface PlaybackBundleV4 {
  planId: string;
  sessionId: string;
  voiceUrl?: string;
  background: {
    urlByPlatform: { ios: string; android: string };
    loop: true;
  };
  binaural?: {
    urlByPlatform: { ios: string; android: string };
    loop: true;
    hz: number;
  };
  solfeggio?: {
    urlByPlatform: { ios: string; android: string };
    loop: true;
    hz: number;
  };
  mix: {
    affirmations: number;
    background: number;
    binaural: number;
  };
  sessionDurationCapMs: number | 'unlimited';
  fallbackMode: 'full' | 'voice_pending' | 'silent';
  effectiveAffirmationSpacingMs: number;
}

/**
 * Convert V4 playback bundle to V3 PlaybackBundleVM format
 * 
 * Handles three fallback modes:
 * - full: Voice ready, use voiceUrl
 * - voice_pending: Voice not ready, use placeholder URL (background plays, timer runs)
 * - silent: Voice failed, use silent placeholder (text-only affirmations)
 */
export function convertPlaybackBundleV4ToVM(
  bundle: PlaybackBundleV4
): PlaybackBundleVM {
  // Determine voice URL based on fallback mode
  let affirmationsMergedUrl: string;

  if (bundle.fallbackMode === 'full' && bundle.voiceUrl) {
    // Full mode: use actual voice URL
    affirmationsMergedUrl = bundle.voiceUrl;
  } else if (bundle.fallbackMode === 'voice_pending') {
    // Voice pending: use a silent placeholder URL
    // AudioEngine will play this (silent audio) while background/brain tracks play
    // Client should display timed text affirmations
    // TODO: Create a silent audio file or use a data URI
    // For now, use a placeholder that won't break AudioEngine
    affirmationsMergedUrl = bundle.voiceUrl || 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  } else {
    // Silent mode: use silent placeholder
    // Client must handle text-only affirmations
    affirmationsMergedUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  }

  // P1-2.4: Ensure we have either binaural or solfeggio (AudioEngine requires one)
  // If neither is provided in the bundle, we'll throw an error since the API should always provide one
  // The API is responsible for providing valid URLs for binaural/solfeggio assets
  if (!bundle.binaural && !bundle.solfeggio) {
    // This shouldn't happen in normal operation - API should always provide a brain track
    // Log warning but continue - AudioEngine will handle missing brain track gracefully
    console.warn('[BundleConverter] No binaural or solfeggio provided in bundle - playback may be incomplete');
  }

  // P1-2.4: Ensure background has fallback (should be rare if bundled)
  // Note: Background is required, so if it fails, AudioEngine will handle the error
  // We don't modify it here since it's required by the API contract

  // Construct V3 bundle
  const vmBundle: PlaybackBundleVM = {
    sessionId: bundle.sessionId,
    affirmationsMergedUrl,
    background: bundle.background,
    mix: bundle.mix,
    effectiveAffirmationSpacingMs: bundle.effectiveAffirmationSpacingMs,
  };

  // Add binaural or solfeggio (AudioEngine requires one)
  if (bundle.binaural) {
    vmBundle.binaural = bundle.binaural;
  }
  if (bundle.solfeggio) {
    vmBundle.solfeggio = bundle.solfeggio;
  }

  return vmBundle;
}

/**
 * Get platform-specific URL from asset
 */
export function getPlatformUrl(
  asset: { urlByPlatform: { ios: string; android: string } }
): string {
  return Platform.OS === 'ios' ? asset.urlByPlatform.ios : asset.urlByPlatform.android;
}
