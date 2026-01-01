/**
 * Efficacy Map Service
 * DATA_STRATEGY.md Section 2.3: Outcomes matrix by topic × tone × intensity
 * 
 * Evidence engine behind "documented lift" - drives roadmap and content decisions.
 * Statistical rigor: minimum-n gating, confidence intervals.
 */

import { prisma } from "../../lib/db";

export interface EfficacyEventInput {
  userId?: string;
  planId?: string;
  sessionId?: string;
  topicId: string; // Can be nodeId string or taxonomy node ID
  toneClass?: string;
  intensityBand?: string;
  promptVersion?: string;
  generationStrategy?: string;
  outcomeType: "completion" | "replay" | "felt_true" | "edit_distance" | "abandon";
  outcomeValue?: number;
  reasonCode?: string;
}

/**
 * Record an efficacy event
 */
export async function recordEfficacyEvent(event: EfficacyEventInput): Promise<void> {
  // Resolve topicId to taxonomy node ID if it's a nodeId string
  let taxonomyNodeId = event.topicId;
  
  // Check if it's a UUID (already an ID) or a nodeId string
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(event.topicId)) {
    // It's a nodeId string, find or create the taxonomy node
    let taxonomyNode = await prisma.intentTaxonomyNode.findFirst({
      where: {
        nodeId: event.topicId,
        version: 1,
      },
    });

    if (!taxonomyNode) {
      // Create node if it doesn't exist
      taxonomyNode = await prisma.intentTaxonomyNode.create({
        data: {
          version: 1,
          nodeId: event.topicId,
          label: event.topicId.replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          sensitivityTier: "low",
        },
      });
    }
    
    taxonomyNodeId = taxonomyNode.id;
  }

  await prisma.efficacyEvent.create({
    data: {
      userId: event.userId || null,
      planId: event.planId || null,
      sessionId: event.sessionId || null,
      topicId: taxonomyNodeId,
      toneClass: event.toneClass || null,
      intensityBand: event.intensityBand || null,
      promptVersion: event.promptVersion || null,
      generationStrategy: event.generationStrategy || null,
      outcomeType: event.outcomeType,
      outcomeValue: event.outcomeValue || null,
      reasonCode: event.reasonCode || null,
    },
  });
}

export interface EfficacyCell {
  topicId: string;
  toneClass: string | null;
  intensityBand: string | null;
  promptVersion: string | null;
  generationStrategy: string | null;
  sampleSize: number;
  completionRate?: number;
  replayRate?: number;
  feltTrueAvg?: number;
  editDistanceAvg?: number;
  abandonRate?: number;
  reasonCodeDistribution?: Record<string, number>;
}

/**
 * Get efficacy map with minimum-n gating
 * Only returns cells that meet the minimum sample size threshold
 */
export async function getEfficacyMap(
  startDate?: Date,
  endDate?: Date,
  minimumN: number = 50
): Promise<EfficacyCell[]> {
  const where: any = {};
  
  if (startDate || endDate) {
    where.occurredAt = {};
    if (startDate) {
      where.occurredAt.gte = startDate;
    }
    if (endDate) {
      where.occurredAt.lte = endDate;
    }
  }
  
  // Group by topic × tone × intensity × prompt × strategy
  const events = await prisma.efficacyEvent.findMany({
    where,
    select: {
      topicId: true,
      toneClass: true,
      intensityBand: true,
      promptVersion: true,
      generationStrategy: true,
      outcomeType: true,
      outcomeValue: true,
      reasonCode: true,
    },
  });
  
  // Aggregate by cell
  const cellMap = new Map<string, {
    topicId: string;
    toneClass: string | null;
    intensityBand: string | null;
    promptVersion: string | null;
    generationStrategy: string | null;
    events: Array<{
      outcomeType: string;
      outcomeValue: number | null;
      reasonCode: string | null;
    }>;
  }>();
  
  for (const event of events) {
    const topicNodeId = event.taxonomyNode?.nodeId || event.topicId;
    const cellKey = `${topicNodeId}|${event.toneClass || "null"}|${event.intensityBand || "null"}|${event.promptVersion || "null"}|${event.generationStrategy || "null"}`;
    
    if (!cellMap.has(cellKey)) {
      cellMap.set(cellKey, {
        topicId: topicNodeId,
        toneClass: event.toneClass,
        intensityBand: event.intensityBand,
        promptVersion: event.promptVersion,
        generationStrategy: event.generationStrategy,
        events: [],
      });
    }
    
    cellMap.get(cellKey)!.events.push({
      outcomeType: event.outcomeType,
      outcomeValue: event.outcomeValue,
      reasonCode: event.reasonCode,
    });
  }
  
  // Calculate metrics for each cell
  const cells: EfficacyCell[] = [];
  
  for (const [key, cell] of cellMap.entries()) {
    const sampleSize = cell.events.length;
    
    // Apply minimum-n gating
    if (sampleSize < minimumN) {
      continue;
    }
    
    // Calculate metrics
    const completionEvents = cell.events.filter((e) => e.outcomeType === "completion");
    const replayEvents = cell.events.filter((e) => e.outcomeType === "replay");
    const feltTrueEvents = cell.events.filter((e) => e.outcomeType === "felt_true" && e.outcomeValue !== null);
    const editDistanceEvents = cell.events.filter((e) => e.outcomeType === "edit_distance" && e.outcomeValue !== null);
    const abandonEvents = cell.events.filter((e) => e.outcomeType === "abandon");
    
    const efficacyCell: EfficacyCell = {
      topicId: cell.topicId,
      toneClass: cell.toneClass,
      intensityBand: cell.intensityBand,
      promptVersion: cell.promptVersion,
      generationStrategy: cell.generationStrategy,
      sampleSize,
    };
    
    // Completion rate (Wilson interval can be calculated client-side)
    if (completionEvents.length > 0) {
      efficacyCell.completionRate = completionEvents.length / sampleSize;
    }
    
    // Replay rate
    if (replayEvents.length > 0) {
      efficacyCell.replayRate = replayEvents.length / sampleSize;
    }
    
    // Felt true average
    if (feltTrueEvents.length > 0) {
      const sum = feltTrueEvents.reduce((acc, e) => acc + (e.outcomeValue || 0), 0);
      efficacyCell.feltTrueAvg = sum / feltTrueEvents.length;
    }
    
    // Edit distance average
    if (editDistanceEvents.length > 0) {
      const sum = editDistanceEvents.reduce((acc, e) => acc + (e.outcomeValue || 0), 0);
      efficacyCell.editDistanceAvg = sum / editDistanceEvents.length;
    }
    
    // Abandon rate
    if (abandonEvents.length > 0) {
      efficacyCell.abandonRate = abandonEvents.length / sampleSize;
    }
    
    // Reason code distribution
    const reasonCodeCounts: Record<string, number> = {};
    for (const event of cell.events) {
      if (event.reasonCode) {
        reasonCodeCounts[event.reasonCode] = (reasonCodeCounts[event.reasonCode] || 0) + 1;
      }
    }
    if (Object.keys(reasonCodeCounts).length > 0) {
      efficacyCell.reasonCodeDistribution = reasonCodeCounts;
    }
    
    cells.push(efficacyCell);
  }
  
  return cells;
}

/**
 * Get efficacy summary for a specific topic (by nodeId string)
 */
export async function getTopicEfficacy(
  topicNodeId: string,
  minimumN: number = 50
): Promise<EfficacyCell[]> {
  const cells = await getEfficacyMap(undefined, undefined, minimumN);
  return cells.filter((c) => c.topicId === topicNodeId);
}
