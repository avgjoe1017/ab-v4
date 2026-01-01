/**
 * Test Solfeggio Integration
 * 
 * Tests that solfeggio tones can be:
 * 1. Retrieved via getSolfeggioAsset()
 * 2. Included in playback bundles
 * 3. Created in sessions
 */

import { getSolfeggioAsset } from "../src/services/audio/assets";

const API_BASE_URL = "http://localhost:8787";

// Available solfeggio frequencies
const SOLFEGGIO_FREQUENCIES = [174, 285, 396, 417, 432, 528, 639, 741, 852, 963, 40];

async function testSolfeggioAsset(hz: number): Promise<{ success: boolean; message: string }> {
  try {
    const result = await getSolfeggioAsset(hz, API_BASE_URL);
    
    // Verify URLs are valid
    const iosUrl = result.urlByPlatform.ios;
    const androidUrl = result.urlByPlatform.android;
    
    if (!iosUrl || !androidUrl) {
      return { success: false, message: `Missing URLs for ${hz}Hz` };
    }
    
    if (result.hz !== hz) {
      return { success: false, message: `Frequency mismatch: requested ${hz}Hz, got ${result.hz}Hz` };
    }
    
    return { 
      success: true, 
      message: `✅ ${hz}Hz accessible (iOS: ${iosUrl.substring(0, 50)}..., Android: ${androidUrl.substring(0, 50)}...)` 
    };
  } catch (error: any) {
    return { success: false, message: `❌ ${hz}Hz failed: ${error.message}` };
  }
}

async function main() {
  console.log("🎵 Testing Solfeggio Integration\n");
  console.log("=".repeat(60));
  
  console.log("\n📊 Test 1: Solfeggio Asset Resolution");
  console.log("-".repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const hz of SOLFEGGIO_FREQUENCIES) {
    const result = await testSolfeggioAsset(hz);
    console.log(result.message);
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${SOLFEGGIO_FREQUENCIES.length}`);
  
  console.log("\n💡 Next Steps:");
  console.log("1. Create a session with solfeggioHz in the request body");
  console.log("2. Verify playback bundle includes solfeggio instead of binaural");
  console.log("3. Test playback in mobile app");
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

