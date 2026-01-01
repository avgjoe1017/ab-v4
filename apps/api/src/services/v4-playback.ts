/**
 * V4 Playback Bundle Service
 * P0.5: Guarantee "something plays" immediately with fallback ladder
 */

import { prisma } from "../lib/db";
import { getEntitlementV4 } from "./v4-entitlements";
import { getBinauralAsset, getBackgroundAsset, getSolfeggioAsset, DEFAULT_BACKGROUND_ID } from "./audio/assets";
import { isSilentModeForced, isBrainTrackFrequencyDisabled, isBackgroundDisabled } from "./v4-kill-switches";
import { getBrainTrackForSession } from "./audio/brain-track-mapping";
import type { PlanV4 } from "@ab/contracts";

export interface PlaybackBundleV4 {
  planId: string;
  sessionId: string; // Session ID for AudioEngine (from plan.playbackSessions)
  voiceUrl?: string; // May be undefined if not ready (fallback mode)
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
  sessionDurationCapMs: number | "unlimited"; // 300000 (5 minutes) for free, unlimited for paid
  fallbackMode: "full" | "voice_pending" | "silent"; // Silent = text-only affirmations
  effectiveAffirmationSpacingMs: number; // Calculated spacing between affirmations
}

/**
 * Get playback bundle for a plan with fallback ladder
 * P0.5: Guarantees something plays immediately
 */
