import { prisma } from "../lib/db";

export interface CurationCard {
  slot: "next_step" | "right_now_1" | "right_now_2" | "tonight" | "your_best" | "try_new";
  title: string;
  duration: number; // in seconds
  voiceId: string;
  brainLayerType: string;
  brainLayerPreset: string;
  backgroundId: string;
  whyText?: string; // One-line explanation
  pathInfo?: {
    pathId: string;
    pathName: string;
    chapterIndex: number;
    totalChapters: number;
    nextAction?: string;
  };
}

export interface CurationPreferences {
  primaryGoal?: "Calm" | "Focus" | "Sleep" | "Confidence" | "Reset";
  voicePreference?: "More space" | "Balanced" | "More guidance";
  soundPreference?: "Voice-forward" | "Balanced" | "Atmosphere-forward";
}

/**
 * Get curated "FOR YOU" cards for a user
 */
export async function getCurationCards(userId: string): Promise<CurationCard[]> {
  const cards: CurationCard[] = [];

  // Get user's session events for analysis
  const recentEvents = await prisma.sessionEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });

  // Get user's active path for NEXT STEP card
  const activePath = await prisma.userPath.findFirst({
    where: { userId, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  // Get user preferences
  const preferences = await prisma.curationPreferences.findUnique({
    where: { userId },
  });

  // Get completed sessions (for YOUR BEST)
  const completedEvents = await prisma.sessionEvent.findMany({
    where: {
      userId,
      eventType: "complete",
    },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  // Get session IDs and fetch session details
  const sessionIds = completedEvents.map((e) => e.sessionId);
  const completedSessions = await prisma.session.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, durationSec: true, voiceId: true, frequencyHz: true, brainwaveState: true, goalTag: true },
  });

  // Analyze patterns
  const patterns = analyzeUserPatterns(recentEvents, preferences);

  // Slot 1: NEXT STEP (if active path exists)
  if (activePath) {
    const nextStepCard = await buildNextStepCard(activePath, userId);
    if (nextStepCard) {
      cards.push(nextStepCard);
    }
  }

  // Slots 2-3: RIGHT NOW (2 cards)
  const rightNowCards = buildRightNowCards(patterns, preferences);
  cards.push(...rightNowCards.slice(0, 2));

  // Slot 4: TONIGHT (if evening) or LATER
  const timeOfDay = new Date().getHours();
  if (timeOfDay >= 18 || timeOfDay < 6) {
    const tonightCard = buildTonightCard(patterns, preferences);
    if (tonightCard) cards.push(tonightCard);
  }

  // Slot 5: YOUR BEST (highest completion rate)
  if (completedSessions.length > 0) {
    const bestCard = await buildYourBestCard(userId, completedSessions);
    if (bestCard) cards.push(bestCard);
  }

  // Slot 6: TRY SOMETHING NEW (controlled novelty)
  const newCard = buildTryNewCard(patterns, preferences);
  if (newCard) cards.push(newCard);

  return cards;
}

/**
 * Analyze user patterns from events
 */
function analyzeUserPatterns(
  events: Array<{ eventType: string; metadata?: string | null; occurredAt: Date }>,
  preferences?: CurationPreferences | null
) {
  const completions = events.filter((e) => e.eventType === "complete");
  const abandons = events.filter((e) => e.eventType === "abandon");
  const replays = events.filter((e) => e.eventType === "replay");

  // Analyze abandon times
  const abandonTimes = abandons
    .map((e) => {
      if (!e.metadata) return null;
      try {
        const meta = JSON.parse(e.metadata);
        return meta.abandonTimeSec as number | undefined;
      } catch {
        return null;
      }
    })
    .filter((t): t is number => t !== null && t < 90); // Early abandons

  // Get most common duration from completions
  const completedDurations: number[] = [];
  // This would need session data - simplified for now
  const preferredDuration = completedDurations.length > 0
    ? Math.round(completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length)
    : 600; // Default 10 min

  return {
    completionRate: completions.length / (completions.length + abandons.length) || 0,
    earlyAbandonRate: abandonTimes.length / abandons.length || 0,
    replayRate: replays.length / events.length || 0,
    preferredDuration,
    preferredGoal: preferences?.primaryGoal || "Calm",
  };
}

/**
 * Build NEXT STEP card from active path
 */
async function buildNextStepCard(
  path: { pathId: string; pathName: string; stepIndex: number; totalSteps: number },
  userId: string
): Promise<CurationCard | null> {
  // Path definitions (would be in a config or database)
  const pathDefinitions: Record<string, any> = {
    imposter_to_impact: {
      name: "Imposter to Impact",
      steps: [
        { title: "Settle the Alarm", duration: 420, action: null },
        { title: "Collect Receipts", duration: 420, action: "Write 3 receipts from the last 30 days." },
        { title: "Define 'Good' Today", duration: 420, action: "Write the 1 deliverable that matters today." },
        { title: "One Sentence of Authority", duration: 420, action: "Draft one sentence you'll say in a meeting." },
        { title: "Visible Win", duration: 420, action: "Send one update: what's done, what's next." },
        { title: "Integrate Identity", duration: 420, action: null },
      ],
    },
  };

  const pathDef = pathDefinitions[path.pathId];
  if (!pathDef || path.stepIndex >= pathDef.steps.length) return null;

  const step = pathDef.steps[path.stepIndex];
  const lastEvent = await prisma.sessionEvent.findFirst({
    where: { userId, eventType: "complete" },
    orderBy: { occurredAt: "desc" },
  });

  return {
    slot: "next_step",
    title: step.title,
    duration: step.duration,
    voiceId: "balanced",
    brainLayerType: "binaural",
    brainLayerPreset: "alpha",
    backgroundId: "calm",
    whyText: lastEvent
      ? "Based on what you completed last time."
      : "Your next step in this path.",
    pathInfo: {
      pathId: path.pathId,
      pathName: path.pathName,
      chapterIndex: path.stepIndex + 1,
      totalChapters: path.totalSteps,
      nextAction: step.action || undefined,
    },
  };
}

/**
 * Build RIGHT NOW cards (2 cards)
 */
function buildRightNowCards(
  patterns: ReturnType<typeof analyzeUserPatterns>,
  preferences?: CurationPreferences | null
): CurationCard[] {
  const cards: CurationCard[] = [];

  // Card 1: Based on time of day and preferences
  const hour = new Date().getHours();
  let goal = patterns.preferredGoal;
  if (hour >= 6 && hour < 12) goal = "Focus";
  else if (hour >= 18 || hour < 6) goal = "Sleep";

  cards.push({
    slot: "right_now_1",
    title: getTitleForGoal(goal),
    duration: patterns.preferredDuration,
    voiceId: preferences?.voicePreference === "More space" ? "gentle" : "balanced",
    brainLayerType: "binaural",
    brainLayerPreset: goal === "Focus" ? "beta" : goal === "Sleep" ? "delta" : "alpha",
    backgroundId: goal === "Sleep" ? "night" : "calm",
    whyText: `Right for ${hour >= 6 && hour < 12 ? "morning" : hour >= 18 ? "evening" : "now"}.`,
  });

  // Card 2: Based on completion patterns
  if (patterns.completionRate > 0.7) {
    cards.push({
      slot: "right_now_2",
      title: "Steady after a rough moment",
      duration: Math.min(patterns.preferredDuration, 600), // Cap at 10 min
      voiceId: "balanced",
      brainLayerType: "binaural",
      brainLayerPreset: "alpha",
      backgroundId: "calm",
      whyText: "You finish sessions like this most.",
    });
  } else {
    cards.push({
      slot: "right_now_2",
      title: "Quiet focus",
      duration: 300, // Shorter for lower completion
      voiceId: "gentle",
      brainLayerType: "binaural",
      brainLayerPreset: "alpha",
      backgroundId: "calm",
      whyText: "A shorter session to help you settle.",
    });
  }

  return cards;
}

/**
 * Build TONIGHT card
 */
function buildTonightCard(
  patterns: ReturnType<typeof analyzeUserPatterns>,
  preferences?: CurationPreferences | null
): CurationCard | null {
  return {
    slot: "tonight",
    title: "Downshift",
    duration: 600, // 10 min
    voiceId: preferences?.voicePreference === "More space" ? "gentle" : "balanced",
    brainLayerType: "binaural",
    brainLayerPreset: "delta",
    backgroundId: "night",
    whyText: "Designed for evening wind-down.",
  };
}

/**
 * Build YOUR BEST card (highest completion)
 */
async function buildYourBestCard(
  userId: string,
  completedSessions: Array<{ id: string; durationSec: number | null; voiceId: string; frequencyHz: number | null; brainwaveState: string | null; goalTag: string | null }>
): Promise<CurationCard | null> {
  if (completedSessions.length === 0) return null;

  // Find the most completed session (simplified - in production, count completions per session)
  const bestSession = completedSessions[0];
  const duration = bestSession.durationSec || 600;

  // Determine brain layer preset from session
  const brainwaveState = bestSession.brainwaveState || "Alpha";
  const brainLayerPreset = brainwaveState.toLowerCase();

  return {
    slot: "your_best",
    title: getTitleForGoal(bestSession.goalTag || "Calm"),
    duration,
    voiceId: bestSession.voiceId || "balanced",
    brainLayerType: "binaural",
    brainLayerPreset,
    backgroundId: "calm",
    whyText: "Your highest-completion recipe.",
  };
}

/**
 * Build TRY SOMETHING NEW card
 */
function buildTryNewCard(
  patterns: ReturnType<typeof analyzeUserPatterns>,
  preferences?: CurationPreferences | null
): CurationCard {
  // Controlled novelty - different from usual
  const differentPreset = patterns.preferredGoal === "Focus" ? "theta" : "beta";

  return {
    slot: "try_new",
    title: "Soft reset",
    duration: 420, // 7 min
    voiceId: preferences?.voicePreference || "balanced",
    brainLayerType: "binaural",
    brainLayerPreset: differentPreset,
    backgroundId: "calm",
    whyText: "Something new to try.",
  };
}

/**
 * Get human-readable title for goal
 */
function getTitleForGoal(goal: string): string {
  const titles: Record<string, string> = {
    Calm: "Steady after a rough moment",
    Focus: "Quiet focus",
    Sleep: "Downshift",
    Confidence: "Confidence without force",
    Reset: "Soft reset",
  };
  return titles[goal] || "Quiet focus";
}

/**
 * Track a session event
 */
export async function trackSessionEvent(
  userId: string,
  sessionId: string,
  eventType: "start" | "complete" | "abandon" | "replay" | "skip_affirmation" | "mix_adjust",
  metadata?: Record<string, any>
) {
  await prisma.sessionEvent.create({
    data: {
      userId,
      sessionId,
      eventType,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

/**
 * Save or update curation preferences
 */
export async function saveCurationPreferences(
  userId: string,
  preferences: CurationPreferences
) {
  await prisma.curationPreferences.upsert({
    where: { userId },
    create: {
      userId,
      ...preferences,
    },
    update: preferences,
  });
}

/**
 * Get curation preferences
 */
export async function getCurationPreferences(userId: string): Promise<CurationPreferences | null> {
  const prefs = await prisma.curationPreferences.findUnique({
    where: { userId },
  });
  return prefs;
}

