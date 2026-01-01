import { Icon } from '@/ui/components/icon';
import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { Sparkles } from 'lucide-react-native';
import React from 'react';
import { ChatMessage } from '../types';

interface ChatBubbleProps {
  item: ChatMessage;
}

export function ChatBubble({ item }: ChatBubbleProps) {
  const isUser = item.role === 'user';
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const primary = useColor('primary');
  const background = useColor('background');

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          backgroundColor: isUser ? card : primary,
          borderWidth: isUser ? 1 : 0,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={Sparkles}
          size={14}
          color={isUser ? mutedText : background}
        />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 17, fontWeight: '600', color: text }}>
          {isUser ? 'You' : 'Affirmation Beats'}
        </Text>
        <Text
          style={{
            fontSize: 17,
            fontWeight: '400',
            color: text,
            lineHeight: 26,
          }}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );
}
