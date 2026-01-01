/**
 * Audio Options Sheet Component
 * P1-6.1, P1-6.2, P1-6.3: Voice, Brain Mode, and Background selection
 * Free users see locked options with paywall, paid users can select
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Modal, ScrollView, Pressable, ViewStyle } from 'react-native';
import { X, Lock } from 'lucide-react-native';
import React from 'react';
import type { EntitlementV4 } from '@ab/contracts';
import { PaywallModal } from '@/features/shared/components/PaywallModal';
import { router } from 'expo-router';

interface AudioOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  entitlement?: EntitlementV4;
  currentSelections?: {
    voiceId?: string;
    brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
    binauralHz?: number;
    solfeggioHz?: number;
    backgroundId?: string;
  };
  onSave: (selections: {
    voiceId: string;
    brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
    binauralHz?: number;
    solfeggioHz?: number;
    backgroundId?: string;
  }) => void;
}

// Available voices (paid users get all, free get male/female only)
const ALL_VOICES = [
  { id: 'male', label: 'Male Voice' },
  { id: 'female', label: 'Female Voice' },
  { id: 'calm-male', label: 'Calm Male' },
  { id: 'calm-female', label: 'Calm Female' },
  { id: 'energetic-male', label: 'Energetic Male' },
  { id: 'energetic-female', label: 'Energetic Female' },
];

// Available binaural frequencies
const BINAURAL_FREQUENCIES = [
  { hz: 10, label: 'Alpha (10 Hz)', description: 'Relaxed focus' },
  { hz: 8, label: 'Theta (8 Hz)', description: 'Deep meditation' },
  { hz: 4, label: 'Delta (4 Hz)', description: 'Deep sleep' },
  { hz: 12, label: 'SMR (12 Hz)', description: 'Calm alertness' },
];

// Available solfeggio frequencies
const SOLFEGGIO_FREQUENCIES = [
  { hz: 528, label: '528 Hz', description: 'Love & transformation' },
  { hz: 432, label: '432 Hz', description: 'Natural harmony' },
  { hz: 639, label: '639 Hz', description: 'Connection & relationships' },
];

// Available backgrounds (placeholder - would come from API)
const BACKGROUNDS = [
  { id: 'ocean', label: 'Ocean Waves' },
  { id: 'rain', label: 'Gentle Rain' },
  { id: 'forest', label: 'Forest Ambience' },
  { id: 'fire', label: 'Crackling Fire' },
];

export function AudioOptionsSheet({
  visible,
  onClose,
  entitlement,
  currentSelections = {},
  onSave,
}: AudioOptionsSheetProps) {
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const border = useColor('border');
  const primary = useColor('primary');

  const isFree = entitlement?.plan === 'free';
  const canPickVoice = entitlement?.limits.voicesAllowed === 'all' || (entitlement?.limits.voicesAllowed as string[] || []).length > 2;
  const canPickBrainTrack = entitlement?.limits.canPickBrainTrack ?? false;
  const canPickBackground = entitlement?.limits.canPickBackground ?? false;

  const [selectedVoice, setSelectedVoice] = React.useState(currentSelections.voiceId || 'male');
  const [selectedBrainMode, setSelectedBrainMode] = React.useState<'binaural' | 'solfeggio' | 'none'>(
    currentSelections.brainTrackMode || 'none'
  );
  const [selectedBinauralHz, setSelectedBinauralHz] = React.useState(currentSelections.binauralHz);
  const [selectedSolfeggioHz, setSelectedSolfeggioHz] = React.useState(currentSelections.solfeggioHz);
  const [selectedBackground, setSelectedBackground] = React.useState(currentSelections.backgroundId);
  const [showPaywall, setShowPaywall] = React.useState(false);
  const [paywallContext, setPaywallContext] = React.useState<'voice' | 'brain' | 'background' | null>(null);

  const handleVoiceSelect = (voiceId: string) => {
    if (isFree && !['male', 'female'].includes(voiceId)) {
      setPaywallContext('voice');
      setShowPaywall(true);
      return;
    }
    setSelectedVoice(voiceId);
  };

  const handleBrainModeSelect = (mode: 'binaural' | 'solfeggio' | 'none') => {
    if (isFree) {
      setPaywallContext('brain');
      setShowPaywall(true);
      return;
    }
    setSelectedBrainMode(mode);
  };

  const handleBackgroundSelect = (backgroundId: string) => {
    if (isFree) {
      setPaywallContext('background');
      setShowPaywall(true);
      return;
    }
    setSelectedBackground(backgroundId);
  };

  const handleSave = () => {
    onSave({
      voiceId: selectedVoice,
      brainTrackMode: selectedBrainMode,
      binauralHz: selectedBrainMode === 'binaural' ? selectedBinauralHz : undefined,
      solfeggioHz: selectedBrainMode === 'solfeggio' ? selectedSolfeggioHz : undefined,
      backgroundId: selectedBackground,
    });
    onClose();
  };

  const getPaywallTitle = () => {
    switch (paywallContext) {
      case 'voice':
        return 'Unlock more voices';
      case 'brain':
        return 'Unlock brain tracks';
      case 'background':
        return 'Unlock backgrounds';
      default:
        return 'Upgrade to unlock';
    }
  };

  const getPaywallMessage = () => {
    switch (paywallContext) {
      case 'voice':
        return 'Choose from multiple voice options with a paid plan.';
      case 'brain':
        return 'Select binaural beats or solfeggio frequencies with a paid plan.';
      case 'background':
        return 'Choose from curated background atmospheres with a paid plan.';
      default:
        return 'This feature is available for paid users.';
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <View
            style={{
              backgroundColor: card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderWidth: 1,
              borderColor: border,
              maxHeight: '90%',
            }}
          >
            {/* Header */}
            <View
              style={{
                padding: 20,
                borderBottomWidth: 1,
                borderBottomColor: border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '600', color: text }}>
                Audio Options
              </Text>
              <Pressable onPress={onClose} style={{ padding: 4 }}>
                <X size={24} color={textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20 }}
            >
              {/* P1-6.1: Voice Selection */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 12 }}>
                  Voice
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {ALL_VOICES.map((voice) => {
                    const isAllowed = isFree ? ['male', 'female'].includes(voice.id) : true;
                    const isSelected = selectedVoice === voice.id;
                    const isLocked = !isAllowed;

                    return (
                      <Pressable
                        key={voice.id}
                        onPress={() => handleVoiceSelect(voice.id)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isSelected ? primary : border,
                            backgroundColor: isSelected ? primary + '20' : 'transparent',
                            opacity: (pressed || isLocked) ? 0.7 : 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          } as ViewStyle,
                        ]}
                      >
                        {isLocked && <Lock size={16} color={textMuted} />}
                        <Text
                          style={{
                            color: isSelected ? primary : (isLocked ? textMuted : text),
                            fontWeight: isSelected ? '600' : '400',
                            fontSize: 14,
                          }}
                        >
                          {voice.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isFree && (
                  <Text style={{ fontSize: 12, color: textMuted, marginTop: 8 }}>
                    Free users can choose male or female. Upgrade for more voices.
                  </Text>
                )}
              </View>

              {/* P1-6.2: Brain Mode Selection */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 12 }}>
                  Brain Track
                </Text>
                <View style={{ gap: 12 }}>
                  {/* Mode Selection */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['none', 'binaural', 'solfeggio'] as const).map((mode) => {
                      const isSelected = selectedBrainMode === mode;
                      const isLocked = isFree && mode !== 'none';

                      return (
                        <Pressable
                          key={mode}
                          onPress={() => handleBrainModeSelect(mode)}
                          style={({ pressed }) => [
                            {
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: isSelected ? primary : border,
                              backgroundColor: isSelected ? primary + '20' : 'transparent',
                              opacity: (pressed || isLocked) ? 0.7 : 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            } as ViewStyle,
                          ]}
                        >
                          {isLocked && <Lock size={14} color={textMuted} />}
                          <Text
                            style={{
                              color: isSelected ? primary : (isLocked ? textMuted : text),
                              fontWeight: isSelected ? '600' : '400',
                              fontSize: 14,
                              textTransform: 'capitalize',
                            }}
                          >
                            {mode === 'none' ? 'None' : mode}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Binaural Frequency Selection */}
                  {selectedBrainMode === 'binaural' && canPickBrainTrack && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: text }}>
                        Frequency
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {BINAURAL_FREQUENCIES.map((freq) => {
                          const isSelected = selectedBinauralHz === freq.hz;
                          return (
                            <Pressable
                              key={freq.hz}
                              onPress={() => setSelectedBinauralHz(freq.hz)}
                              style={({ pressed }) => [
                                {
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: isSelected ? primary : border,
                                  backgroundColor: isSelected ? primary + '20' : 'transparent',
                                  opacity: pressed ? 0.7 : 1,
                                } as ViewStyle,
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSelected ? primary : text,
                                  fontWeight: isSelected ? '600' : '400',
                                  fontSize: 13,
                                }}
                              >
                                {freq.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Solfeggio Frequency Selection */}
                  {selectedBrainMode === 'solfeggio' && canPickBrainTrack && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: text }}>
                        Frequency
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {SOLFEGGIO_FREQUENCIES.map((freq) => {
                          const isSelected = selectedSolfeggioHz === freq.hz;
                          return (
                            <Pressable
                              key={freq.hz}
                              onPress={() => setSelectedSolfeggioHz(freq.hz)}
                              style={({ pressed }) => [
                                {
                                  paddingVertical: 8,
                                  paddingHorizontal: 12,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: isSelected ? primary : border,
                                  backgroundColor: isSelected ? primary + '20' : 'transparent',
                                  opacity: pressed ? 0.7 : 1,
                                } as ViewStyle,
                              ]}
                            >
                              <Text
                                style={{
                                  color: isSelected ? primary : text,
                                  fontWeight: isSelected ? '600' : '400',
                                  fontSize: 13,
                                }}
                              >
                                {freq.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {isFree && (
                    <Text style={{ fontSize: 12, color: textMuted }}>
                      Brain tracks are available for paid users.
                    </Text>
                  )}
                </View>
              </View>

              {/* P1-6.3: Background Selection */}
              <View style={{ marginBottom: 32 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 12 }}>
                  Background
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {BACKGROUNDS.map((bg) => {
                    const isSelected = selectedBackground === bg.id;
                    const isLocked = isFree;

                    return (
                      <Pressable
                        key={bg.id}
                        onPress={() => handleBackgroundSelect(bg.id)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isSelected ? primary : border,
                            backgroundColor: isSelected ? primary + '20' : 'transparent',
                            opacity: (pressed || isLocked) ? 0.7 : 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          } as ViewStyle,
                        ]}
                      >
                        {isLocked && <Lock size={16} color={textMuted} />}
                        <Text
                          style={{
                            color: isSelected ? primary : (isLocked ? textMuted : text),
                            fontWeight: isSelected ? '600' : '400',
                            fontSize: 14,
                          }}
                        >
                          {bg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isFree && (
                  <Text style={{ fontSize: 12, color: textMuted, marginTop: 8 }}>
                    Background selection is available for paid users.
                  </Text>
                )}
              </View>
            </ScrollView>

            {/* Footer */}
            <View
              style={{
                padding: 20,
                borderTopWidth: 1,
                borderTopColor: border,
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <Pressable
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: text, fontSize: 16, fontWeight: '500' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: primary,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* P1-5.3: Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
        onUpgrade={() => {
          setShowPaywall(false);
          router.push('/(tabs)/settings');
        }}
        title={getPaywallTitle()}
        message={getPaywallMessage()}
      />
    </>
  );
}
