import { AvoidKeyboard } from '@/components/ui/avoid-keyboard';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import React, { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  SafeAreaView,
  TextInput,
  ViewStyle,
} from 'react-native';
import {
  ChevronDown,
  Copy,
  Mic,
  Plus,
  SendHorizontal,
  Sparkles,
} from 'lucide-react-native';

type ChatRole = 'user' | 'assistant';
type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
};

const SUGGESTIONS = [
  {
    title: 'What\'s keeping you up?'
    ,
    subtitle: 'Turn it into a steady plan',
  },
  {
    title: 'What\'s on your mind?'
    ,
    subtitle: 'Write affirmations for today',
  },
] as const;

export default function HomeScreen() {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const primary = useColor('primary');

  const inputRef = useRef<TextInput>(null);

  const [composerText, setComposerText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const showEmptyState = messages.length === 0;

  const listData = useMemo(() => {
    // FlatList is inverted so newest appears at bottom.
    return [...messages].reverse();
  }, [messages]);

  const send = (rawText?: string) => {
    const textToSend = (rawText ?? composerText).trim();
    if (!textToSend) return;

    Keyboard.dismiss();
    setComposerText('');

    const userMsg: ChatMessage = {
      id: String(Date.now()) + '-u',
      role: 'user',
      text: textToSend,
    };

    setMessages((prev) => [...prev, userMsg]);

    // Placeholder assistant response (wire this to your real flow later).
    const assistantMsg: ChatMessage = {
      id: String(Date.now()) + '-a',
      role: 'assistant',
      text: 'Got it. Tell me one detail that would make this feel 10% lighter.',
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, assistantMsg]);
    }, 450);
  };

  const Header = () => (
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
        accessibilityRole='button'
        onPress={() => {
          // Reserved (e.g. open Library / profile)
        }}
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
        accessibilityRole='button'
        onPress={() => {
          // Reserved (e.g. switch mode)
        }}
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
        accessibilityRole='button'
        onPress={() => {
          // Reserved (e.g. new chat)
          setMessages([]);
          setComposerText('');
        }}
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
    </View>
  );

  const SuggestionCard = ({
    title,
    subtitle,
    style,
  }: {
    title: string;
    subtitle: string;
    style?: ViewStyle;
  }) => (
    <Pressable
      accessibilityRole='button'
      onPress={() => {
        setComposerText(title);
        requestAnimationFrame(() => inputRef.current?.focus());
      }}
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

  const EmptyState = () => (
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
          What\'s pinging around your head today?
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: mutedText,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          Tell me what you want to feel instead. I\'ll turn it into an affirmation plan.
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
        <SuggestionCard {...SUGGESTIONS[0]} />
        <SuggestionCard {...SUGGESTIONS[1]} />
      </View>
    </View>
  );

  const Bubble = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

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
            name={isUser ? Sparkles : Sparkles}
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
  };

  const Composer = () => (
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
          accessibilityRole='button'
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
            value={composerText}
            onChangeText={setComposerText}
            placeholder='Message'
            placeholderTextColor={mutedText + '99'}
            style={{
              fontSize: 17,
              color: text,
              padding: 0,
              margin: 0,
            }}
            returnKeyType='send'
            onSubmitEditing={() => send()}
            blurOnSubmit={false}
          />
        </View>

        <Pressable
          accessibilityRole='button'
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
          accessibilityRole='button'
          onPress={() => send()}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: primary,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon name={SendHorizontal} size={18} color={background} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <Header />

      <View style={{ flex: 1 }}>
        {showEmptyState ? (
          <EmptyState />
        ) : (
          <FlatList
            data={listData}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Bubble item={item} />}
            keyboardDismissMode='on-drag'
            contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }}
          />
        )}
      </View>

      <Composer />
      <AvoidKeyboard offset={0} duration={0} />
    </SafeAreaView>
  );
}
