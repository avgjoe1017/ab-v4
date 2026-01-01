import type { EntitlementV3 } from "./schemas";

// If you want to derive on server and still share logic, put it here.
export function deriveEntitlement(raw: {
  plan: EntitlementV3["plan"];
  status: EntitlementV3["status"];
  renewsAt?: string;
  source?: EntitlementV3["source"];
  limits: EntitlementV3["limits"];
  remainingFreeGenerationsToday: number;
}): EntitlementV3 {
  const isProActive = raw.plan === "pro" && (raw.status === "active" || raw.status === "grace");
  const canCreateSession = isProActive || raw.limits.maxSessionLengthSec > 0;
  const canGenerateAudio = isProActive || raw.remainingFreeGenerationsToday > 0;

  return {
    plan: raw.plan,
    status: raw.status,
    renewsAt: raw.renewsAt,
    source: raw.source,
    limits: raw.limits,
    canCreateSession,
    canGenerateAudio,
    remainingFreeGenerationsToday: raw.remainingFreeGenerationsToday,
    maxSessionLengthSecEffective: raw.limits.maxSessionLengthSec,
  };
}
