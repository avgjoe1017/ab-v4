/**
 * Admin Moderation Service
 * Handles content moderation actions for affirmations
 */

import { prisma } from "../../lib/db";

export interface ModerationStats {
  pending: number;
  approved: number;
  flagged: number;
  rejected: number;
  total: number;
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(): Promise<ModerationStats> {
  const [pending, approved, flagged, rejected, total] = await Promise.all([
    prisma.sessionAffirmation.count({ where: { moderationStatus: "pending" } }),
    prisma.sessionAffirmation.count({ where: { moderationStatus: "approved" } }),
    prisma.sessionAffirmation.count({ where: { moderationStatus: "flagged" } }),
    prisma.sessionAffirmation.count({ where: { moderationStatus: "rejected" } }),
    prisma.sessionAffirmation.count(),
  ]);

  return { pending, approved, flagged, rejected, total };
}

/**
 * Get sessions with flagged affirmations
 */
export async function getFlaggedSessions(options: {
  page?: number;
  limit?: number;
}) {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  const offset = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where: {
        affirmations: {
          some: {
            moderationStatus: { in: ["flagged", "pending"] },
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        ownerUser: { select: { id: true, email: true } },
        affirmations: {
          where: {
            moderationStatus: { in: ["flagged", "pending"] },
          },
          orderBy: { idx: "asc" },
        },
        _count: {
          select: {
            affirmations: true,
          },
        },
      },
    }),
    prisma.session.count({
      where: {
        affirmations: {
          some: {
            moderationStatus: { in: ["flagged", "pending"] },
          },
        },
      },
    }),
  ]);

  return {
    sessions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Moderate an affirmation (approve, reject, flag, or edit)
 */
export async function moderateAffirmationAction(
  affirmationId: string,
  action: "approve" | "reject" | "flag" | "edit",
  adminUserId: string,
  editedText?: string,
  reason?: string
) {
  const affirmation = await prisma.sessionAffirmation.findUnique({
    where: { id: affirmationId },
  });

  if (!affirmation) {
    throw new Error("Affirmation not found");
  }

  const updateData: any = {
    moderatedBy: adminUserId,
    moderatedAt: new Date(),
  };

  if (action === "approve") {
    updateData.moderationStatus = "approved";
    updateData.moderationReason = null;
  } else if (action === "reject") {
    updateData.moderationStatus = "rejected";
    updateData.moderationReason = reason || "Rejected by admin";
  } else if (action === "flag") {
    updateData.moderationStatus = "flagged";
    updateData.moderationReason = reason || "Flagged by admin";
    updateData.autoFlagged = false;
  } else if (action === "edit") {
    if (!editedText) {
      throw new Error("Edited text required for edit action");
    }
    updateData.originalText = affirmation.text;
    updateData.text = editedText;
    updateData.moderationStatus = "approved";
    updateData.moderationReason = null;
  }

  return prisma.sessionAffirmation.update({
    where: { id: affirmationId },
    data: updateData,
  });
}

/**
 * Bulk moderate affirmations
 */
export async function bulkModerateAffirmations(
  affirmationIds: string[],
  action: "approve" | "reject",
  adminUserId: string,
  reason?: string
) {
  const updateData: any = {
    moderatedBy: adminUserId,
    moderatedAt: new Date(),
  };

  if (action === "approve") {
    updateData.moderationStatus = "approved";
    updateData.moderationReason = null;
  } else {
    updateData.moderationStatus = "rejected";
    updateData.moderationReason = reason || "Rejected by admin";
  }

  return prisma.sessionAffirmation.updateMany({
    where: {
      id: { in: affirmationIds },
    },
    data: updateData,
  });
}

