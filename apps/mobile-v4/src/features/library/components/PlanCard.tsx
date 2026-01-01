/**
 * PlanCard Component - Displays a plan in the library
 * P1.2: Shows plan details with tap to play functionality
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Pressable } from 'react-native';
import { Play, Bookmark, BookmarkCheck } from 'lucide-react-native';
import React from 'react';
import type { PlanV4 } from '@ab/contracts';
import { router } from 'expo-router';

interface PlanCardProps {
  plan: PlanV4;
  onPlay?: (planId: string) => void;
  onSave?: (planId: string) => void;
  onUnsave?: (planId: string) => void;
  canSave?: boolean; // Whether user can save (paid feature)
}

export function PlanCard({ plan, onPlay, onSave, onUnsave, canSave = false }: PlanCardProps) {
  const background = useColor('background');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const primary = useColor('primary');

  const handlePlay = () => {
    if (onPlay) {
      onPlay(plan.id);
    } else {
      // Navigate to player with planId
      router.push({
        pathname: '/player',
        params: { planId: plan.id },
      });
    }
  };

  const handleSaveToggle = () => {
    if (plan.isSaved && onUnsave) {
      onUnsave(plan.id);
    } else if (!plan.isSaved && onSave) {
      onSave(plan.id);
    }
  };

  return (
    <Pressable
      onPress={handlePlay}
      style={{
        backgroundColor: card,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Content */}
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text
              variant="subtitle"
              style={{ color: text, fontWeight: '600', flex: 1 }}
              numberOfLines={1}
            >
              {plan.title}
            </Text>
            {canSave && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleSaveToggle();
                }}
                style={{ marginLeft: 8, padding: 4 }}
              >
                {plan.isSaved ? (
                  <BookmarkCheck size={20} color={primary} />
                ) : (
                  <Bookmark size={20} color={textMuted} />
                )}
              </Pressable>
            )}
          </View>

          {plan.intent && (
            <Text
              variant="caption"
              style={{ color: textMuted, marginBottom: 8 }}
              numberOfLines={2}
            >
              {plan.intent}
            </Text>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text variant="caption" style={{ color: textMuted }}>
              {plan.affirmationCount} affirmations
            </Text>
            {plan.source === 'premade' && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: primary + '20',
                }}
              >
                <Text variant="caption" style={{ color: primary, fontSize: 10 }}>
                  Premade
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Play button */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
        </Pressable>
      </View>
    </Pressable>
  );
}
