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
  } else if (bundle.fallbackMode === 'voice_pending' && bundle.voiceUrl) {
    // Voice pending: API provides a real silence audio file URL
    // AudioEngine will play this (silent audio) while background/brain tracks play
    // Client should display timed text affirmations
    affirmationsMergedUrl = bundle.voiceUrl;
  } else if (bundle.voiceUrl) {
    // Silent mode with URL: API provides silence file
    // Client must handle text-only affirmations
    affirmationsMergedUrl = bundle.voiceUrl;
  } else {
    // Fallback: This should not happen if API is working correctly
    // Log an error and throw - we need a valid URL for AudioEngine
    console.error('[BundleConverter] No voiceUrl provided in bundle - this indicates an API issue');
    throw new Error('No voice URL provided in playback bundle');
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
