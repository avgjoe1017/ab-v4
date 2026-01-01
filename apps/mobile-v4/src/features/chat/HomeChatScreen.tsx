import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { ChatBubble } from './components/ChatBubble';
import { ChatComposer } from './components/ChatComposer';
import { ChatEmptyState } from './components/ChatEmptyState';
import { ChatHeader } from './components/ChatHeader';
import { SideMenu } from './components/SideMenu';
import { ChatMessage, ChatTurnState, PlanPreview } from './types';
import { processChatTurn } from './api/chatApi';
import { PlanPreviewCard } from '../plan/components/PlanPreviewCard';
import { EditPlanModal } from '../plan/components/EditPlanModal';
import { apiClient } from '@/services/apiClient';
import type { EntitlementV4 } from '@ab/contracts';
import { FlatList, Keyboard, SafeAreaView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'expo-router';

export default function HomeChatScreen() {
  const background = useColor('background');
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const inputRef = useRef<TextInput>(null);

  const [composerText, setComposerText] = useState('');
  const [turnState, setTurnState] = useState<ChatTurnState>({
    messages: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementV4 | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [hasSavedPlans, setHasSavedPlans] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Fetch entitlements
  useEffect(() => {
    const fetchEntitlements = async () => {
      try {
        const ent = await apiClient.get<EntitlementV4>('/v4/me/entitlement');
        setEntitlement(ent);
      } catch (err) {
        // Check if it's a network error (API not running)
        const isNetworkError = (err as any)?.isNetworkError === true;
        if (isNetworkError) {
          // Log at warn level - expected during development if API isn't running
          console.warn('[HomeChatScreen] API server not available, using default free tier');
        } else {
          console.error('[HomeChatScreen] Failed to fetch entitlements:', err);
        }
        // Default to free tier if fetch fails
        setEntitlement({
          schemaVersion: 4,
          plan: 'free',
          status: 'unknown',
          limits: {
            dailyPlans: 1,
            maxSessionDurationMs: 300000,
            affirmationCountsAllowed: [6],
            canSave: false,
            voicesAllowed: ['male', 'female'],
            canPickBrainTrack: false,
            canPickBackground: false,
            canWriteOwnAffirmations: false,
          },
          canCreatePlan: true,
          remainingPlansToday: 1,
        });
      }
    };

    fetchEntitlements();
  }, []);

  // Track keyboard visibility
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // P1-7.2: Check if user has saved plans for "same vibe as yesterday"
  useEffect(() => {
    const checkSavedPlans = async () => {
      try {
        const response = await apiClient.get<{ settings: {
          voiceId?: string;
          brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
          binauralHz?: number;
          solfeggioHz?: number;
          backgroundId?: string;
          affirmationCount?: number;
          toneTag?: string;
        } | null }>('/v4/me/last-plan');
        setHasSavedPlans(response.settings !== null);
      } catch (err) {
        // If endpoint fails or user has no saved plans, hide the chip
        setHasSavedPlans(false);
      }
    };

    if (entitlement?.limits.canSave) {
      checkSavedPlans();
    } else {
      setHasSavedPlans(false);
    }
  }, [entitlement]);

  const showEmptyState = turnState.messages.length === 0;

  const listData = useMemo(() => {
    // FlatList is inverted so newest appears at bottom.
    return [...turnState.messages].reverse();
  }, [turnState.messages]);

  const send = async (rawText?: string) => {
    const textToSend = (rawText ?? composerText).trim();
    if (!textToSend || isLoading) return;

    Keyboard.dismiss();
    setComposerText('');
    setIsLoading(true);

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: String(Date.now()) + '-u',
      role: 'user',
      text: textToSend,
    };

    setTurnState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
    }));

    try {
      // Call API
      const response = await processChatTurn({
        threadId: turnState.threadId,
        message: textToSend,
      });

      // Update thread ID
      setTurnState((prev) => ({
        ...prev,
        threadId: response.threadId,
      }));

      // Add assistant messages
      const assistantMessages: ChatMessage[] = response.assistantMessages.map((msg) => ({
        id: msg.id,
        role: 'assistant',
        text: msg.text,
      }));

      setTurnState((prev) => {
        // Reset regenerateCount when a new plan preview arrives (new planDraftId)
        const newPlanDraftId = response.planPreview?.planDraftId;
        const prevPlanDraftId = prev.planPreview?.planDraftId;
        if (newPlanDraftId && newPlanDraftId !== prevPlanDraftId) {
          setRegenerateCount(0);
        }
        
        return {
          ...prev,
          messages: [...prev.messages, ...assistantMessages],
          planPreview: response.planPreview,
          suggestedChips: response.suggestedChips,
        };
      });
    } catch (error) {
      // Check if it's a network error
      const isNetworkError = (error as any)?.isNetworkError === true;
      if (isNetworkError) {
        console.warn('[HomeChatScreen] API server not available for chat');
        // Add more helpful error message for network issues
        const errorMsg: ChatMessage = {
          id: String(Date.now()) + '-error',
          role: 'assistant',
          text: 'Unable to connect to server. Please make sure the API server is running.',
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMsg],
        }));
      } else {
        console.error('Failed to process chat turn:', error);
        // Add error message
        const errorMsg: ChatMessage = {
          id: String(Date.now()) + '-error',
          role: 'assistant',
          text: 'Sorry, something went wrong. Please try again.',
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMsg],
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionPress = (title: string) => {
    setComposerText(title);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleNewChat = () => {
    setTurnState({
      messages: [],
    });
    setComposerText('');
  };

  const handleStartSession = async (audioSelections?: {
    voiceId?: string;
    brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
    binauralHz?: number;
    solfeggioHz?: number;
    backgroundId?: string;
  }) => {
    if (!turnState.planPreview || isCommitting) return;
    
    try {
      setIsCommitting(true);
      console.log('Committing plan:', turnState.planPreview);
      
      // P1-6.1, P1-6.2, P1-6.3: Commit with audio selections
      if (!turnState.threadId) {
        throw new Error('Thread ID is required to commit plan');
      }
      
      const response = await apiClient.post<{ planId: string; audioJobId?: string }>(
        '/v4/plans/commit',
        {
          threadId: turnState.threadId,
          planDraftId: turnState.planPreview.planDraftId,
          selections: {
            affirmationCount: turnState.planPreview.affirmations.length,
            voiceId: audioSelections?.voiceId,
            brainTrackMode: audioSelections?.brainTrackMode,
            binauralHz: audioSelections?.binauralHz,
            solfeggioHz: audioSelections?.solfeggioHz,
            backgroundId: audioSelections?.backgroundId,
          },
        }
      );
      
      console.log('Plan committed, navigating to player with planId:', response.planId);
      
      // Navigate to player screen with the committed plan ID
      router.push({
        pathname: '/player',
        params: { planId: response.planId },
      });
    } catch (error) {
      console.error('Failed to commit plan:', error);
      // Show error message to user
      const errorMsg: ChatMessage = {
        id: String(Date.now()) + '-error',
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Failed to start session. Please try again.',
      };
      setTurnState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
      }));
    } finally {
      setIsCommitting(false);
    }
  };

  const handleEditPlan = () => {
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleSavePlan = async (updatedPlan: PlanPreview) => {
    // Update the plan preview with the edited affirmations
    setTurnState((prev) => ({
      ...prev,
      planPreview: updatedPlan,
    }));
    setShowEditModal(false);
  };

  const handleRegeneratePlan = async () => {
    if (!turnState.planPreview?.planDraftId) return;
    
    try {
      const response = await apiClient.post<{
        planDraft: {
          id: string;
          title: string;
          affirmations: string[];
          rerollsRemaining: boolean | 'unlimited';
        };
      }>('/v4/plans/reroll', {
        planDraftId: turnState.planPreview.planDraftId,
      });
      
      // Update plan preview with new affirmations
      setTurnState((prev) => ({
        ...prev,
        planPreview: prev.planPreview
          ? {
              ...prev.planPreview,
              affirmations: response.planDraft.affirmations,
              title: response.planDraft.title,
            }
          : undefined,
      }));
      
      // Increment regenerate count
      setRegenerateCount((prev) => prev + 1);
    } catch (err: any) {
      console.error('[HomeChatScreen] Regenerate failed:', err);
      
      // Handle specific error cases
      if (err?.status === 403 || err?.error?.code === 'REROLL_LIMIT_REACHED') {
        // Reroll limit reached - show helpful message with upgrade option
        const limitMsg: ChatMessage = {
          id: String(Date.now()) + '-limit',
          role: 'assistant',
          text: "You've reached your regeneration limit for this plan. Upgrade to Pro for unlimited regenerations!",
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, limitMsg],
        }));
        // Optionally navigate to settings
        // router.push('/settings');
      } else if ((err as any)?.isNetworkError) {
        // Network error
        const networkMsg: ChatMessage = {
          id: String(Date.now()) + '-network',
          role: 'assistant',
          text: "Can't reach the server right now. Please check your connection and try again.",
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, networkMsg],
        }));
      } else {
        // Generic error
        const errorMsg: ChatMessage = {
          id: String(Date.now()) + '-error',
          role: 'assistant',
          text: 'Failed to regenerate plan. Please try again.',
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMsg],
        }));
      }
    }
  };

  // P1-7.2: Handle "same vibe as yesterday" shortcut
  const handleSameVibe = async () => {
    try {
      const response = await apiClient.get<{ settings: {
        voiceId?: string;
        brainTrackMode?: 'binaural' | 'solfeggio' | 'none';
        binauralHz?: number;
        solfeggioHz?: number;
        backgroundId?: string;
        affirmationCount?: number;
        toneTag?: string;
      } | null }>('/v4/me/last-plan');

      if (!response.settings) {
        // No saved plans - show message
        const errorMsg: ChatMessage = {
          id: String(Date.now()) + '-error',
          role: 'assistant',
          text: "You don't have any saved plans yet. Save a plan to use this shortcut!",
        };
        setTurnState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMsg],
        }));
        return;
      }

      // P1-7.2: Send message with tone tag (does not require storing sensitive transcript)
      const message = response.settings.toneTag 
        ? `Same vibe as yesterday: ${response.settings.toneTag}`
        : 'Same vibe as yesterday';
      
      send(message);
    } catch (err) {
      console.error('[HomeChatScreen] Failed to get last plan:', err);
      const errorMsg: ChatMessage = {
        id: String(Date.now()) + '-error',
        role: 'assistant',
        text: 'Unable to load your last plan. Please try again.',
      };
      setTurnState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
      }));
    }
  };

  // Render list item (message or plan preview)
  const renderListItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    // Show plan preview after the last assistant message that offered it
    const shouldShowPlanPreview = 
      turnState.planPreview &&
      item.role === 'assistant' &&
      index === 0 && // Last message (list is inverted)
      turnState.messages.length > 0;

    return (
      <>
        <ChatBubble item={item} />
        {shouldShowPlanPreview && (
          <PlanPreviewCard
            planPreview={turnState.planPreview!}
            entitlement={entitlement || undefined}
            onStartSession={handleStartSession}
            onEdit={handleEditPlan}
            onRegenerate={handleRegeneratePlan}
            regenerateCount={regenerateCount}
            isCommitting={isCommitting}
          />
        )}
      </>
    );
  };

  const handleMenuPress = () => {
    setShowSideMenu(true);
  };

  const handleNavigateToChat = () => {
    router.push('/(tabs)/(home)');
  };

  const handleNavigateToLibrary = () => {
    router.push('/(tabs)/library');
  };

  const currentRoute = pathname?.includes('library') ? 'library' : 'chat';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <ChatHeader onMenuPress={handleMenuPress} />
      
      <SideMenu
        visible={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        onNavigateToChat={handleNavigateToChat}
        onNavigateToLibrary={handleNavigateToLibrary}
        currentRoute={currentRoute}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{ flex: 1 }}>
          {showEmptyState ? (
            <ChatEmptyState onSuggestionPress={handleSuggestionPress} />
          ) : (
            <>
              <FlatList
                data={listData}
                inverted
                keyExtractor={(item) => item.id}
                renderItem={renderListItem}
                keyboardDismissMode="on-drag"
                contentContainerStyle={{ 
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              />
              {isLoading && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" />
                </View>
              )}
            </>
          )}
        </View>

        <View
          style={{
            paddingBottom: isKeyboardVisible ? 0 : insets.bottom,
            backgroundColor: background,
          }}
        >
          <ChatComposer
            value={composerText}
            onChangeText={setComposerText}
            onSend={() => send()}
            inputRef={inputRef}
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Edit Plan Modal */}
      {turnState.planPreview && (
        <EditPlanModal
          visible={showEditModal}
          planPreview={turnState.planPreview}
          entitlement={entitlement || undefined}
          onClose={handleCloseEditModal}
          onSave={handleSavePlan}
        />
      )}
    </SafeAreaView>
  );
}
