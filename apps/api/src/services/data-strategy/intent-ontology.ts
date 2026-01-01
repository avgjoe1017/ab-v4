/**
 * Intent Ontology Service
 * DATA_STRATEGY.md Section 2.1: Versioned hierarchical taxonomy of affirmation intents
 * 
 * This is defensible IP that compresses user needs into stable IDs.
 * Powers personalization, analytics, and iteration.
 */

import { prisma } from "../../lib/db";

export interface IntentTaxonomyNode {
  nodeId: string;
  parentNodeId?: string;
  label: string;
  description?: string;
  sensitivityTier: "low" | "medium" | "high" | "crisis";
}

export interface IntentMappingResult {
  topicId: string;
  confidence: number;
  mapperVersion: string;
  signals?: Record<string, any>;
}

/**
 * Create or update intent taxonomy node
 */
export async function upsertTaxonomyNode(
  version: number,
  node: IntentTaxonomyNode
): Promise<void> {
  await prisma.intentTaxonomyNode.upsert({
    where: {
      version_nodeId: {
        version,
        nodeId: node.nodeId,
      },
    },
    create: {
      version,
      nodeId: node.nodeId,
      parentNodeId: node.parentNodeId || null,
      label: node.label,
      description: node.description || null,
      sensitivityTier: node.sensitivityTier,
    },
    update: {
      label: node.label,
      description: node.description || null,
      sensitivityTier: node.sensitivityTier,
    },
  });
}

/**
 * Map user message to intent taxonomy node
 * This is a simplified mapper - can be enhanced with ML later
 */
export async function mapIntent(
  userId: string | null,
  message: string,
  threadId?: string,
  planId?: string
): Promise<IntentMappingResult> {
  // Simplified intent mapper (can be replaced with ML model)
  // For now, uses keyword matching and pattern detection
  
  const mapperVersion = "v1.0.0";
  const signals: Record<string, any> = {};
  
  // Normalize message
  const normalized = message.toLowerCase();
  
  // Intent clusters (from V4 chat service patterns)
  const intentClusters: Array<{
    topicId: string;
    keywords: string[];
    patterns: RegExp[];
  }> = [
    {
      topicId: "confidence.work",
      keywords: ["confident", "confidence", "imposter", "work", "career", "professional"],
      patterns: [/confident.*work|work.*confident|imposter/i],
    },
    {
      topicId: "anxiety.calm",
      keywords: ["anxious", "anxiety", "worried", "calm", "peace", "relax"],
      patterns: [/anxious|anxiety|worried|calm.*down/i],
    },
    {
      topicId: "sleep.rest",
      keywords: ["sleep", "rest", "insomnia", "tired", "exhausted"],
      patterns: [/sleep|insomnia|can't.*sleep|tired/i],
    },
    {
      topicId: "focus.concentration",
      keywords: ["focus", "concentrate", "distracted", "attention"],
      patterns: [/focus|concentrate|distracted/i],
    },
    {
      topicId: "self_love.acceptance",
      keywords: ["self-love", "self love", "acceptance", "worthy", "enough"],
      patterns: [/self.*love|accept.*self|worthy|enough/i],
    },
  ];
  
  // Score each intent cluster
  let bestMatch: { topicId: string; score: number } | null = null;
  
  for (const cluster of intentClusters) {
    let score = 0;
    
    // Keyword matching
    for (const keyword of cluster.keywords) {
      if (normalized.includes(keyword)) {
        score += 1;
      }
    }
    
    // Pattern matching
    for (const pattern of cluster.patterns) {
      if (pattern.test(message)) {
        score += 2;
      }
    }
    
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { topicId: cluster.topicId, score };
    }
  }
  
  // Default to generic if no match
  const topicId = bestMatch && bestMatch.score > 0 
    ? bestMatch.topicId 
    : "general.wellness";
  
  const confidence = bestMatch 
    ? Math.min(1.0, bestMatch.score / 5.0) // Normalize to 0-1
    : 0.3; // Low confidence for default
  
  signals.keywordMatches = bestMatch?.score || 0;
  signals.messageLength = message.length;
  
  // Store mapping (first ensure taxonomy node exists, or create it)
  // For now, we'll use a placeholder approach - in production, taxonomy nodes should be seeded
  let taxonomyNode = await prisma.intentTaxonomyNode.findFirst({
    where: {
      nodeId: topicId,
      version: 1,
    },
  });

  if (!taxonomyNode) {
    // Create node if it doesn't exist (auto-create for now)
    taxonomyNode = await prisma.intentTaxonomyNode.create({
      data: {
        version: 1,
        nodeId: topicId,
        label: topicId.replace(/\./g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        sensitivityTier: "low",
      },
    });
  }

  if (userId || threadId || planId) {
    await prisma.intentMapping.create({
      data: {
        userId: userId || null,
        threadId: threadId || null,
        planId: planId || null,
        topicId: taxonomyNode.id, // Use node's ID, not nodeId string
        confidence,
        mapperVersion,
        signals: JSON.stringify(signals),
      },
    });
  }
  
  return {
    topicId,
    confidence,
    mapperVersion,
    signals,
  };
}

/**
 * Get intent taxonomy tree for a version
 */
export async function getTaxonomyTree(version: number = 1): Promise<Array<{
  nodeId: string;
  parentNodeId: string | null;
  label: string;
  description: string | null;
  sensitivityTier: string;
}>> {
  return await prisma.intentTaxonomyNode.findMany({
    where: {
      version,
      isActive: true,
    },
    orderBy: {
      nodeId: "asc",
    },
    select: {
      nodeId: true,
      parentNodeId: true,
      label: true,
      description: true,
      sensitivityTier: true,
    },
  });
}

/**
 * Export intent ontology as JSON (for data room)
 */
export async function exportOntology(version: number = 1): Promise<{
  version: number;
  nodes: Array<{
    nodeId: string;
    parentNodeId: string | null;
    label: string;
    description: string | null;
    sensitivityTier: string;
  }>;
  edges: Array<{
    parent: string;
    child: string;
  }>;
}> {
  const nodes = await getTaxonomyTree(version);
  
  const edges = nodes
    .filter((n) => n.parentNodeId)
    .map((n) => ({
      parent: n.parentNodeId!,
      child: n.nodeId,
    }));
  
  return {
    version,
    nodes,
    edges,
  };
}
