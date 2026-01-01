/**
 * Consent Ledger Service
 * DATA_STRATEGY.md Section 3.2: Versioned consent tracking with copy IDs
 * 
 * Every consent state must tie to the exact copy shown to the user.
 * This ensures diligence-proof consent provenance.
 */

import { prisma } from "../../lib/db";

export interface ConsentToggle {
  name: "personalize_experience" | "improve_product" | "share_insights" | "allow_research_samples";
  value: boolean;
}

export interface ConsentRecord {
  toggleName: string;
  toggleValue: boolean;
  consentCopyId: string;
  consentVersionId?: string;
  appVersion?: string;
  locale?: string;
  timezoneOffsetMinutes?: number;
}

/**
 * Record a consent toggle change
 */
export async function recordConsentChange(
  userId: string,
  record: ConsentRecord
): Promise<void> {
  await prisma.consentLedger.create({
    data: {
      userId,
      toggleName: record.toggleName,
      toggleValue: record.toggleValue,
      consentCopyId: record.consentCopyId,
      consentVersionId: record.consentVersionId,
      appVersion: record.appVersion,
      locale: record.locale,
      timezoneOffsetMinutes: record.timezoneOffsetMinutes,
    },
  });
}

/**
 * Get current consent state for a user
 * Returns the most recent consent state for each toggle
 */
export async function getCurrentConsentState(userId: string): Promise<Record<string, boolean>> {
  const latestConsents = await prisma.consentLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    distinct: ["toggleName"],
  });

  const state: Record<string, boolean> = {};
  for (const consent of latestConsents) {
    if (!state[consent.toggleName]) {
      state[consent.toggleName] = consent.toggleValue;
    }
  }

  return state;
}

/**
 * Get consent history for a user (for audit/debugging)
 */
export async function getConsentHistory(
  userId: string,
  toggleName?: string
): Promise<Array<{
  id: string;
  toggleName: string;
  toggleValue: boolean;
  consentCopyId: string;
  consentVersionId: string | null;
  appVersion: string | null;
  locale: string | null;
  createdAt: Date;
}>> {
  const where: any = { userId };
  if (toggleName) {
    where.toggleName = toggleName;
  }

  return await prisma.consentLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      toggleName: true,
      toggleValue: true,
      consentCopyId: true,
      consentVersionId: true,
      appVersion: true,
      locale: true,
      createdAt: true,
    },
  });
}

/**
 * Check if user has consented to a specific toggle
 */
export async function hasConsent(
  userId: string,
  toggleName: ConsentToggle["name"]
): Promise<boolean> {
  const latest = await prisma.consentLedger.findFirst({
    where: {
      userId,
      toggleName,
    },
    orderBy: { createdAt: "desc" },
  });

  return latest?.toggleValue ?? false;
}
