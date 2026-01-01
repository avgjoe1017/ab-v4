import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

interface AvoidKeyboardProps {
  children: React.ReactNode;
  offset?: number;
  duration?: number;
}

/**
 * Wrapper component to avoid keyboard overlap
 */
export function AvoidKeyboard({
  children,
  offset = 0,
  duration = 0,
}: AvoidKeyboardProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom + offset}
      style={{ flex: 1 }}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
