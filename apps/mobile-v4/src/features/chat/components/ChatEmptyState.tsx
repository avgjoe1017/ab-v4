import { Icon } from '@/ui/components/icon';
import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { Sparkles } from 'lucide-react-native';
import React from 'react';
import { SuggestionCard } from './SuggestionCard';
import { SUGGESTIONS } from '../constants';

interface ChatEmptyStateProps {
  onSuggestionPress?: (title: string) => void;
}

export function ChatEmptyState({ onSuggestionPress }: ChatEmptyStateProps) {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const primary = useColor('primary');

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={{ alignItems: 'center', paddingTop: 84, paddingBottom: 10 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 999,
            backgroundColor: primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={Sparkles} size={22} color={background} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 16 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: text,
            textAlign: 'center',
            lineHeight: 28,
          }}
        >
          What's pinging around your head today?
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: mutedText,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          Tell me what you want to feel instead. I'll turn it into an affirmation plan.
        </Text>
      </View>

      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 18,
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <SuggestionCard
          {...SUGGESTIONS[0]}
          onPress={() => onSuggestionPress?.(SUGGESTIONS[0].title)}
        />
        <SuggestionCard
          {...SUGGESTIONS[1]}
          onPress={() => onSuggestionPress?.(SUGGESTIONS[1].title)}
        />
      </View>
    </View>
  );
}
