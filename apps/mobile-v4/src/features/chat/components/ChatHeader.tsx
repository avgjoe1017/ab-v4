import { Icon } from '@/ui/components/icon';
import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { ChevronDown, Copy, Sparkles, Settings } from 'lucide-react-native';
import { Pressable } from 'react-native';
import React, { useState } from 'react';
import { PrivacySheet } from '@/features/shared/components/PrivacySheet';

interface ChatHeaderProps {
  onLibraryPress?: () => void;
  onNewChatPress?: () => void;
}

export function ChatHeader({ onLibraryPress, onNewChatPress }: ChatHeaderProps) {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);

  return (
    <>
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: border,
        backgroundColor: background,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onLibraryPress}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            backgroundColor: card,
            borderWidth: 1,
            borderColor: border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={Sparkles} size={14} color={mutedText} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPrivacySheet(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '600', color: text }}>
          Affirmation Beats
        </Text>
        <Text style={{ fontSize: 17, color: mutedText }}>4</Text>
        <Icon name={ChevronDown} size={16} color={mutedText} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onNewChatPress}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={Copy} size={18} color={mutedText} />
        </View>
      </Pressable>

      {/* P1-9.1: Privacy Sheet */}
      <PrivacySheet
        visible={showPrivacySheet}
        onClose={() => setShowPrivacySheet(false)}
      />
    </View>
    </>
  );
}
