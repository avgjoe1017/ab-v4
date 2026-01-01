/**
 * EndCard Component
 * P1.1: Shows when Free user hits 5-minute session duration cap
 * Gentle upgrade prompt without pressure or guilt
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Pressable, Modal } from 'react-native';
import { Check, X } from 'lucide-react-native';
import React from 'react';

interface EndCardProps {
  visible: boolean;
  onDismiss: () => void;
  onUpgrade: () => void;
}

export function EndCard({ visible, onDismiss, onUpgrade }: EndCardProps) {
  const background = useColor('background');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const border = useColor('border');
  const primary = useColor('primary');

  const benefits = [
    'Unlimited session time',
    'More affirmations per plan',
    'Save your favorite plans',
    'Choose voice, background & brain tracks',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: card,
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            borderWidth: 1,
            borderColor: border,
          }}
        >
          {/* Header */}
          <Text
            variant="heading"
            style={{
              fontSize: 24,
              fontWeight: '600',
              marginBottom: 8,
              color: text,
            }}
          >
            Want more time?
          </Text>
          <Text
            variant="body"
            style={{
              fontSize: 16,
              color: textMuted,
              marginBottom: 24,
            }}
          >
            You've reached the 5-minute session limit. Upgrade for unlimited session time and more.
          </Text>

          {/* Benefits */}
          <View style={{ marginBottom: 24 }}>
            {benefits.map((benefit, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Check size={20} color={primary} style={{ marginRight: 12 }} />
                <Text variant="body" style={{ flex: 1, color: text }}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={onDismiss}
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
              <Text variant="body" style={{ color: text, fontWeight: '500' }}>
                Maybe later
              </Text>
            </Pressable>
            <Pressable
              onPress={onUpgrade}
              style={{
                flex: 1,
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: primary,
                alignItems: 'center',
              }}
            >
              <Text
                variant="body"
                style={{ color: '#fff', fontWeight: '600' }}
              >
                Upgrade
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
