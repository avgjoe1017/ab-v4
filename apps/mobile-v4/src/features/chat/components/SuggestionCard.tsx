import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { Pressable, ViewStyle } from 'react-native';
import React from 'react';

interface SuggestionCardProps {
  title: string;
  subtitle: string;
  style?: ViewStyle;
  onPress?: () => void;
}

export function SuggestionCard({
  title,
  subtitle,
  style,
  onPress,
}: SuggestionCardProps) {
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingHorizontal: 16,
          paddingVertical: 13,
          backgroundColor: card,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: border,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>
          {title}
        </Text>
        <Text style={{ fontSize: 16, color: mutedText }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}
