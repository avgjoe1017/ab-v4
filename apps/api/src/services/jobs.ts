import { Job } from "@prisma/client";
import { prisma } from "../lib/db";

export async function createJob(type: string, payload: any): Promise<Job> {
    return prisma.job.create({
        data: {
            type,
            status: "pending",
            payload: JSON.stringify(payload),
        },
    });
}

/**
 * Find or create a job for a given session (idempotent)
 * Returns existing pending/processing job if one exists, otherwise creates new one
 */
export async function findOrCreateJobForSession(
    type: string, 
    sessionId: string,
    payload?: any
): Promise<Job> {
    // Check for existing pending or processing job for this session
    const existingJobs = await prisma.job.findMany({
        where: {
            type,
            status: { in: ["pending", "processing"] },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
    });

    // Parse payload to check sessionId match precisely
    for (const job of existingJobs) {
        try {
            const jobPayload = JSON.parse(job.payload);
            if (jobPayload.sessionId === sessionId) {
                return job; // Return existing job
            }
        } catch {
            // If payload parsing fails, continue to next job
        }
    }

    // No existing job found, create new one
    return createJob(type, payload || { sessionId });
}

export async function getJob(id: string): Promise<Job | null> {
    return prisma.job.findUnique({ where: { id } });
}

export async function updateJobStatus(
    id: string,
    status: "pending" | "processing" | "completed" | "failed",
    result?: any,
    error?: string
) {
    const updateData: any = {
        status,
        result: result ? JSON.stringify(result) : undefined,
        error,
    };

    // Track timing
    if (status === "processing") {
        updateData.startedAt = new Date();
    } else if (status === "completed" || status === "failed") {
        updateData.finishedAt = new Date();
    }

    await prisma.job.update({
        where: { id },
        data: updateData,
    });
}

// Simple in-memory "worker" trigger for MVP
// In production, this would be a separate process listening to a queue
export async function triggerJobProcessing(
    jobId: string,
    processor: (payload: any) => Promise<any>
) {
    // Fire and forget (don't await this in the API handler)
    (async () => {
        try {
            await updateJobStatus(jobId, "processing");
            const job = await getJob(jobId);
            if (!job) return;

            const payload = JSON.parse(job.payload);
            const result = await processor(payload);
            await updateJobStatus(jobId, "completed", result);
        } catch (e: any) {
            console.error(`Job ${jobId} failed:`, e);
            await updateJobStatus(jobId, "failed", undefined, e.message || String(e));
        }
    })();
}

// Job processor registry - maps job types to their processors
const jobProcessors: Record<string, (payload: any) => Promise<any>> = {};

export function registerJobProcessor(type: string, processor: (payload: any) => Promise<any>) {
    jobProcessors[type] = processor;
}

// Process a single job
async function processJob(job: Job): Promise<void> {
    const processor = jobProcessors[job.type];
    if (!processor) {
        console.error(`[Jobs] No processor registered for job type: ${job.type}`);
        await updateJobStatus(job.id, "failed", undefined, `No processor for type: ${job.type}`);
        return;
    }

    try {
        await updateJobStatus(job.id, "processing");
        const payload = JSON.parse(job.payload);
        const result = await processor(payload);
        await updateJobStatus(job.id, "completed", result);
        console.log(`[Jobs] ✅ Job ${job.id} (${job.type}) completed`);
    } catch (e: any) {
        console.error(`[Jobs] ❌ Job ${job.id} (${job.type}) failed:`, e);
        await updateJobStatus(job.id, "failed", undefined, e.message || String(e));
    }
}

// Reclaim stale jobs that were marked "processing" but the server restarted
async function reclaimStaleJobs(): Promise<void> {
    // Jobs that have been "processing" for more than 5 minutes are considered stale
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    
    const staleJobs = await prisma.job.findMany({
        where: {
            status: "processing",
            updatedAt: { lt: staleThreshold }
        }
    });

    if (staleJobs.length > 0) {
        console.log(`[Jobs] Reclaiming ${staleJobs.length} stale jobs`);
        for (const job of staleJobs) {
            await updateJobStatus(job.id, "pending");
        }
    }
}

// ============================================================================
// CONCURRENT JOB WORKER
// Allows N jobs to run in parallel instead of blocking on a single job.
// This prevents one slow audio generation from blocking other users.
// ============================================================================

let workerInterval: ReturnType<typeof setInterval> | null = null;

// Concurrency control - allows N jobs to run in parallel
const MAX_CONCURRENT_JOBS = 3; // Tune based on server resources (TTS API rate limits, CPU for FFmpeg)
let activeJobCount = 0;
const activeJobIds = new Set<string>(); // Track which jobs are running to avoid double-processing

export async function startJobWorker(intervalMs: number = 2000): Promise<void> {
    if (workerInterval) {
        console.log("[Jobs] Worker already running");
        return;
    }

    console.log(`[Jobs] Starting worker (polling every ${intervalMs}ms, max ${MAX_CONCURRENT_JOBS} concurrent)`);
    
    // Reclaim stale jobs on startup
    await reclaimStaleJobs();

    workerInterval = setInterval(async () => {
        // Check if we have capacity for more jobs
        if (activeJobCount >= MAX_CONCURRENT_JOBS) {
            return; // At capacity, wait for a slot
        }

        try {
            // Reclaim stale jobs periodically (every 10 iterations = ~20 seconds)
            if (Math.random() < 0.1) {
                await reclaimStaleJobs();
            }

            // Calculate how many jobs we can start
            const availableSlots = MAX_CONCURRENT_JOBS - activeJobCount;
            if (availableSlots <= 0) return;

            // Find pending jobs (up to available slots)
            const pendingJobs = await prisma.job.findMany({
                where: { 
                    status: "pending",
                    // Exclude jobs we're already processing (race condition protection)
                    id: { notIn: Array.from(activeJobIds) }
                },
                orderBy: { createdAt: "asc" },
                take: availableSlots,
            });

            // Start each job (fire and forget - they run concurrently)
            for (const job of pendingJobs) {
                // Double-check we haven't already started this job
                if (activeJobIds.has(job.id)) continue;
                
                // Mark as active BEFORE starting to prevent race conditions
                activeJobIds.add(job.id);
                activeJobCount++;
                
                console.log(`[Jobs] Starting job ${job.id} (${job.type}) [${activeJobCount}/${MAX_CONCURRENT_JOBS} active]`);
                
                // Process job asynchronously (don't await - run in parallel)
                processJobWithConcurrency(job).catch((error) => {
                    console.error(`[Jobs] Unexpected error in job ${job.id}:`, error);
                });
            }
        } catch (error) {
            console.error("[Jobs] Worker error:", error);
        }
    }, intervalMs);
}

/**
 * Process a job with proper concurrency tracking
 * Decrements activeJobCount when done (success or failure)
 */
async function processJobWithConcurrency(job: Job): Promise<void> {
    try {
        await processJob(job);
    } finally {
        // Always clean up, even on error
        activeJobIds.delete(job.id);
        activeJobCount--;
        console.log(`[Jobs] Job ${job.id} finished [${activeJobCount}/${MAX_CONCURRENT_JOBS} active]`);
    }
}

export function stopJobWorker(): void {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        console.log("[Jobs] Worker stopped");
    }
}
