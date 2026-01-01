import { Icon } from '@/ui/components/icon';
import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { ChevronDown, Menu, Settings } from 'lucide-react-native';
import { Pressable } from 'react-native';
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { PrivacySheet } from '@/features/shared/components/PrivacySheet';

interface ChatHeaderProps {
  onMenuPress?: () => void;
}

export function ChatHeader({ onMenuPress }: ChatHeaderProps) {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const router = useRouter();
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);

  const handleSettingsPress = () => {
    router.push('/settings');
  };

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
        onPress={onMenuPress}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={Menu} size={24} color={text} />
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
        onPress={handleSettingsPress}
        style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={Settings} size={24} color={text} />
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
