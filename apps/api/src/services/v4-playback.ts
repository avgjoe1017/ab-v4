/**
 * V4 Playback Bundle Service
 * P0.5: Guarantee "something plays" immediately with fallback ladder
 */

import { prisma } from "../lib/db";
import { getEntitlementV4 } from "./v4-entitlements";
import { getBinauralAsset, getBackgroundAsset, getSolfeggioAsset, DEFAULT_BACKGROUND_ID } from "./audio/assets";
import { isSilentModeForced, isBrainTrackFrequencyDisabled, isBackgroundDisabled } from "./v4-kill-switches";
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
        console.warn("[V4 Playback] Failed to get binaural asset, falling back to none");
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
        console.warn("[V4 Playback] Failed to get solfeggio asset, falling back to none");
      }
    } else {
      console.warn(`[V4 Playback] Solfeggio frequency ${requestedHz}Hz is disabled by kill switch`);
    }
  }

  // P1-10.2: Check kill switch for forced silent mode
  const forceSilent = isSilentModeForced();
  
  // Get session (required for AudioEngine and voice URL)
  const session = plan.playbackSessions?.[0];
  
  // Get voice track (may not be ready)
  let voiceUrl: string | undefined;
  let fallbackMode: "full" | "voice_pending" | "silent" = "full";

  if (forceSilent) {
    // P1-10.2: Kill switch forces silent mode - skip voice entirely
    fallbackMode = "silent";
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
      // P0 GAP FIX: Voice not ready - check if we should use silent mode
      // After a timeout period, switch to silent mode (text-only affirmations)
      // For now, use voice_pending; client can check job status and switch to silent if needed
      fallbackMode = "voice_pending";
      
      // P0.6: If voice generation failed or is stuck, offer silent mode
      // This would require checking job status - for now, client handles the transition
      // TODO: Check audio job status and set to "silent" if job failed
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
