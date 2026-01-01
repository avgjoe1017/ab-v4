/**
 * V4 Premade Plan Service
 * P1-4.3: Centralized conversion from premade catalog Session to Plan
 */

import { prisma } from "../lib/db";

/**
 * Convert a premade catalog Session to a Plan
 * P1-4.3: Centralized function for consistent Plan creation from premade Sessions
 * 
 * @param session - The catalog Session to convert
 * @returns The created or existing Plan
 */
export async function convertSessionToPlan(
  session: {
    id: string;
    title: string;
    goalTag: string | null;
    voiceId: string;
    pace: string | null;
    affirmations: Array<{ text: string }>;
    solfeggioHz: number | null;
    frequencyHz: number | null;
  }
) {
  // P1-4.3: Check if Plan already exists for this Session (idempotent)
  const existingPlan = await prisma.plan.findFirst({
    where: {
      playbackSessions: {
        some: { id: session.id },
      },
      source: "premade",
    },
  });

  if (existingPlan) {
    return existingPlan;
  }

  // P1-4.3: Create Plan record from Session with consistent metadata
  const plan = await prisma.plan.create({
    data: {
      userId: null, // Premade plans are not user-owned initially
      source: "premade",
      title: session.title,
      intentSummary: session.goalTag ?? undefined,
      affirmationCount: session.affirmations.length,
      affirmations: JSON.stringify(session.affirmations.map(a => a.text)),
      voiceConfig: JSON.stringify({
        voiceId: session.voiceId,
        pace: session.pace || "slow",
      }),
      audioConfig: JSON.stringify({
        brainTrackMode: session.solfeggioHz ? "solfeggio" : (session.frequencyHz ? "binaural" : "default"),
        brainTrackId: session.solfeggioHz?.toString() || session.frequencyHz?.toString(),
        backgroundId: undefined,
      }),
      playbackSessions: {
        connect: { id: session.id }, // Link to original Session for playback
      },
    },
  });

  // P1-4.3: Update Session.planId to link back to the Plan (for isSaved checks)
  await prisma.session.update({
    where: { id: session.id },
    data: { planId: plan.id },
  });

  return plan;
}