export async function getPlaybackBundleV4(
  userId: string | null,
  planId: string,
  apiBaseUrl: string
): Promise<PlaybackBundleV4> {
  // Get plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      playbackSessions: {
        include: {
          audio: {
            include: {
              mergedAudioAsset: true,
            },
          },
        },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  // P0 GAP FIX: Strict ownership check - ensure plan belongs to user (or is premade/public)
  if (plan.userId && plan.userId !== userId) {
    // Only user-owned plans require ownership check; premade plans are public
    if (plan.source !== "premade") {
      throw new Error("Unauthorized: Plan does not belong to user");
    }
  }

  // Get entitlements for session duration cap
  const entitlement = await getEntitlementV4(userId);
  const sessionDurationCapMs = entitlement.limits.maxSessionDurationMs === "unlimited"
    ? "unlimited"
    : entitlement.limits.maxSessionDurationMs;

  // Parse audio config
  const audioConfig = JSON.parse(plan.audioConfig || "{}") as {
    brainTrackMode?: string;
    brainTrackId?: string;
    backgroundId?: string;
  };

  // P1-10.2: Check if background is disabled by kill switch
  const requestedBackgroundId = audioConfig.backgroundId || DEFAULT_BACKGROUND_ID;
  const backgroundId = isBackgroundDisabled(requestedBackgroundId) ? DEFAULT_BACKGROUND_ID : requestedBackgroundId;
  
  // Get background asset (always available - bundled)
  const backgroundAsset = await getBackgroundAsset(
    backgroundId,
    apiBaseUrl
  );

  // Get brain track (always available - bundled)
  // AudioEngine REQUIRES either binaural or solfeggio, so we must always provide a default
  let binauralAsset: { urlByPlatform: { ios: string; android: string }; loop: true; hz: number } | undefined;
  let solfeggioAsset: { urlByPlatform: { ios: string; android: string }; loop: true; hz: number } | undefined;
  
  if (audioConfig.brainTrackMode === "binaural" && audioConfig.brainTrackId) {
    const requestedHz = parseFloat(audioConfig.brainTrackId);
    // P1-10.2: Check if brain track frequency is disabled by kill switch
    if (!isBrainTrackFrequencyDisabled(requestedHz)) {
      try {
        binauralAsset = await getBinauralAsset(
          requestedHz,
          apiBaseUrl
        );
      } catch (error) {
        console.warn("[V4 Playback] Failed to get binaural asset, falling back to default");
      }
    } else {
      console.warn(`[V4 Playback] Binaural frequency ${requestedHz}Hz is disabled by kill switch`);
    }
  } else if (audioConfig.brainTrackMode === "solfeggio" && audioConfig.brainTrackId) {
    const requestedHz = parseFloat(audioConfig.brainTrackId);
    // P1-10.2: Check if brain track frequency is disabled by kill switch
    if (!isBrainTrackFrequencyDisabled(requestedHz)) {
      try {
        solfeggioAsset = await getSolfeggioAsset(
          requestedHz,
          apiBaseUrl
        );
      } catch (error) {
        console.warn("[V4 Playback] Failed to get solfeggio asset, falling back to default binaural");
      }
    } else {
      console.warn(`[V4 Playback] Solfeggio frequency ${requestedHz}Hz is disabled by kill switch`);
    }
  }
  
  // CRITICAL: AudioEngine requires either binaural or solfeggio
  // If none was set (no audioConfig, or failed to load), use intelligent defaults based on session type
  if (!binauralAsset && !solfeggioAsset) {
    // Get session type from plan title or default to "Meditate"
    // The plan title often indicates intent (e.g., "Focus session", "Sleep better")
    const sessionType = plan.title || "Meditate";
    const intent = plan.writtenGoal || undefined;
    
    // Get recommended brain track based on session type and intent
    const mapping = getBrainTrackForSession(sessionType, intent, "binaural");
    
    try {
      binauralAsset = await getBinauralAsset(mapping.hz, apiBaseUrl);
      console.log(`[V4 Playback] Using session-appropriate binaural: ${mapping.hz}Hz (${mapping.rationale})`);
    } catch (error) {
      // Fallback to default Alpha 10Hz if the specific frequency isn't available
      console.warn(`[V4 Playback] Failed to get ${mapping.hz}Hz, falling back to Alpha 10Hz`);
      try {
        binauralAsset = await getBinauralAsset(10, apiBaseUrl);
        console.log("[V4 Playback] Using fallback binaural: Alpha 10Hz");
      } catch (fallbackError) {
        console.error("[V4 Playback] Failed to get fallback binaural asset:", fallbackError);
        // This is a critical error - AudioEngine will fail without a brain track
        throw new Error("Failed to load default binaural asset");
      }
    }
  }

  // P1-10.2: Check kill switch for forced silent mode
  const forceSilent = isSilentModeForced();
  
  // Get session (required for AudioEngine and voice URL)
  const session = plan.playbackSessions?.[0];
  
  // Get voice track (may not be ready)
  let voiceUrl: string | undefined;
  let fallbackMode: "full" | "voice_pending" | "silent" = "full";

  // Define silence fallback URL for when voice isn't ready
  // This is a real audio file that expo-audio can load (data URLs don't work)
  const silenceUrl = `${apiBaseUrl}/assets/audio/silence_3min.m4a`;

  if (forceSilent) {
    // P1-10.2: Kill switch forces silent mode - skip voice entirely
    fallbackMode = "silent";
    voiceUrl = silenceUrl; // Use real silence file, not data URL
  } else {
    if (session?.audio?.mergedAudioAsset?.url) {
      const filePath = session.audio.mergedAudioAsset.url;
      
      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        voiceUrl = filePath;
        fallbackMode = "full";
      } else {
        // Local file - construct URL
        voiceUrl = `${apiBaseUrl}/storage/${filePath}`;
        fallbackMode = "full";
      }
    } else {
      // P0 GAP FIX: Voice not ready - use silence file while audio generates
      // Client will poll for status and reload when voice is ready
      fallbackMode = "voice_pending";
      voiceUrl = silenceUrl; // Use real silence file so AudioEngine doesn't fail
      console.log("[V4 Playback] Voice not ready, using silence placeholder");
    }
  }

  // Determine mix (V3 format: affirmations, binaural, background)
  // Note: V3 uses "binaural" field for any brain track (binaural or solfeggio)
  const brainMixLevel = (binauralAsset || solfeggioAsset) ? 0.05 : 0;
  const mix = {
    affirmations: 1.0,
    binaural: brainMixLevel, // V3 field name, but applies to any brain track
    background: 0.3,
  };

  // Calculate effective affirmation spacing (default: ~8 seconds per affirmation)
  // This is used for silent mode timing
  const affirmationCount = plan.affirmationCount;
  const estimatedDurationPerAffirmation = 8000; // 8 seconds per affirmation (rough estimate)
  const effectiveAffirmationSpacingMs = estimatedDurationPerAffirmation;

  // Verify session exists (required for AudioEngine)
  if (!session) {
    throw new Error("Plan has no associated session for playback");
  }

  return {
    planId: plan.id,
    sessionId: session.id,
    voiceUrl,
    background: backgroundAsset,
    binaural: binauralAsset,
    solfeggio: solfeggioAsset,
    mix,
    sessionDurationCapMs,
    fallbackMode,
    effectiveAffirmationSpacingMs,
  };
}
