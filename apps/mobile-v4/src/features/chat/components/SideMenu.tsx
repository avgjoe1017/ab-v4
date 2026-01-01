import { Icon } from '@/ui/components/icon';
import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { MessageSquare, BookOpen, X } from 'lucide-react-native';
import { Pressable, Animated, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef } from 'react';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToChat: () => void;
  onNavigateToLibrary: () => void;
  currentRoute?: 'chat' | 'library';
}

export function SideMenu({
  visible,
  onClose,
  onNavigateToChat,
  onNavigateToLibrary,
  currentRoute = 'chat',
}: SideMenuProps) {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -280,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleNavigateToChat = () => {
    onNavigateToChat();
    onClose();
  };

  const handleNavigateToLibrary = () => {
    onNavigateToLibrary();
    onClose();
  };

  // Header height calculation: 
  // ChatHeader: paddingTop (8) + content (~32) + paddingBottom (10) + border (1) = ~51px
  // Library header: paddingTop (16) + content (~28) + paddingBottom (12) + border (1) = ~57px
  // Menu header: paddingTop (8) + content (~32) + paddingBottom (10) + border (1) = ~51px
  // Use the larger header height to ensure alignment works for both screens
  const headerHeight = 57; // Library header is taller
  const menuHeaderHeight = 51; // Menu header height

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* Side Menu - positioned on the left */}
        <Animated.View
          style={{
            width: 280,
            height: '100%',
            backgroundColor: background,
            transform: [{ translateX: slideAnim }],
            borderRightWidth: 1,
            borderRightColor: border,
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1000,
            paddingTop: insets.top, // Account for safe area
          }}
        >
          <View style={{ flex: 1 }}>
            {/* Header - aligned with main header divider */}
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
                marginTop: headerHeight - menuHeaderHeight, // Align divider with main header
              }}
            >
              <Text variant="heading" style={{ color: text }}>
                Menu
              </Text>
              <Pressable
                onPress={onClose}
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={X} size={20} color={mutedText} />
              </Pressable>
            </View>

            {/* Menu Items */}
            <View style={{ paddingTop: 8 }}>
              <Pressable
                onPress={handleNavigateToChat}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: currentRoute === 'chat' ? card : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: currentRoute === 'chat' ? text + '10' : card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Icon
                    name={MessageSquare}
                    size={20}
                    color={currentRoute === 'chat' ? text : mutedText}
                  />
                </View>
                <Text
                  variant="body"
                  style={{
                    color: currentRoute === 'chat' ? text : mutedText,
                    fontWeight: currentRoute === 'chat' ? '600' : '400',
                  }}
                >
                  AI CHAT
                </Text>
              </Pressable>

              <Pressable
                onPress={handleNavigateToLibrary}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: currentRoute === 'library' ? card : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: currentRoute === 'library' ? text + '10' : card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Icon
                    name={BookOpen}
                    size={20}
                    color={currentRoute === 'library' ? text : mutedText}
                  />
                </View>
                <Text
                  variant="body"
                  style={{
                    color: currentRoute === 'library' ? text : mutedText,
                    fontWeight: currentRoute === 'library' ? '600' : '400',
                  }}
                >
                  LIBRARY
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Backdrop - positioned after menu so it covers everything */}
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}
