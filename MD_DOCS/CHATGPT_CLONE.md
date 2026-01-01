Here is the comprehensive guide, including the new **Typing Indicator** animation, formatted as a single Markdown file. You can save this as `README.md` or keep it as a reference for your build.

---

# ChatGPT UI Clone (React Native)

This guide walks you through building a frontend-only clone of the ChatGPT mobile interface using React Native. It focuses on the dark mode UI, list management, keyboard handling, and a realistic typing indicator animation.

## Prerequisites

* Node.js installed
* React Native development environment set up (Expo is recommended for simplicity)

## 1. Project Initialization

Create a new Expo project and install the necessary dependencies for icons and safe area management.

```bash
npx create-expo-app ChatGPTClone
cd ChatGPTClone
npx expo install react-native-safe-area-context react-native-vector-icons

```

## 2. Directory Structure

Create the following folder structure inside your root directory to keep components organized:

```text
/src
  /components
    ChatMessage.js
    ChatInput.js
    TypingIndicator.js  <-- New!
  /screens
    ChatScreen.js
  /constants
    colors.js

```

## 3. Constants (Colors)

Define the official ChatGPT color palette in `src/constants/colors.js` to ensure consistency.

```javascript
// src/constants/colors.js
export default {
  background: '#343541',
  inputBackground: '#40414F',
  userMessage: '#343541', 
  botMessage: '#444654',
  text: '#ECECF1',
  placeholder: '#8E8EA0',
  tint: '#10a37f', // OpenAI Green
};

```

## 4. Components

### A. The Typing Indicator (Animation)

This component creates three dots that bounce rhythmically to simulate the bot "thinking."

**File:** `src/components/TypingIndicator.js`

```javascript
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: -5, // Move up 5 pixels
            duration: 400,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0, // Move back down
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.botAvatar}>
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: colors.botMessage, // Matches bot bubble background
    alignSelf: 'flex-start',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
    marginBottom: 10,
    marginLeft: 16,
    width: 80,
  },
  botAvatar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4, // React Native 0.71+ supports gap
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8e8ea0',
    marginHorizontal: 2,
  },
});

export default TypingIndicator;

```

### B. Chat Message (Bubble)

Handles rendering both User and AI messages with distinct styles and avatars.

**File:** `src/components/ChatMessage.js`

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

const ChatMessage = ({ content, role }) => {
  const isBot = role === 'assistant';

  return (
    <View style={[
      styles.container, 
      { backgroundColor: isBot ? colors.botMessage : colors.userMessage }
    ]}>
      <View style={styles.contentWrapper}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {isBot ? (
            <View style={styles.botAvatar}>
              <Text style={styles.botAvatarText}>AI</Text>
            </View>
          ) : (
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>U</Text>
            </View>
          )}
        </View>

        {/* Text */}
        <Text style={styles.text}>{content}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  contentWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  avatarContainer: {
    marginRight: 16,
    width: 30,
    alignItems: 'center',
  },
  botAvatar: {
    width: 30,
    height: 30,
    backgroundColor: colors.tint,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 30,
    height: 30,
    backgroundColor: '#5436DA',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 14,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    flex: 1,
  },
});

export default ChatMessage;

```

### C. Chat Input

A text input that sits at the bottom of the screen.

**File:** `src/components/ChatInput.js`

```javascript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import colors from '../constants/colors';

const ChatInput = ({ onSend, disabled }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim().length > 0) {
      onSend(text);
      setText('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Send a message..."
          placeholderTextColor={colors.placeholder}
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
        />
        <TouchableOpacity 
          onPress={handleSend} 
          style={styles.sendButton}
          disabled={disabled || text.trim().length === 0}
        >
          <Ionicons 
            name="send" 
            size={16} 
            color={text.trim().length > 0 ? colors.text : colors.placeholder} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    alignItems: 'flex-end', 
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: 8, 
    paddingBottom: 8,
  },
  sendButton: {
    marginLeft: 8,
    marginBottom: 8,
    padding: 4,
  },
});

export default ChatInput;

```

## 5. Main Screen

This is the controller. It manages the message list state, handles the "simulated" API delay, and toggles the `TypingIndicator`.

**File:** `src/screens/ChatScreen.js`

```javascript
import React, { useState, useRef } from 'react';
import { 
  SafeAreaView, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  StyleSheet, 
  StatusBar,
  View 
} from 'react-native';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import TypingIndicator from '../components/TypingIndicator';
import colors from '../constants/colors';

const ChatScreen = () => {
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', content: 'Hello! This is a UI clone. How can I help?' },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  
  const flatListRef = useRef(null);

  const handleSend = (text) => {
    // 1. Add User Message
    const userMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);

    // 2. Set Typing State
    setIsTyping(true);

    // 3. Simulate Network Delay (2 seconds)
    setTimeout(() => {
      const botResponse = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: 'I am a simulated response demonstrating the typing indicator.' 
      };
      
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        style={styles.keyboardView}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatMessage content={item.content} role={item.role} />
          )}
          style={styles.list}
          // Header used for spacing at top
          ListHeaderComponent={<View style={{ height: 10 }} />}
          // Footer is where we place the Typing Indicator
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: true })}
        />
        
        <ChatInput onSend={handleSend} disabled={isTyping} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
});

export default ChatScreen;

```

## 6. App Entry

Finally, link the screen in your `App.js`.

**File:** `App.js`

```javascript
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ChatScreen from './src/screens/ChatScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ChatScreen />
    </SafeAreaProvider>
  );
}

```

## 7. Next Steps

Your UI clone is now functional with simulated logic! Here is what you can do to take it to the next level:

1. **Connect to OpenAI:** Replace the `setTimeout` in `ChatScreen.js` with a `fetch` call to the OpenAI API using your API Key.
2. **Markdown Rendering:** The real ChatGPT renders code blocks and bold text. You can implement `react-native-markdown-display` inside the `ChatMessage` component to parse the bot's responses.
3. **Persist Chats:** Use `AsyncStorage` to save the message history locally on the phone.