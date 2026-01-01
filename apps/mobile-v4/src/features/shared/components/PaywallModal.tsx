/**
 * Paywall Modal Component
 * P1-5.3: Shows upgrade prompt when free users try paid features
 * Only shown at intent peak moments (save, paid counts, paid audio options)
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Modal, Pressable } from 'react-native';
import { X, Check } from 'lucide-react-native';
import React from 'react';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
  onUpgrade: () => void;
  title?: string;
  message?: string;
}

export function PaywallModal({
  visible,
  onDismiss,
  onUpgrade,
  title = "Upgrade to unlock",
  message = "This feature is available for paid users.",
}: PaywallModalProps) {
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const border = useColor('border');
  const primary = useColor('primary');

  const benefits = [
    'Unlimited session time',
    'More affirmations per plan (6, 12, 18, or 24)',
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
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              variant="heading"
              style={{
                fontSize: 22,
                fontWeight: '600',
                color: text,
              }}
            >
              {title}
            </Text>
            <Pressable onPress={onDismiss} style={{ padding: 4 }}>
              <X size={24} color={textMuted} />
            </Pressable>
          </View>

          {/* Message */}
          <Text
            variant="body"
            style={{
              fontSize: 15,
              color: textMuted,
              marginBottom: 20,
            }}
          >
            {message}
          </Text>

          {/* Benefits */}
          <View style={{ marginBottom: 24, gap: 12 }}>
            {benefits.map((benefit, index) => (
              <View
                key={index}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Check size={20} color={primary} />
                <Text
                  variant="body"
                  style={{
                    fontSize: 15,
                    color: text,
                    flex: 1,
                  }}
                >
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
                paddingVertical: 12,
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
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 12,
                backgroundColor: primary,
                alignItems: 'center',
              }}
            >
              <Text variant="body" style={{ color: '#fff', fontWeight: '600' }}>
                Upgrade
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
