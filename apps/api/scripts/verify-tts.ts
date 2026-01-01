#!/usr/bin/env bun
/**
 * TTS Configuration Verification Script
 * 
 * Verifies that TTS provider is configured correctly and can generate audio
 * 
 * Usage: bun apps/api/scripts/verify-tts.ts
 */

import { generateTTSAudio } from "../src/services/audio/tts";
import fs from "fs-extra";
import path from "path";

async function main() {
  console.log("🔍 Verifying TTS Configuration...\n");

  // Check environment variables
  const provider = process.env.TTS_PROVIDER?.toLowerCase() || "beep";
  console.log(`Provider: ${provider}`);

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      console.error("❌ OPENAI_API_KEY not set in environment");
      process.exit(1);
    }
    console.log("✅ OPENAI_API_KEY found");
  } else if (provider === "elevenlabs") {
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY not set in environment");
      process.exit(1);
    }
    console.log("✅ ELEVENLABS_API_KEY found");
  } else if (provider === "azure") {
    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      console.error("❌ AZURE_SPEECH_KEY or AZURE_SPEECH_REGION not set");
      process.exit(1);
    }
    console.log("✅ Azure credentials found");
  } else {
    console.log("ℹ️  Using beep fallback (no TTS provider configured)");
  }

  // Test TTS generation
  console.log("\n🧪 Testing TTS generation...");
  const testText = "This is a test affirmation.";
  const testOutput = path.join(process.cwd(), "test-tts-output.mp3");

  try {
    await generateTTSAudio(
      {
        text: testText,
        voiceId: "default",
        pace: "slow",
        variant: 1,
      },
      testOutput
    );

    if (await fs.pathExists(testOutput)) {
      const stats = await fs.stat(testOutput);
      console.log(`✅ TTS audio generated successfully`);
      console.log(`   File: ${testOutput}`);
      console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
      
      // Clean up test file
      await fs.remove(testOutput);
      console.log("   Test file cleaned up");
    } else {
      console.error("❌ TTS audio file not created");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ TTS generation failed:");
    console.error(`   ${error.message}`);
    if (provider !== "beep") {
      console.error("\n⚠️  Falling back to beep generation");
    }
    process.exit(1);
  }

  console.log("\n✅ TTS configuration verified successfully!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
