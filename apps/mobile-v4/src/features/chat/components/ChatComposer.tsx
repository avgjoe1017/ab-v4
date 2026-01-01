import { Icon } from '@/ui/components/icon';
import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Mic, Plus, SendHorizontal } from 'lucide-react-native';
import { Pressable, TextInput, ViewStyle } from 'react-native';
import React, { RefObject } from 'react';

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  inputRef?: RefObject<TextInput>;
  disabled?: boolean;
  onChipPress?: (text: string) => void; // P1-7.1: Chip press handler
  showChips?: boolean; // P1-7.1: Show chips below input
  showSameVibe?: boolean; // P1-7.2: Show "same vibe as yesterday" chip
  onSameVibePress?: () => void; // P1-7.2: Same vibe handler
}

// P1-7.1: HomeChat chips - lightweight, gentle suggestions
const CHIPS = [
  { id: 'sleep', text: 'Help me sleep' },
  { id: 'quiet', text: 'Quiet my mind' },
  { id: 'confidence', text: 'Confidence at work' },
];

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  inputRef,
  disabled = false,
  onChipPress,
  showChips = false,
  showSameVibe = false,
  onSameVibePress,
}: ChatComposerProps) {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const primary = useColor('primary');

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: border,
        backgroundColor: background,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Reserved (e.g. attachments)
          }}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: card,
            borderWidth: 1,
            borderColor: border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name={Plus} size={18} color={mutedText} />
        </Pressable>

        <View
          style={{
            flex: 1,
            minHeight: 40,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: background,
            paddingHorizontal: 14,
            paddingVertical: 9,
            justifyContent: 'center',
          }}
        >
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder="Message"
            placeholderTextColor={mutedText + '99'}
            style={{
              fontSize: 17,
              color: text,
              padding: 0,
              margin: 0,
              opacity: disabled ? 0.5 : 1,
            }}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
            editable={!disabled}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            // Reserved (e.g. voice input)
          }}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: card,
            borderWidth: 1,
            borderColor: border,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name={Mic} size={18} color={mutedText} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={disabled ? undefined : onSend}
          disabled={disabled}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primary,
            opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          })}
        >
          <Icon name={SendHorizontal} size={18} color={background} />
        </Pressable>
      </View>

      {/* P1-7.1 & P1-7.2: HomeChat Chips - lightweight suggestions below input */}
      {(showChips || showSameVibe) && (
        <View
          style={{
            flexDirection: 'row',
            gap: 8,
            marginTop: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* P1-7.2: "Same vibe as yesterday" chip (shown first if available) */}
          {showSameVibe && onSameVibePress && (
            <Pressable
              onPress={onSameVibePress}
              disabled={disabled}
              style={({ pressed }) => [
                {
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: primary,
                  backgroundColor: primary + '10',
                  opacity: (pressed || disabled) ? 0.6 : 1,
                } as ViewStyle,
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: primary,
                  fontWeight: '500',
                }}
              >
                {SAME_VIBE_CHIP.text}
              </Text>
            </Pressable>
          )}
          
          {/* P1-7.1: Regular chips */}
          {showChips && onChipPress && CHIPS.map((chip) => (
            <Pressable
              key={chip.id}
              onPress={() => onChipPress(chip.text)}
              disabled={disabled}
              style={({ pressed }) => [
                {
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: border,
                  backgroundColor: 'transparent',
                  opacity: (pressed || disabled) ? 0.6 : 1,
                } as ViewStyle,
              ]}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: text,
                  fontWeight: '400',
                }}
              >
                {chip.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
