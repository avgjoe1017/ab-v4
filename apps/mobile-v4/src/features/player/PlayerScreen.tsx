/**
 * PlayerScreen - V4 Player with Time-Based Session Cap
 * P1.1: Implements 5-minute session duration cap for Free tier with smooth fade-out and end card
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { SafeAreaView, Pressable, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { Play, Pause, X } from 'lucide-react-native';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { getAudioEngine } from '@ab/audio-engine';
import type { AudioEngineSnapshot } from '@ab/audio-engine';
import { apiClient } from '@/services/apiClient';
import { EndCard } from './components/EndCard';
import { convertPlaybackBundleV4ToVM } from './utils/bundleConverter';
import type { PlaybackBundleVM } from '@ab/contracts';

interface PlaybackBundleResponse {
  bundle: {
    planId: string;
    sessionId: string;
    voiceUrl?: string;
    background: {
      urlByPlatform: { ios: string; android: string };
      loop: true;
    };
    binaural?: {
      urlByPlatform: { ios: string; android: string };
      loop: true;
      hz: number;
    };
    solfeggio?: {
      urlByPlatform: { ios: string; android: string };
      loop: true;
      hz: number;
    };
    mix: {
      affirmations: number;
      background: number;
      binaural: number;
    };
    sessionDurationCapMs: number | 'unlimited';
    fallbackMode: 'full' | 'voice_pending' | 'silent';
    effectiveAffirmationSpacingMs: number;
  };
}

export default function PlayerScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const background = useColor('background');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const primary = useColor('primary');
  const border = useColor('border');

  const [snapshot, setSnapshot] = useState<AudioEngineSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEndCard, setShowEndCard] = useState(false);
  const [bundle, setBundle] = useState<PlaybackBundleResponse['bundle'] | null>(null);
  
  // P1-2.3: Local state for smooth time remaining updates
  const [displayRemainingMs, setDisplayRemainingMs] = useState<number | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  
  // P1-2.4: Asset reliability tracking
  const [assetErrors, setAssetErrors] = useState<{
    voice?: boolean;
    background?: boolean;
    brain?: boolean;
  }>({});

  const engine = getAudioEngine();

  // Fetch playback bundle
  useEffect(() => {
    if (!planId) {
      setError('No plan ID provided');
      setIsLoading(false);
      return;
    }

    const fetchBundle = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get<PlaybackBundleResponse>(
          `/v4/plans/${planId}/playback-bundle`
        );
        setBundle(response.bundle);
        setError(null);
      } catch (err) {
        console.error('[PlayerScreen] Failed to fetch bundle:', err);
        setError(err instanceof Error ? err.message : 'Failed to load playback bundle');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBundle();
  }, [planId]);

  // P1-2.3: Handle app state changes (background/foreground) to prevent desync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - refresh snapshot to sync with AudioEngine
        const currentSnapshot = engine.getState();
        if (currentSnapshot) {
          setSnapshot(currentSnapshot);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [engine]);

  // Subscribe to engine state
  useEffect(() => {
    const listener = (newSnapshot: AudioEngineSnapshot) => {
      setSnapshot(newSnapshot);

      // P1-2.4: Track asset load errors from AudioEngine
      if (newSnapshot.error) {
        const errorMsg = newSnapshot.error.message?.toLowerCase() || '';
        if (errorMsg.includes('affirmation') || errorMsg.includes('voice')) {
          setAssetErrors(prev => ({ ...prev, voice: true }));
        }
        if (errorMsg.includes('background')) {
          setAssetErrors(prev => ({ ...prev, background: true }));
        }
        if (errorMsg.includes('binaural') || errorMsg.includes('solfeggio') || errorMsg.includes('brain')) {
          setAssetErrors(prev => ({ ...prev, brain: true }));
        }
      }

      // P1.1: Check if session duration cap reached and trigger end card
      if (
        newSnapshot.totalPlaybackTimeMs !== undefined &&
        newSnapshot.sessionDurationCapMs !== undefined &&
        typeof newSnapshot.sessionDurationCapMs === 'number' &&
        newSnapshot.totalPlaybackTimeMs >= newSnapshot.sessionDurationCapMs &&
        !showEndCard
      ) {
        // Small delay to let fade-out start
        setTimeout(() => {
          setShowEndCard(true);
        }, 500);
      }
    };

    const unsubscribe = engine.subscribe(listener);
    const currentSnapshot = engine.getState();
    if (currentSnapshot) {
      setSnapshot(currentSnapshot);
    }

    return () => {
      unsubscribe();
    };
  }, [engine, showEndCard]);

  // P1-2.3: Smooth time remaining updates (every 250ms) without jank
  useEffect(() => {
    if (timeUpdateInterval.current) {
      clearInterval(timeUpdateInterval.current);
    }

    const updateTimeRemaining = () => {
      if (!snapshot) {
        setDisplayRemainingMs(null);
        return;
      }

      const totalTimeMs = snapshot.totalPlaybackTimeMs ?? 0;
      const durationCapMs = snapshot.sessionDurationCapMs ?? 'unlimited';
      
      if (typeof durationCapMs === 'number') {
        const remaining = Math.max(0, durationCapMs - totalTimeMs);
        setDisplayRemainingMs(remaining);
      } else {
        setDisplayRemainingMs(null);
      }
    };

    // Initial update
    updateTimeRemaining();

    // Update every 250ms for smooth display
    timeUpdateInterval.current = setInterval(updateTimeRemaining, 250);

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
        timeUpdateInterval.current = null;
      }
    };
  }, [snapshot]);

  // Load bundle into engine when ready
  useEffect(() => {
    if (!bundle || snapshot?.status !== 'idle') return;

    // P1.1: Convert V4 bundle to V3 PlaybackBundleVM format
    try {
      const vmBundle = convertPlaybackBundleV4ToVM(bundle);
      
      // P1-2.4: Load bundle into AudioEngine with error handling
      engine.load(vmBundle).then(() => {
        // Set session duration cap from bundle
        engine.setSessionDurationCap(bundle.sessionDurationCapMs);
        // Auto-play when ready
        if (snapshot?.status === 'ready') {
          engine.play().catch((err) => {
            console.error('[PlayerScreen] Auto-play failed:', err);
            // P1-2.4: If voice fails, transition to silent mode gracefully
            const errorMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMsg.includes('affirmation') || errorMsg.includes('voice')) {
              setAssetErrors(prev => ({ ...prev, voice: true }));
            }
          });
        }
      }).catch((err) => {
        console.error('[PlayerScreen] Failed to load bundle:', err);
        // P1-2.4: Don't show full error - try to continue with available assets
        const errorMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (errorMsg.includes('affirmation') || errorMsg.includes('voice')) {
          // Voice failed - continue in silent mode
          setAssetErrors(prev => ({ ...prev, voice: true }));
          // Still try to play background/brain tracks
          engine.setSessionDurationCap(bundle.sessionDurationCapMs);
        } else {
          // Other critical error - show error state
          setError('Failed to load audio. Please try again.');
        }
      });
    } catch (conversionError) {
      console.error('[PlayerScreen] Bundle conversion failed:', conversionError);
      setError('Failed to prepare playback. Please try again.');
    }
  }, [bundle, snapshot, engine]);

  const handlePlayPause = useCallback(() => {
    if (!snapshot) return;

    if (snapshot.status === 'playing') {
      engine.pause();
    } else if (snapshot.status === 'paused' || snapshot.status === 'ready') {
      engine.play();
    }
  }, [snapshot, engine]);

  const handleClose = useCallback(() => {
    engine.stop();
    router.back();
  }, [engine]);

  const handleUpgrade = useCallback(() => {
    setShowEndCard(false);
    // Navigate to upgrade/paywall screen
    router.push('/(tabs)/settings');
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={primary} />
          <Text variant="body" style={{ marginTop: 16, color: textMuted }}>
            Loading playback...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text variant="heading" style={{ color: text, marginBottom: 8 }}>
            Unable to load playback
          </Text>
          <Text variant="body" style={{ color: textMuted, textAlign: 'center', marginBottom: 24 }}>
            {error}
          </Text>
          <Pressable
            onPress={handleClose}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: border,
            }}
          >
            <Text variant="body" style={{ color: text }}>
              Go back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isPlaying = snapshot?.status === 'playing';
  
  // P1-2.3: Use displayRemainingMs for smooth updates (updated every 250ms)
  // Fallback to snapshot calculation if display state not ready
  const remainingTimeMs = displayRemainingMs !== null 
    ? displayRemainingMs 
    : (snapshot?.totalPlaybackTimeMs !== undefined && 
       typeof snapshot?.sessionDurationCapMs === 'number'
       ? Math.max(0, snapshot.sessionDurationCapMs - snapshot.totalPlaybackTimeMs)
       : null);
  const remainingMinutes = remainingTimeMs !== null ? Math.ceil(remainingTimeMs / 60000) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Pressable onPress={handleClose}>
            <X size={24} color={text} />
          </Pressable>
          <Text variant="subtitle" style={{ color: text, fontWeight: '600' }}>
            Player
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Main content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          {/* Time remaining indicator (Free tier) */}
          {remainingMinutes !== null && (
            <View
              style={{
                marginBottom: 24,
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 20,
                backgroundColor: primary + '20',
              }}
            >
              <Text variant="caption" style={{ color: primary }}>
                {remainingMinutes > 0 
                  ? `${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'} remaining`
                  : 'Session ending soon'}
              </Text>
            </View>
          )}

          {/* P1-2.4: Asset error messages (subtle, non-blocking) */}
          {assetErrors.voice && (
            <View
              style={{
                marginBottom: 16,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: textMuted + '15',
              }}
            >
              <Text variant="caption" style={{ color: textMuted, fontSize: 12 }}>
                Voice isn't available right now.
              </Text>
            </View>
          )}

          {/* Play/Pause button */}
          <Pressable
            onPress={handlePlayPause}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: primary,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            {isPlaying ? (
              <Pause size={32} color="#fff" fill="#fff" />
            ) : (
              <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
            )}
          </Pressable>

          {/* Status */}
          <Text variant="body" style={{ color: textMuted, textAlign: 'center' }}>
            {snapshot?.status === 'loading' && 'Loading...'}
            {snapshot?.status === 'ready' && 'Ready to play'}
            {snapshot?.status === 'playing' && 'Playing'}
            {snapshot?.status === 'paused' && 'Paused'}
            {snapshot?.status === 'error' && 'Error: ' + snapshot.error?.message}
          </Text>
        </View>
      </View>

      {/* End Card (shown when session duration cap reached) */}
      <EndCard
        visible={showEndCard}
        onDismiss={() => setShowEndCard(false)}
        onUpgrade={handleUpgrade}
      />
    </SafeAreaView>
  );
}
