/**
 * Admin Authentication Service
 * Simple session-based auth for v1 (can be upgraded to JWT/OAuth later)
 */

import { prisma } from "../../lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export type AdminRole = "ADMIN" | "OPERATOR" | "SUPPORT" | "READ_ONLY";

export interface AdminSession {
  adminUserId: string;
  email: string;
  role: AdminRole;
  name?: string;
}

// In-memory session store (v1 - upgrade to Redis in production)
const sessions = new Map<string, AdminSession>();

/**
 * Create admin user (for initial setup)
 */
export async function createAdminUser(
  email: string,
  password: string,
  role: AdminRole = "ADMIN",
  name?: string
): Promise<{ id: string; email: string; role: string }> {
  const passwordHash = await bcrypt.hash(password, 10);
  
  const admin = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      role,
      name,
      isActive: true,
    },
  });

  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  };
}

/**
 * Authenticate admin user
 */
export async function authenticateAdmin(
  email: string,
  password: string
): Promise<AdminSession | null> {
  const admin = await prisma.adminUser.findUnique({
    where: { email },
  });

  if (!admin || !admin.isActive) {
    return null;
  }

  const isValid = await bcrypt.compare(password, admin.passwordHash);
  if (!isValid) {
    return null;
  }

  // Update last login
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    adminUserId: admin.id,
    email: admin.email,
    role: admin.role as AdminRole,
    name: admin.name || undefined,
  };
}

/**
 * Create session token
 */
export function createSessionToken(session: AdminSession): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, session);
  return token;
}

/**
 * Get session from token
 */
export function getSession(token: string): AdminSession | null {
  return sessions.get(token) || null;
}

/**
 * Destroy session
 */
export function destroySession(token: string): void {
  sessions.delete(token);
}

/**
 * Check if user has required role
 */
export function hasRole(session: AdminSession | null, requiredRole: AdminRole): boolean {
  if (!session) return false;
  
  const roleHierarchy: Record<AdminRole, number> = {
    READ_ONLY: 1,
    SUPPORT: 2,
    OPERATOR: 3,
    ADMIN: 4,
  };

  return roleHierarchy[session.role] >= roleHierarchy[requiredRole];
}

