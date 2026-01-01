/**
 * Admin Authentication Middleware
 */

import type { Context } from "hono";
import { getSession } from "../services/admin/auth";
import { error } from "../index";

export interface AdminContext {
  adminUserId: string;
  email: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function requireAdminAuth(c: Context): Promise<AdminContext> {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const token = authHeader.substring(7);
  const session = getSession(token);

  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    adminUserId: session.adminUserId,
    email: session.email,
    role: session.role,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || undefined,
    userAgent: c.req.header("user-agent") || undefined,
  };
}

export async function requireAdminRole(
  c: Context,
  requiredRole: "ADMIN" | "OPERATOR" | "SUPPORT" | "READ_ONLY"
): Promise<AdminContext> {
  const admin = await requireAdminAuth(c);
  
  const roleHierarchy: Record<string, number> = {
    READ_ONLY: 1,
    SUPPORT: 2,
    OPERATOR: 3,
    ADMIN: 4,
  };

  if (roleHierarchy[admin.role] < roleHierarchy[requiredRole]) {
    throw new Error("FORBIDDEN");
  }

  return admin;
}

