import { Icon } from '@/ui/components/icon';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { Mic, Plus, SendHorizontal } from 'lucide-react-native';
import { Pressable, TextInput } from 'react-native';
import React, { RefObject } from 'react';

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  inputRef?: RefObject<TextInput>;
  disabled?: boolean;
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  inputRef,
  disabled = false,
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
    </View>
  );
}
