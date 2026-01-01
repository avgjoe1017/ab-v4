/**
 * V4 Last Plan Service
 * P1-7.2: "Same vibe as yesterday" - Get last saved plan settings + tone tag
 * Does not require storing sensitive transcript, uses saved plan metadata
 */

import { prisma } from "../lib/db";

export interface LastPlanSettings {
  voiceId?: string;
  brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
  binauralHz?: number;
  solfeggioHz?: number;
  backgroundId?: string;
  affirmationCount?: number;
  toneTag?: string; // Intent/tone from last saved plan
}

/**
 * Get last saved plan settings for "same vibe as yesterday"
 * P1-7.2: Returns settings + tone tag without storing sensitive transcript
 */
export async function getLastSavedPlanSettings(
  userId: string
): Promise<LastPlanSettings | null> {
  // Get most recent saved plan
  const lastSave = await prisma.planSave.findFirst({
    where: { userId },
    include: {
      plan: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastSave || !lastSave.plan) {
    return null;
  }

  const plan = lastSave.plan;
  const voiceConfig = JSON.parse(plan.voiceConfig || '{}') as { voiceId?: string; pace?: string };
  const audioConfig = JSON.parse(plan.audioConfig || '{}') as {
    brainTrackMode?: string;
    brainTrackId?: string;
    backgroundId?: string;
  };

  return {
    voiceId: voiceConfig.voiceId || 'male',
    brainTrackMode: (audioConfig.brainTrackMode as 'binaural' | 'solfeggio' | 'none') || 'none',
    binauralHz: audioConfig.brainTrackMode === 'binaural' && audioConfig.brainTrackId
      ? parseFloat(audioConfig.brainTrackId)
      : undefined,
    solfeggioHz: audioConfig.brainTrackMode === 'solfeggio' && audioConfig.brainTrackId
      ? parseFloat(audioConfig.brainTrackId)
      : undefined,
    backgroundId: audioConfig.backgroundId,
    affirmationCount: plan.affirmationCount,
    toneTag: plan.intentSummary || undefined, // Use intentSummary as tone tag
  };
}
