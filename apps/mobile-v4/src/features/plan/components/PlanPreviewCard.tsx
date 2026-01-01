import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import React, { useState } from 'react';
import { Pressable, ViewStyle, ActivityIndicator } from 'react-native';
import type { PlanPreview } from '../../chat/types';
import type { EntitlementV4 } from '@ab/contracts';
import { AudioOptionsSheet } from './AudioOptionsSheet';
import { Settings } from 'lucide-react-native';

interface PlanPreviewCardProps {
  planPreview: PlanPreview;
  entitlement?: EntitlementV4;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onStartSession?: (audioSelections?: {
    voiceId?: string;
    brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
    binauralHz?: number;
    solfeggioHz?: number;
    backgroundId?: string;
  }) => void;
  regenerateCount?: number;
  isCommitting?: boolean;
}

export function PlanPreviewCard({
  planPreview,
  entitlement,
  onEdit,
  onRegenerate,
  onStartSession,
  regenerateCount = 0,
  isCommitting = false,
}: PlanPreviewCardProps) {
  const card = useColor('card');
  const border = useColor('border');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const primary = useColor('primary');

  const isFree = entitlement?.plan === 'free';
  const canEdit = true; // Free can edit (but not save)
  const canRegenerate = isFree ? regenerateCount < 2 : true; // Free: 2-3 rerolls max
  const maxRegenerates = isFree ? 2 : Infinity;
  const [showAudioOptions, setShowAudioOptions] = useState(false);
  const [audioSelections, setAudioSelections] = useState<{
    voiceId?: string;
    brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
    binauralHz?: number;
    solfeggioHz?: number;
    backgroundId?: string;
  }>({});

  return (
    <View
      style={{
        backgroundColor: card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: border,
        padding: 20,
        marginHorizontal: 16,
        marginVertical: 12,
        gap: 16,
      }}
    >
      {/* Title */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: text }}>
          {planPreview.title}
        </Text>
        {planPreview.intent && (
          <Text style={{ fontSize: 15, color: mutedText }}>
            {planPreview.intent}
          </Text>
        )}
      </View>

      {/* Affirmations List */}
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>
          Affirmations ({planPreview.affirmations.length})
        </Text>
        <View style={{ gap: 8 }}>
          {planPreview.affirmations.map((affirmation, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: 'transparent',
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: mutedText, minWidth: 24 }}>
                {idx + 1}.
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: text,
                  flex: 1,
                  lineHeight: 22,
                }}
              >
                {affirmation}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Controls */}
      <View style={{ gap: 10 }}>
        {/* Edit Affirmations */}
        {canEdit && onEdit && (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              {
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: 'transparent',
                opacity: pressed ? 0.7 : 1,
              } as ViewStyle,
            ]}
          >
            <Text style={{ color: text, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>
              Edit Affirmations
              {isFree && (
                <Text style={{ color: mutedText, fontSize: 13 }}>
                  {' '}(edits won't be saved)
                </Text>
              )}
            </Text>
          </Pressable>
        )}

        {/* Regenerate */}
        {canRegenerate && onRegenerate && (
          <Pressable
            onPress={onRegenerate}
            style={({ pressed }) => [
              {
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: 'transparent',
                opacity: pressed ? 0.7 : 1,
              } as ViewStyle,
            ]}
          >
            <Text style={{ color: text, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>
              Regenerate
              {isFree && (
                <Text style={{ color: mutedText, fontSize: 13 }}>
                  {' '}({regenerateCount}/{maxRegenerates} left today)
                </Text>
              )}
            </Text>
          </Pressable>
        )}

        {!canRegenerate && isFree && (
          <Text style={{ color: mutedText, fontSize: 13, textAlign: 'center' }}>
            You've used all free regenerations. Upgrade to get unlimited.
          </Text>
        )}

        {/* P1-6.1, P1-6.2, P1-6.3: Audio Options */}
        <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: text }}>
              Audio Options
            </Text>
            <Pressable
              onPress={() => setShowAudioOptions(true)}
              style={({ pressed }) => [
                {
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  opacity: pressed ? 0.7 : 1,
                } as ViewStyle,
              ]}
            >
              <Settings size={16} color={text} />
              <Text style={{ fontSize: 13, color: text, fontWeight: '500' }}>
                Customize
              </Text>
            </Pressable>
          </View>
          {isFree && (
            <Text style={{ fontSize: 12, color: mutedText }}>
              Free users get default settings. Upgrade to customize voice, brain tracks, and backgrounds.
            </Text>
          )}
        </View>

        {/* Start Session Button */}
        {onStartSession && (
          <Pressable
            onPress={() => onStartSession(audioSelections)}
            disabled={isCommitting}
            style={({ pressed }) => [
              {
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: primary,
                marginTop: 8,
                opacity: (pressed || isCommitting) ? 0.6 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              } as ViewStyle,
            ]}
          >
            {isCommitting && <ActivityIndicator size="small" color="white" />}
            <Text
              style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {isCommitting ? 'Starting...' : 'Start Session'}
            </Text>
          </Pressable>
        )}
      </View>

      {/* P1-6.1, P1-6.2, P1-6.3: Audio Options Sheet */}
      <AudioOptionsSheet
        visible={showAudioOptions}
        onClose={() => setShowAudioOptions(false)}
        entitlement={entitlement}
        currentSelections={audioSelections}
        onSave={(selections) => {
          setAudioSelections(selections);
          setShowAudioOptions(false);
        }}
      />
    </View>
  );
}
