/**
 * PlayerScreen - V4 Player with Time-Based Session Cap
 * P1.1: Implements 5-minute session duration cap for Free tier with smooth fade-out and end card
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { SafeAreaView, Pressable, ActivityIndicator, AppState, AppStateStatus, PanResponder } from 'react-native';
import { Play, Pause, X, Volume2, Volume1, VolumeX } from 'lucide-react-native';
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

/**
 * Simple Volume Slider Component
 */
function VolumeSlider({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  colors: {
    text: string;
    textMuted: string;
    primary: string;
    border: string;
    background: string;
  };
}) {
  const [sliderLayout, setSliderLayout] = useState<{ width: number; x: number } | null>(null);

  const handlePress = useCallback((event: any) => {
    if (!sliderLayout) return;
    const touchX = event.nativeEvent.locationX;
    const newValue = Math.max(0, Math.min(1, touchX / sliderLayout.width));
    onChange(newValue);
  }, [sliderLayout, onChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        if (!sliderLayout) return;
        const touchX = event.nativeEvent.locationX;
        const newValue = Math.max(0, Math.min(1, touchX / sliderLayout.width));
        onChange(newValue);
      },
      onPanResponderMove: (event) => {
        if (!sliderLayout) return;
        const touchX = event.nativeEvent.locationX;
        const newValue = Math.max(0, Math.min(1, touchX / sliderLayout.width));
        onChange(newValue);
      },
      onPanResponderRelease: () => {
        // Done dragging
      },
    })
  ).current;

  const percentage = Math.round(value * 100);
  const thumbPosition = value * 100; // Percentage

  const getVolumeIcon = () => {
    if (value === 0) return <VolumeX size={16} color={colors.textMuted} />;
    if (value < 0.5) return <Volume1 size={16} color={colors.textMuted} />;
    return <Volume2 size={16} color={colors.textMuted} />;
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ marginRight: 6 }}>
            {getVolumeIcon()}
          </View>
          <Text variant="body" style={{ color: colors.text, fontSize: 14 }}>
            {label}
          </Text>
        </View>
        <Text variant="body" style={{ color: colors.textMuted, fontSize: 14, minWidth: 40, textAlign: 'right' }}>
          {percentage}%
        </Text>
      </View>
      <Pressable
        onPress={handlePress}
        onLayout={(event) => {
          const { width, x } = event.nativeEvent.layout;
          setSliderLayout({ width, x });
        }}
        style={{
          height: 40,
          justifyContent: 'center',
        }}
      >
        {/* Track */}
        <View
          style={{
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            position: 'relative',
          }}
          {...panResponder.panHandlers}
        >
          {/* Filled portion */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: `${thumbPosition}%`,
              height: 4,
              backgroundColor: colors.primary,
              borderRadius: 2,
            }}
          />
          {/* Thumb */}
          <View
            style={{
              position: 'absolute',
              left: `${thumbPosition}%`,
              marginLeft: -8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: colors.primary,
              borderWidth: 2,
              borderColor: colors.background,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 3,
              transform: [{ translateY: -6 }],
            }}
          />
        </View>
      </Pressable>
    </View>
  );
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
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
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

  // Fetch playback bundle and poll until affirmations are ready
  useEffect(() => {
    if (!planId) {
      setError('No plan ID provided');
      setIsLoading(false);
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const MAX_POLL_ATTEMPTS = 60; // 60 attempts * 2 seconds = 2 minutes max
    const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

    const fetchBundle = async () => {
      try {
        setIsLoading(true);
        setIsGeneratingAudio(false);
        
        const fetchOnce = async (): Promise<PlaybackBundleResponse['bundle']> => {
          const response = await apiClient.get<PlaybackBundleResponse>(
            `/v4/plans/${planId}/playback-bundle`
          );
          return response.bundle;
        };

        // First fetch
        let currentBundle = await fetchOnce();
        
        // If voice is pending, poll until it's ready
        if (currentBundle.fallbackMode === 'voice_pending') {
          setIsGeneratingAudio(true);
          setIsLoading(false); // Hide initial loading, show generating screen
          
          pollInterval = setInterval(async () => {
            pollCount++;
            
            try {
              currentBundle = await fetchOnce();
              
              // Check if voice is now ready
              if (currentBundle.fallbackMode === 'full' && currentBundle.voiceUrl) {
                console.log('[PlayerScreen] Voice audio is ready!');
                setBundle(currentBundle);
                setIsGeneratingAudio(false);
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
              } else if (pollCount >= MAX_POLL_ATTEMPTS) {
                // Timeout - use what we have (silence file)
                console.warn('[PlayerScreen] Polling timeout, using silence placeholder');
                setBundle(currentBundle);
                setIsGeneratingAudio(false);
                if (pollInterval) {
                  clearInterval(pollInterval);
                  pollInterval = null;
                }
              }
            } catch (pollErr) {
              console.error('[PlayerScreen] Poll error:', pollErr);
              // Continue polling on error
            }
          }, POLL_INTERVAL_MS);
        } else {
          // Voice is ready (or silent mode) - use immediately
          setBundle(currentBundle);
          setIsLoading(false);
        }
        
        setError(null);
      } catch (err) {
        console.error('[PlayerScreen] Failed to fetch bundle:', err);
        setError(err instanceof Error ? err.message : 'Failed to load playback bundle');
        setIsLoading(false);
        setIsGeneratingAudio(false);
      }
    };

    fetchBundle();

    // Cleanup polling on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
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

  // Load bundle into engine when bundle is available (bundle-driven, not snapshot-driven)
  const loadedBundleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!bundle) return;
    
    // Only load once per bundle.sessionId to prevent duplicate loads
    if (loadedBundleIdRef.current === bundle.sessionId) return;
    
    // P1.1: Convert V4 bundle to V3 PlaybackBundleVM format
    try {
      const vmBundle = convertPlaybackBundleV4ToVM(bundle);
      
      // Mark this bundle as loaded
      loadedBundleIdRef.current = bundle.sessionId;
      
      // P1-2.4: Load bundle into AudioEngine with error handling
      engine.load(vmBundle).then(() => {
        // Set session duration cap from bundle
        engine.setSessionDurationCap(bundle.sessionDurationCapMs);
        
        // Auto-play unconditionally after load completes
        // Check status at this moment (not stale closure)
        const currentStatus = engine.getState()?.status;
        if (currentStatus === 'ready' || currentStatus === 'idle') {
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
        // Reset loaded ref on error so we can retry
        loadedBundleIdRef.current = null;
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
      loadedBundleIdRef.current = null;
    }
  }, [bundle, engine]);

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
    router.push('/settings');
  }, []);

  if (isLoading || isGeneratingAudio) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" color={primary} />
          <Text variant="heading" style={{ marginTop: 24, color: text, textAlign: 'center' }}>
            {isGeneratingAudio ? 'Generating your affirmations...' : 'Loading playback...'}
          </Text>
          {isGeneratingAudio && (
            <>
              <Text variant="body" style={{ marginTop: 12, color: textMuted, textAlign: 'center', maxWidth: 300 }}>
                This usually takes 10-30 seconds. We're creating personalized audio just for you.
              </Text>
              <View style={{ marginTop: 32, padding: 16, backgroundColor: background, borderRadius: 12, borderWidth: 1, borderColor: border, maxWidth: 320 }}>
                <Text variant="body" style={{ color: textMuted, fontSize: 13, textAlign: 'center' }}>
                  💡 Tip: You can close this screen and come back later. Your session will be ready when you return.
                </Text>
              </View>
            </>
          )}
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
          <Text variant="body" style={{ color: textMuted, textAlign: 'center', marginBottom: 32 }}>
            {snapshot?.status === 'loading' && 'Loading...'}
            {snapshot?.status === 'ready' && 'Ready to play'}
            {snapshot?.status === 'playing' && 'Playing'}
            {snapshot?.status === 'paused' && 'Paused'}
            {snapshot?.status === 'error' && 'Error: ' + snapshot.error?.message}
          </Text>

          {/* Volume Mixer */}
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              paddingHorizontal: 24,
            }}
          >
            <Text variant="subtitle" style={{ color: text, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
              Volume Mix
            </Text>

            {/* Affirmations Volume */}
            <VolumeSlider
              label="Affirmations"
              value={snapshot?.mix?.affirmations ?? 1.0}
              onChange={(value) => {
                engine.setMix({
                  affirmations: value,
                  background: snapshot?.mix?.background ?? 0.3,
                  binaural: snapshot?.mix?.binaural ?? 0.05,
                }, { source: 'user' });
              }}
              colors={{ text, textMuted, primary, border, background }}
            />

            {/* Background Volume */}
            <VolumeSlider
              label="Background"
              value={snapshot?.mix?.background ?? 0.3}
              onChange={(value) => {
                engine.setMix({
                  affirmations: snapshot?.mix?.affirmations ?? 1.0,
                  background: value,
                  binaural: snapshot?.mix?.binaural ?? 0.05,
                }, { source: 'user' });
              }}
              colors={{ text, textMuted, primary, border, background }}
            />

            {/* Binaural/Solfeggio Volume */}
            <VolumeSlider
              label={bundle?.binaural ? 'Binaural' : bundle?.solfeggio ? 'Solfeggio' : 'Brain Track'}
              value={snapshot?.mix?.binaural ?? 0.05}
              onChange={(value) => {
                engine.setMix({
                  affirmations: snapshot?.mix?.affirmations ?? 1.0,
                  background: snapshot?.mix?.background ?? 0.3,
                  binaural: value,
                }, { source: 'user' });
              }}
              colors={{ text, textMuted, primary, border, background }}
            />
          </View>
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
