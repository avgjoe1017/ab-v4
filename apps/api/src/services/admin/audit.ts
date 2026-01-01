/**
 * Audit Log Service
 * Records all admin actions for compliance and debugging
 */

import { prisma } from "../../lib/db";

export interface AuditLogEntry {
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: {
    before?: unknown;
    after?: unknown;
    [key: string]: unknown;
  };
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: entry.adminUserId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error("[Audit] Failed to create audit log entry:", error);
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  adminUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  const offset = (page - 1) * limit;

  const where: any = {};
  if (options.adminUserId) {
    where.adminUserId = options.adminUserId;
  }
  if (options.action) {
    where.action = options.action;
  }
  if (options.resourceType) {
    where.resourceType = options.resourceType;
  }
  if (options.resourceId) {
    where.resourceId = options.resourceId;
  }
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) {
      where.createdAt.gte = options.startDate;
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

