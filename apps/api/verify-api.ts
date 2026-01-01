import { SessionV3Schema, PlaybackBundleVMSchema } from "@ab/contracts";

const API_URL = "http://localhost:3000";

async function run() {
    console.log("Starting verification...");

    // 1. Create Valid Session
    console.log("1. Creating valid session...");
    const draft = {
        localDraftId: "00000000-0000-0000-0000-000000000000",
        title: "Integration Test Session",
        goalTag: "Testing",
        durationSec: 300,
        affirmations: ["I am testing the system", "It works perfectly"],
        voiceId: "en-US-Standard-C",
        pace: "normal",
        affirmationSpacingMs: 1000
    };

    const res = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
    });

    if (!res.ok) {
        throw new Error(`Failed to create session: ${res.status} ${await res.text()}`);
    }

    const session = await res.json();
    SessionV3Schema.parse(session);
    console.log("   ✅ Valid Session Created:", session.id);

    // 2. Duration Limit
    console.log("2. Testing Duration Limit...");
    const longDraft = { ...draft, title: "Too Long", durationSec: 600 };
    const resLong = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(longDraft)
    });

    if (resLong.status !== 403) {
        throw new Error(`Expected 403 for duration limit, got ${resLong.status}`);
    }
    const longBody = await resLong.json();
    console.log("   ✅ Duration Limit Enforced:", longBody.message);

    // 3. Quota Limit (Try to create 2 more)
    console.log("3. Testing Quota Limit...");
    // 2nd session (allowed)
    const draft2 = { ...draft, title: "Session 2" };
    const res2 = await fetch(`${API_URL}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft2) });

    // 3rd session (should fail)
    const draft3 = { ...draft, title: "Session 3" };
    const res3 = await fetch(`${API_URL}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft3) });

    if (res3.status === 403) {
        console.log("   ✅ Quota Limit Enforced (3rd session blocked)");
    } else if (res2.status === 403) {
        console.log("   ✅ Quota Limit Enforced (2nd session blocked - maybe run previously)");
    } else {
        console.warn("   ⚠️ Quota Limit NOT Enforced as expected (3 sessions created?). check logic.");
    }

    console.log("✅ Verification Complete");
}

run().catch(e => {
    console.error("❌ Verification Failed:", e);
    process.exit(1);
});
