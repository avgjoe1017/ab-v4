/**
 * Privacy & Control Sheet Component
 * P1-9.1: One-tap sheet from HomeChat header
 * Shows what is stored, retention window, and delete options
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Modal, ScrollView, Pressable, ViewStyle, Alert, ActivityIndicator } from 'react-native';
import { X, Trash2, MessageSquare, BookOpen, Database } from 'lucide-react-native';
import React, { useState } from 'react';
import { apiClient } from '@/services/apiClient';

interface PrivacySheetProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacySheet({ visible, onClose }: PrivacySheetProps) {
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const border = useColor('border');
  const primary = useColor('primary');
  const destructive = '#ef4444';

  const [isDeleting, setIsDeleting] = useState<'chat' | 'plans' | 'all' | null>(null);

  const handleDeleteChat = async () => {
    Alert.alert(
      'Delete Chat History',
      'This will permanently delete all your chat messages and conversation history. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting('chat');
              await apiClient.delete('/v4/me/chat-history');
              Alert.alert('Success', 'Your chat history has been deleted.');
              onClose();
            } catch (err) {
              console.error('[PrivacySheet] Failed to delete chat history:', err);
              Alert.alert('Error', 'Failed to delete chat history. Please try again.');
            } finally {
              setIsDeleting(null);
            }
          },
        },
      ]
    );
  };

  const handleDeletePlans = async () => {
    Alert.alert(
      'Delete Saved Plans',
      'This will permanently delete all your saved plans. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting('plans');
              await apiClient.delete('/v4/me/saved-plans');
              Alert.alert('Success', 'Your saved plans have been deleted.');
              onClose();
            } catch (err) {
              console.error('[PrivacySheet] Failed to delete saved plans:', err);
              Alert.alert('Error', 'Failed to delete saved plans. Please try again.');
            } finally {
              setIsDeleting(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAll = async () => {
    Alert.alert(
      'Delete Everything',
      'This will permanently delete all your data including chat history, saved plans, and account information. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting('all');
              await apiClient.delete('/v4/me/account');
              Alert.alert('Success', 'All your data has been deleted.');
              onClose();
            } catch (err) {
              console.error('[PrivacySheet] Failed to delete account:', err);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            } finally {
              setIsDeleting(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderWidth: 1,
            borderColor: border,
            maxHeight: '90%',
          }}
        >
          {/* Header */}
          <View
            style={{
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '600', color: text }}>
              Privacy & Control
            </Text>
            <Pressable onPress={onClose} style={{ padding: 4 }}>
              <X size={24} color={textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
          >
            {/* What is stored */}
            <View style={{ marginBottom: 32 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Database size={20} color={primary} />
                <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>
                  What We Store
                </Text>
              </View>
              <View style={{ gap: 8, paddingLeft: 28 }}>
                <Text style={{ fontSize: 14, color: textMuted }}>
                  • Chat messages and conversation history
                </Text>
                <Text style={{ fontSize: 14, color: textMuted }}>
                  • Saved plans and preferences
                </Text>
                <Text style={{ fontSize: 14, color: textMuted }}>
                  • Usage statistics (for service improvement)
                </Text>
                <Text style={{ fontSize: 14, color: textMuted }}>
                  • Account information (email, subscription status)
                </Text>
              </View>
            </View>

            {/* Retention window */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 12 }}>
                Data Retention
              </Text>
              <Text style={{ fontSize: 14, color: textMuted, lineHeight: 20 }}>
                We retain your data for as long as your account is active. You can delete your data at any time using the options below.
              </Text>
            </View>

            {/* Delete options */}
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 8 }}>
                Delete Your Data
              </Text>

              {/* Delete Chat History */}
              <Pressable
                onPress={handleDeleteChat}
                disabled={isDeleting !== null}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: 'transparent',
                    opacity: (pressed || isDeleting !== null) ? 0.7 : 1,
                  } as ViewStyle,
                ]}
              >
                <MessageSquare size={20} color={destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: text }}>
                    Delete Chat History
                  </Text>
                  <Text style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>
                    Remove all conversation messages
                  </Text>
                </View>
                {isDeleting === 'chat' && <ActivityIndicator size="small" color={destructive} />}
              </Pressable>

              {/* Delete Saved Plans */}
              <Pressable
                onPress={handleDeletePlans}
                disabled={isDeleting !== null}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: border,
                    backgroundColor: 'transparent',
                    opacity: (pressed || isDeleting !== null) ? 0.7 : 1,
                  } as ViewStyle,
                ]}
              >
                <BookOpen size={20} color={destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: text }}>
                    Delete Saved Plans
                  </Text>
                  <Text style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>
                    Remove all saved plans from your library
                  </Text>
                </View>
                {isDeleting === 'plans' && <ActivityIndicator size="small" color={destructive} />}
              </Pressable>

              {/* Delete Everything */}
              <Pressable
                onPress={handleDeleteAll}
                disabled={isDeleting !== null}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: destructive,
                    backgroundColor: destructive + '10',
                    opacity: (pressed || isDeleting !== null) ? 0.7 : 1,
                  } as ViewStyle,
                ]}
              >
                <Trash2 size={20} color={destructive} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: destructive }}>
                    Delete Everything
                  </Text>
                  <Text style={{ fontSize: 13, color: textMuted, marginTop: 2 }}>
                    Permanently delete all your data and account
                  </Text>
                </View>
                {isDeleting === 'all' && <ActivityIndicator size="small" color={destructive} />}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
