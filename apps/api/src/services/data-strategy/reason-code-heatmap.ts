/**
 * Reason Code Heatmap Service
 * DATA_STRATEGY.md Section 2.5: Failure and success drivers by prompt version, strategy, topic, tone, intensity
 * 
 * Makes iteration predictable and reduces post-merger integration risk.
 */

import { prisma } from "../../lib/db";

export interface ReasonCodeHeatmapCell {
  promptVersion: string | null;
  generationStrategy: string | null;
  topicId: string;
  toneClass: string | null;
  intensityBand: string | null;
  reasonCode: string;
  count: number;
  percentage: number;
  sampleSize: number;
}

/**
 * Get reason code heatmap
 * Shows distribution of reason codes by prompt version, strategy, topic, tone, intensity
 */
export async function getReasonCodeHeatmap(
  startDate?: Date,
  endDate?: Date,
  minimumN: number = 50
): Promise<ReasonCodeHeatmapCell[]> {
  const where: any = {
    reasonCode: {
      not: null,
    },
  };
  
  if (startDate || endDate) {
    where.occurredAt = {};
    if (startDate) {
      where.occurredAt.gte = startDate;
    }
    if (endDate) {
      where.occurredAt.lte = endDate;
    }
  }
  
  const events = await prisma.efficacyEvent.findMany({
    where,
    include: {
      taxonomyNode: {
        select: {
          nodeId: true,
        },
      },
    },
  });
  
  // Group by cell
  const cellMap = new Map<string, {
    promptVersion: string | null;
    generationStrategy: string | null;
    topicId: string;
    toneClass: string | null;
    intensityBand: string | null;
    reasonCodes: string[];
  }>();
  
  for (const event of events) {
    if (!event.reasonCode) continue;
    
    const topicNodeId = event.taxonomyNode?.nodeId || event.topicId;
    const cellKey = `${event.promptVersion || "null"}|${event.generationStrategy || "null"}|${topicNodeId}|${event.toneClass || "null"}|${event.intensityBand || "null"}`;
    
    if (!cellMap.has(cellKey)) {
      cellMap.set(cellKey, {
        promptVersion: event.promptVersion,
        generationStrategy: event.generationStrategy,
        topicId: topicNodeId,
        toneClass: event.toneClass,
        intensityBand: event.intensityBand,
        reasonCodes: [],
      });
    }
    
    cellMap.get(cellKey)!.reasonCodes.push(event.reasonCode);
  }
  
  // Calculate distribution for each cell
  const cells: ReasonCodeHeatmapCell[] = [];
  
  for (const [key, cell] of cellMap.entries()) {
    const sampleSize = cell.reasonCodes.length;
    
    // Apply minimum-n gating
    if (sampleSize < minimumN) {
      continue;
    }
    
    // Count reason codes
    const reasonCodeCounts: Record<string, number> = {};
    for (const reasonCode of cell.reasonCodes) {
      reasonCodeCounts[reasonCode] = (reasonCodeCounts[reasonCode] || 0) + 1;
    }
    
    // Create cell for each reason code
    for (const [reasonCode, count] of Object.entries(reasonCodeCounts)) {
      cells.push({
        promptVersion: cell.promptVersion,
        generationStrategy: cell.generationStrategy,
        topicId: cell.topicId,
        toneClass: cell.toneClass,
        intensityBand: cell.intensityBand,
        reasonCode,
        count,
        percentage: (count / sampleSize) * 100,
        sampleSize,
      });
    }
  }
  
  return cells;
}

/**
 * Get reason code taxonomy (for documentation)
 */
export function getReasonCodeTaxonomy(): {
  version: string;
  codes: Array<{
    code: string;
    category: string;
    description: string;
  }>;
} {
  return {
    version: "v1.0.0",
    codes: [
      {
        code: "too_generic",
        category: "quality",
        description: "User felt affirmations were too generic or not personalized",
      },
      {
        code: "not_felt_true",
        category: "quality",
        description: "User did not feel the affirmations were true or believable",
      },
      {
        code: "wrong_tone",
        category: "quality",
        description: "Tone did not match user's needs or preferences",
      },
      {
        code: "too_intense",
        category: "intensity",
        description: "Affirmations were too intense or overwhelming",
      },
      {
        code: "not_intense_enough",
        category: "intensity",
        description: "Affirmations were not intense or impactful enough",
      },
      {
        code: "audio_issue",
        category: "technical",
        description: "Audio playback issue (voice, background, or brain track)",
      },
      {
        code: "time_constraint",
        category: "usage",
        description: "User ran out of time or hit free tier cap",
      },
      {
        code: "distraction",
        category: "usage",
        description: "User was distracted or interrupted",
      },
      {
        code: "not_relevant",
        category: "relevance",
        description: "Content was not relevant to user's current needs",
      },
      {
        code: "other",
        category: "other",
        description: "Other reason not captured above",
      },
    ],
  };
}
