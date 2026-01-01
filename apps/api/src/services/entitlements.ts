import { prisma } from "../lib/db";
import { type EntitlementV3 } from "@ab/contracts";
import { getRevenueCatSubscription, hasProSubscription } from "./revenuecat";
import { isDevelopment } from "../lib/config";

const FREE_TIER_LIMITS = {
    dailyGenerations: isDevelopment() ? Number.MAX_SAFE_INTEGER : 2, // Unlimited in dev, 2 in production
    maxSessionLengthSec: Number.MAX_SAFE_INTEGER, // Infinite for V3 Loop
};

const PRO_TIER_LIMITS = {
    dailyGenerations: Number.MAX_SAFE_INTEGER, // Unlimited
    maxSessionLengthSec: Number.MAX_SAFE_INTEGER, // Infinite for V3 Loop
};

export async function getEntitlement(userId: string | null): Promise<EntitlementV3> {
    // Phase 6.3: Check RevenueCat subscription if configured
    // Fall back to free tier if not configured or no subscription
    let plan: "free" | "pro" = "free";
    let source: "internal" | "revenuecat" = "internal";
    
    if (userId) {
        const hasPro = await hasProSubscription(userId);
        if (hasPro) {
            plan = "pro";
            source = "revenuecat";
        }
    }
    
    const limits = plan === "pro" ? PRO_TIER_LIMITS : FREE_TIER_LIMITS;

    let remainingFreeGenerationsToday = limits.dailyGenerations;

    if (userId && plan === "free") {
        // Count sessions created by this user since midnight UTC (only for free tier)
        const midnight = new Date();
        midnight.setUTCHours(0, 0, 0, 0);

        const count = await prisma.session.count({
            where: {
                ownerUserId: userId,
                createdAt: { gte: midnight }
            }
        });

        remainingFreeGenerationsToday = Math.max(0, limits.dailyGenerations - count);
    } else if (plan === "pro") {
        // Pro tier has unlimited generations
        remainingFreeGenerationsToday = Number.MAX_SAFE_INTEGER;
    }

    return {
        plan,
        status: "active",
        source,
        limits: {
            dailyGenerations: limits.dailyGenerations,
            maxSessionLengthSec: limits.maxSessionLengthSec,
            offlineDownloads: plan === "pro", // Pro tier can download (when implemented)
        },
        canCreateSession: remainingFreeGenerationsToday > 0,
        canGenerateAudio: remainingFreeGenerationsToday > 0,
        remainingFreeGenerationsToday: plan === "pro" ? Number.MAX_SAFE_INTEGER : remainingFreeGenerationsToday,
        maxSessionLengthSecEffective: limits.maxSessionLengthSec,
    };
}
