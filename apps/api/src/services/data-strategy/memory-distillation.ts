/**
 * Memory Distillation Service
 * DATA_STRATEGY.md Section 2.2: Structured per-user memory with distillation
 * 
 * Converts user intent and outcomes into structured, versioned signals.
 * No long-term transcript storage - only distilled memory.
 */

import { prisma } from "../../lib/db";

export interface MemoryDistillationDelta {
  userId: string;
  deltaJson: Record<string, any>;
  sourceEvent?: string;
  sourceEventId?: string;
}

export interface UserMemory {
  preferredTopics?: string[]; // topic_id array
  preferredTone?: string; // "calm" | "energetic" | "grounded"
  preferredIntensity?: string; // "low" | "medium" | "high"
  lastIntent?: string; // Last topic_id
  lastPlanSettings?: {
    voiceId?: string;
    brainTrackMode?: string;
    backgroundId?: string;
    affirmationCount?: number;
  };
  recencyWeight?: number; // Decay factor (0-1)
  updatedAt?: Date;
}

/**
 * Apply a memory distillation delta to user memory
 */
export async function applyMemoryDelta(delta: MemoryDistillationDelta): Promise<void> {
  // Get or create user memory
  let userMemory = await prisma.userMemory.findUnique({
    where: { userId: delta.userId },
  });

  const currentMemory: UserMemory = userMemory
    ? JSON.parse(userMemory.memoryJson)
    : {};

  // Merge delta into current memory
  const updatedMemory: UserMemory = {
    ...currentMemory,
    ...delta.deltaJson,
    updatedAt: new Date(),
  };

  // Apply recency decay (older memories fade)
  if (updatedMemory.recencyWeight === undefined) {
    updatedMemory.recencyWeight = 1.0;
  } else {
    // Decay: reduce weight by 10% per week (approximate)
    const daysSinceUpdate = userMemory
      ? Math.floor((Date.now() - userMemory.lastDistilledAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const weeksSinceUpdate = daysSinceUpdate / 7;
    updatedMemory.recencyWeight = Math.max(0.1, updatedMemory.recencyWeight * Math.pow(0.9, weeksSinceUpdate));
  }

  // Save memory
  await prisma.userMemory.upsert({
    where: { userId: delta.userId },
    create: {
      userId: delta.userId,
      memoryJson: JSON.stringify(updatedMemory),
      lastDistilledAt: new Date(),
    },
    update: {
      memoryJson: JSON.stringify(updatedMemory),
      lastDistilledAt: new Date(),
    },
  });

  // Record delta for audit trail
  await prisma.memoryDistillationDelta.create({
    data: {
      userId: delta.userId,
      deltaJson: JSON.stringify(delta.deltaJson),
      sourceEvent: delta.sourceEvent,
      sourceEventId: delta.sourceEventId,
    },
  });
}

/**
 * Get user memory (for personalization)
 */
export async function getUserMemory(userId: string): Promise<UserMemory | null> {
  const userMemory = await prisma.userMemory.findUnique({
    where: { userId },
  });

  if (!userMemory) {
    return null;
  }

  return JSON.parse(userMemory.memoryJson) as UserMemory;
}

/**
 * Clear user memory (one-click "Clear my memory" semantics)
 */
export async function clearUserMemory(userId: string): Promise<void> {
  await prisma.userMemory.delete({
    where: { userId },
  });

  // Optionally: mark deltas as cleared (soft delete) or keep for audit
  // For now, we keep deltas for audit trail
}

/**
 * Prune stale memory (remove low-weight memories)
 * Should be run periodically (e.g., weekly)
 */
export async function pruneStaleMemory(threshold: number = 0.2): Promise<number> {
  const allMemories = await prisma.userMemory.findMany();

  let prunedCount = 0;
  for (const memory of allMemories) {
    const mem: UserMemory = JSON.parse(memory.memoryJson);
    
    if (mem.recencyWeight !== undefined && mem.recencyWeight < threshold) {
      // Reset to empty memory (keep structure, clear data)
      await prisma.userMemory.update({
        where: { userId: memory.userId },
        data: {
          memoryJson: JSON.stringify({ recencyWeight: 1.0 }),
          lastDistilledAt: new Date(),
        },
      });
      prunedCount++;
    }
  }

  return prunedCount;
}
