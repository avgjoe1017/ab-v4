import { UUID } from "@ab/contracts";

const API_URL = "http://localhost:8787";
const SESSION_ID = "1c261e4b-7009-482a-928e-5b1b46700c99"; // Morning Affirmations

async function test() {
    console.log(`📡 Testing Session: ${SESSION_ID}`);

    // 1. Check Bundle (Expect 404 AUDIO_NOT_READY or similar if not ready)
    console.log("1. Checking initial bundle state...");
    const bundleRes = await fetch(`${API_URL}/sessions/${SESSION_ID}/playback-bundle`);
    console.log(`   Status: ${bundleRes.status}`);
    if (bundleRes.status === 200) {
        console.log("   Audio already ready! (Skipping generation test)");
        return; // Already exists
    }

    // 2. Trigger Generation
    console.log("2. Triggering Ensure Audio...");
    const ensureRes = await fetch(`${API_URL}/sessions/${SESSION_ID}/ensure-audio`, {
        method: "POST"
    });
    const ensureData = await ensureRes.json();
    console.log("   Response:", JSON.stringify(ensureData));

    if (ensureData.status === "ready") {
        console.log("   Server says ready immediately.");
        return;
    }

    const jobId = ensureData.jobId;
    if (!jobId) throw new Error("No Job ID returned");

    // 3. Poll Job
    console.log(`3. Polling Job ${jobId}...`);
    let jobStatus = "pending";
    while (jobStatus === "pending" || jobStatus === "processing") {
        await new Promise(r => setTimeout(r, 1000));
        const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
        const jobData = await jobRes.json();
        jobStatus = jobData.job.status;
        console.log(`   Status: ${jobStatus}`);
        if (jobStatus === "failed") throw new Error(`Job failed: ${jobData.job.error}`);
    }

    // 4. Verify Bundle
    console.log("4. Verifying Bundle...");
    const finalBundleRes = await fetch(`${API_URL}/sessions/${SESSION_ID}/playback-bundle`);
    if (finalBundleRes.status !== 200) {
        throw new Error(`Bundle still not ready: ${finalBundleRes.status}`);
    }
    const finalData = await finalBundleRes.json();
    console.log("   ✅ Bundle received:", finalData.bundle.affirmationsMergedUrl);
}

test().catch(e => {
    console.error("❌ Test Failed:", e);
    process.exit(1);
});
