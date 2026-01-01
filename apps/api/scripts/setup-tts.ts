#!/usr/bin/env bun
/**
 * Interactive TTS Setup Script
 * 
 * Helps configure TTS provider in .env file
 * 
 * Usage: bun apps/api/scripts/setup-tts.ts
 */

import fs from "fs-extra";
import path from "path";
import { stdin, stdout } from "process";

const ENV_FILE = path.join(process.cwd(), ".env");
const ENV_EXAMPLE = path.join(process.cwd(), ".env.example");

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(prompt);
    stdin.once("data", (data) => {
      resolve(data.toString().trim());
    });
  });
}

async function main() {
  console.log("🎙️  TTS Provider Setup\n");
  console.log("This script will help you configure a TTS provider.\n");

  // Check if .env exists
  let envContent = "";
  if (await fs.pathExists(ENV_FILE)) {
    envContent = await fs.readFile(ENV_FILE, "utf-8");
    console.log("✅ Found existing .env file");
  } else {
    console.log("ℹ️  No .env file found, will create one");
    if (await fs.pathExists(ENV_EXAMPLE)) {
      envContent = await fs.readFile(ENV_EXAMPLE, "utf-8");
      console.log("   Using .env.example as template");
    }
  }

  // Ask for provider
  console.log("\nAvailable TTS Providers:");
  console.log("1. OpenAI (Recommended - simple, good quality)");
  console.log("2. ElevenLabs (Ultra-realistic voices)");
  console.log("3. Azure Cognitive Services (Enterprise-grade)");
  console.log("4. Beep (Fallback - no API key needed)");

  const providerChoice = await question("\nSelect provider (1-4): ");
  
  let provider = "";
  let apiKeyVar = "";
  let apiKey = "";
  let regionVar = "";
  let region = "";

  switch (providerChoice) {
    case "1":
      provider = "openai";
      apiKeyVar = "OPENAI_API_KEY";
      apiKey = await question("Enter your OpenAI API key (sk-...): ");
      if (!apiKey) {
        console.error("❌ API key required");
        process.exit(1);
      }
      break;
    case "2":
      provider = "elevenlabs";
      apiKeyVar = "ELEVENLABS_API_KEY";
      apiKey = await question("Enter your ElevenLabs API key: ");
      if (!apiKey) {
        console.error("❌ API key required");
        process.exit(1);
      }
      break;
    case "3":
      provider = "azure";
      apiKeyVar = "AZURE_SPEECH_KEY";
      apiKey = await question("Enter your Azure Speech key: ");
      regionVar = "AZURE_SPEECH_REGION";
      region = await question("Enter your Azure region (e.g., eastus): ");
      if (!apiKey || !region) {
        console.error("❌ Both key and region required");
        process.exit(1);
      }
      break;
    case "4":
      provider = "beep";
      console.log("✅ Using beep fallback (no configuration needed)");
      break;
    default:
      console.error("❌ Invalid choice");
      process.exit(1);
  }

  // Update .env content
  let updatedContent = envContent;

  // Remove existing TTS config
  updatedContent = updatedContent.replace(/TTS_PROVIDER=.*\n/g, "");
  updatedContent = updatedContent.replace(/OPENAI_API_KEY=.*\n/g, "");
  updatedContent = updatedContent.replace(/ELEVENLABS_API_KEY=.*\n/g, "");
  updatedContent = updatedContent.replace(/AZURE_SPEECH_KEY=.*\n/g, "");
  updatedContent = updatedContent.replace(/AZURE_SPEECH_REGION=.*\n/g, "");

  // Add new config
  if (provider !== "beep") {
    updatedContent += `\n# TTS Configuration\n`;
    updatedContent += `TTS_PROVIDER=${provider}\n`;
    updatedContent += `${apiKeyVar}=${apiKey}\n`;
    if (regionVar) {
      updatedContent += `${regionVar}=${region}\n`;
    }
  } else {
    updatedContent += `\n# TTS Configuration (using beep fallback)\n`;
    updatedContent += `# TTS_PROVIDER=beep\n`;
  }

  // Write .env file
  await fs.writeFile(ENV_FILE, updatedContent);
  console.log(`\n✅ Configuration saved to ${ENV_FILE}`);

  // Verify
  console.log("\n🔍 Verifying configuration...");
  const { spawn } = await import("child_process");
  const verify = spawn("bun", ["apps/api/scripts/verify-tts.ts"], {
    stdio: "inherit",
    shell: true,
  });

  verify.on("close", (code) => {
    if (code === 0) {
      console.log("\n✅ Setup complete! Restart your API server to use TTS.");
    } else {
      console.log("\n⚠️  Setup complete, but verification had issues.");
      console.log("   Check your API keys and try running: bun apps/api/scripts/verify-tts.ts");
    }
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
