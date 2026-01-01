/**
 * Player Manager Module
 * Handles player lifecycle: creation, waiting for readiness, release
 */

import type { AudioPlayer } from "expo-audio";

/**
 * Wait for a single player to be loaded and ready to play
 * Uses playbackStatusUpdate listener and duration check to detect when ready
 * Note: This should be called AFTER play() to wait for the player to load
 */
export async function waitForPlayerReady(
  player: AudioPlayer,
  playerName: string,
  maxWaitMs: number = 10000
): Promise<void> {
  // Fast path - check if already ready (has valid duration or is playing)
  if (player.duration > 0 || player.playing) {
    console.log(`[PlayerManager] ${playerName} already ready (duration: ${player.duration}, playing: ${player.playing})`);
    return;
  }

  console.log(`[PlayerManager] Waiting for ${playerName} to load...`);

  return new Promise((resolve, reject) => {
    let done = false;

    const cleanup = (listener?: any) => {
      clearTimeout(timeout);
      clearInterval(poll);
      try {
        if (listener?.remove) listener.remove();
        else player.removeListener("playbackStatusUpdate", onStatus);
      } catch {}
    };

    const checkReady = (): boolean => {
      // Check multiple indicators that player is ready:
      // 1. Valid duration (> 0)
      // 2. isLoaded property (if available)
      // 3. Actually playing
      // 4. Not buffering (if buffering is false and we have some state, consider ready)
      const hasDuration = player.duration > 0 && !isNaN(player.duration);
      const isLoaded = (player as any).isLoaded === true;
      const isPlaying = player.playing;
      const isNotBuffering = (player as any).isBuffering === false;
      
      // If we have duration or is loaded, we're ready
      if (hasDuration || isLoaded) {
        return true;
      }
      
      // If playing, we're definitely ready
      if (isPlaying) {
        return true;
      }
      
      // If not buffering and we've been waiting a bit, might be ready (for network files)
      // This helps with files that load but don't set isLoaded immediately
      return false; // Conservative - only return true if we have clear indicators
    };

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;

      console.error(`[PlayerManager] ❌ Timeout waiting for ${playerName} to load (${maxWaitMs}ms)`);
      console.error(`[PlayerManager] Debug:`, {
        isLoaded: (player as any).isLoaded,
        isBuffering: (player as any).isBuffering,
        playing: player.playing,
        duration: player.duration,
        currentTime: player.currentTime,
        timeControlStatus: (player as any).timeControlStatus,
        reasonForWaitingToPlay: (player as any).reasonForWaitingToPlay,
      });

      cleanup(listener);
      reject(new Error(`Timeout waiting for ${playerName} to load (${maxWaitMs}ms)`));
    }, maxWaitMs);

    const poll = setInterval(() => {
      if (done) return;
      if (checkReady()) {
        done = true;
        console.log(`[PlayerManager] ✅ ${playerName} ready (poll) - duration: ${player.duration}, playing: ${player.playing}`);
        cleanup(listener);
        resolve();
      }
    }, 100);

    const onStatus = (status: any) => {
      if (done) return;

      if (status?.hasError || status?.error) {
        done = true;
        console.error(`[PlayerManager] ❌ ${playerName} status error:`, status?.error || status);
        cleanup(listener);
        reject(new Error(status?.error || `Failed to load ${playerName}`));
        return;
      }

      // Check if ready via status update
      const statusIsLoaded = status?.isLoaded === true;
      const statusHasDuration = status?.duration > 0 && !isNaN(status.duration);
      const statusIsPlaying = status?.playing === true;

      if (statusIsLoaded || statusHasDuration || statusIsPlaying || checkReady()) {
        done = true;
        console.log(`[PlayerManager] ✅ ${playerName} ready (event) - duration: ${player.duration}, status duration: ${status?.duration}, playing: ${player.playing}`);
        cleanup(listener);
        resolve();
      }
    };

    const listener = player.addListener("playbackStatusUpdate", onStatus);
  });
}

/**
 * Wait for all players to be ready (metadata loaded)
 * Returns a promise that resolves when all players have valid durations
 */
export async function waitForPlayersReady(
  affPlayer: AudioPlayer | null,
  binPlayer: AudioPlayer | null,
  bgPlayer: AudioPlayer | null
): Promise<void> {
  console.log("[PlayerManager] Waiting for players to load metadata...");
  
  if (!affPlayer || !binPlayer || !bgPlayer) {
    throw new Error("Cannot wait for players - not all players are created");
  }

  try {
    await Promise.all([
      waitForPlayerReady(affPlayer, "Affirmations"),
      waitForPlayerReady(binPlayer, "Binaural"),
      waitForPlayerReady(bgPlayer, "Background")
    ]);
    console.log("[PlayerManager] ✅ All players ready");
  } catch (error) {
    console.error("[PlayerManager] ❌ Error waiting for players:", error);
    throw error;
  }
}

