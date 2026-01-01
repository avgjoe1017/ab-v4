/**
 * Library Screen - P1.2: Premade + Saved Plans
 * Shows premade plans (all users) and saved plans (paid only)
 * Free users see empty state with upgrade CTA
 */

import { Text } from '@/ui/components/text';
import { View } from '@/ui/components/view';
import { useColor } from '@/ui/hooks/useColor';
import { SafeAreaView, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, ChevronRight, Star } from 'lucide-react-native';
import { Icon } from '@/ui/components/icon';
import React, { useEffect, useState } from 'react';
import { fetchPremadePlans, fetchSavedPlans, savePlan, unsavePlan } from './api/libraryApi';
import { PlanCard } from './components/PlanCard';
import type { PlanV4 } from '@ab/contracts';
import { apiClient } from '@/services/apiClient';
import type { EntitlementV4 } from '@ab/contracts';
import { PaywallModal } from '@/features/shared/components/PaywallModal';

export default function LibraryScreen() {
  const background = useColor('background');
  const text = useColor('text');
  const mutedText = useColor('textMuted');
  const border = useColor('border');
  const card = useColor('card');
  const primary = useColor('primary');

  const [premadePlans, setPremadePlans] = useState<PlanV4[]>([]);
  const [premadeCursor, setPremadeCursor] = useState<string | null>(null);
  const [hasMorePremade, setHasMorePremade] = useState(false);
  const [savedPlans, setSavedPlans] = useState<PlanV4[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementV4 | null>(null);
  const [isLoadingPremade, setIsLoadingPremade] = useState(true);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const canSave = entitlement?.limits.canSave ?? false;

  // Fetch entitlements
  useEffect(() => {
    const fetchEntitlements = async () => {
      try {
        const ent = await apiClient.get<EntitlementV4>('/v4/me/entitlement');
        setEntitlement(ent);
      } catch (err) {
        console.error('[LibraryScreen] Failed to fetch entitlements:', err);
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

  // Fetch premade plans (with cursor pagination)
  const loadPremadePlans = async (cursor?: string | null, append: boolean = false) => {
    try {
      setIsLoadingPremade(true);
      const response = await fetchPremadePlans(20, cursor);
      if (append) {
        setPremadePlans(prev => [...prev, ...response.plans]);
      } else {
        setPremadePlans(response.plans);
      }
      setPremadeCursor(response.cursor);
      setHasMorePremade(response.hasMore);
      setError(null);
    } catch (err) {
      console.error('[LibraryScreen] Failed to fetch premade plans:', err);
      // P1-4.4: Detect offline/network errors
      const isNetworkError = (err as any)?.isNetworkError === true || 
                            (err instanceof Error && err.message.includes('Network'));
      setIsOffline(isNetworkError);
      setError(err instanceof Error ? err.message : 'Failed to load premade plans');
    } finally {
      setIsLoadingPremade(false);
    }
  };

  // Load more premade plans (pagination)
  const loadMorePremadePlans = async () => {
    if (premadeCursor && hasMorePremade && !isLoadingPremade) {
      await loadPremadePlans(premadeCursor, true);
    }
  };

  // Fetch saved plans (paid only)
  const loadSavedPlans = async () => {
    if (!canSave) {
      setIsLoadingSaved(false);
      return;
    }

    try {
      setIsLoadingSaved(true);
      const response = await fetchSavedPlans(20, 0);
      setSavedPlans(response.plans);
    } catch (err) {
      console.error('[LibraryScreen] Failed to fetch saved plans:', err);
      // Don't set error - saved plans might just be empty or user might not be paid
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    loadPremadePlans(); // Load first page (no cursor)
  }, []);

  useEffect(() => {
    if (canSave) {
      loadSavedPlans();
    }
  }, [canSave]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadPremadePlans(null, false), loadSavedPlans()]); // Reset to first page on refresh
    setIsRefreshing(false);
  };

  const handleSave = async (planId: string) => {
    // P1-5.3: If free user tries to save, show paywall
    if (!canSave) {
      setShowPaywall(true);
      return;
    }

    try {
      await savePlan(planId);
      // Update plan in both lists
      setPremadePlans(prev =>
        prev.map(p => (p.id === planId ? { ...p, isSaved: true } : p))
      );
      setSavedPlans(prev =>
        prev.map(p => (p.id === planId ? { ...p, isSaved: true } : p))
      );
      // Reload saved plans to include the new one
      if (canSave) {
        loadSavedPlans();
      }
    } catch (err) {
      console.error('[LibraryScreen] Failed to save plan:', err);
      // P1-5.3: If server returns forbidden (paid required), show paywall
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('paid') || errorMsg.includes('FORBIDDEN') || errorMsg.includes('403')) {
        setShowPaywall(true);
      }
    }
  };

  const handleUnsave = async (planId: string) => {
    try {
      await unsavePlan(planId);
      // Update plan in both lists
      setPremadePlans(prev =>
        prev.map(p => (p.id === planId ? { ...p, isSaved: false } : p))
      );
      setSavedPlans(prev => prev.filter(p => p.id !== planId));
    } catch (err) {
      console.error('[LibraryScreen] Failed to unsave plan:', err);
    }
  };

  const handlePlay = (planId: string) => {
    router.push({
      pathname: '/player',
      params: { planId },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Text variant="heading" style={{ color: text }}>
            Library
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Learn Section */}
          <View style={{ marginBottom: 32 }}>
            <Text variant="subtitle" style={{ marginBottom: 12, color: text }}>
              Learn
            </Text>
            <Pressable
              onPress={() => router.push('/learn/affirmation-science')}
              style={{
                backgroundColor: card,
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: primary + '20',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Icon name={BookOpen} size={20} color={primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="subtitle" style={{ marginBottom: 4, color: text }}>
                  How Affirmations Work
                </Text>
                <Text variant="caption" style={{ color: mutedText }}>
                  Research-backed guide to affirmation science and practice
                </Text>
              </View>
              <Icon name={ChevronRight} size={20} color={mutedText} />
            </Pressable>
          </View>

          {/* Saved Plans Section (Paid only, or empty state for Free) */}
          <View style={{ marginBottom: 32 }}>
            <Text variant="subtitle" style={{ marginBottom: 12, color: text }}>
              Saved Plans
            </Text>

            {isLoadingSaved ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <ActivityIndicator size="small" color={primary} />
              </View>
            ) : canSave ? (
              savedPlans.length > 0 ? (
                savedPlans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onPlay={handlePlay}
                    onSave={handleSave}
                    onUnsave={handleUnsave}
                    canSave={canSave}
                  />
                ))
              ) : (
                // P1-4.4: Paid user empty state with calm copy
                <View
                  style={{
                    backgroundColor: card,
                    borderRadius: 12,
                    padding: 24,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  <Icon name={Star} size={32} color={mutedText} style={{ marginBottom: 12 }} />
                  <Text variant="body" style={{ color: text, marginBottom: 8, textAlign: 'center' }}>
                    No saved plans yet
                  </Text>
                  <Text variant="caption" style={{ color: mutedText, textAlign: 'center' }}>
                    Save plans from below to access them here anytime
                  </Text>
                </View>
              )
            ) : (
              // P1-4.4: Free tier - calm empty state with upgrade option
              <View
                style={{
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Icon name={Star} size={32} color={mutedText} style={{ marginBottom: 12 }} />
                <Text variant="body" style={{ color: text, marginBottom: 8, textAlign: 'center' }}>
                  Save plans you like
                </Text>
                <Text
                  variant="caption"
                  style={{ color: mutedText, marginBottom: 16, textAlign: 'center' }}
                >
                  Upgrade anytime to save your favorite plans for easy access
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings')}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  <Text variant="body" style={{ color: text }}>
                    Learn more
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Premade Plans Section */}
          <View style={{ marginBottom: 32 }}>
            <Text variant="subtitle" style={{ marginBottom: 12, color: text }}>
              Premade Plans
            </Text>

            {isLoadingPremade ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <ActivityIndicator size="small" color={primary} />
              </View>
            ) : error ? (
              // P1-4.4: Error state with calm messaging and recovery actions
              <View
                style={{
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text variant="body" style={{ color: text, marginBottom: 8, textAlign: 'center' }}>
                  {isOffline 
                    ? "Looks like you're offline"
                    : "Couldn't load plans"}
                </Text>
                <Text
                  variant="caption"
                  style={{ color: mutedText, marginBottom: 16, textAlign: 'center' }}
                >
                  {isOffline
                    ? "Check your connection and try again"
                    : "Something went wrong. Please try again"}
                </Text>
                <Pressable
                  onPress={() => {
                    setIsOffline(false);
                    loadPremadePlans(null, false);
                  }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  <Text variant="body" style={{ color: text }}>
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : premadePlans.length > 0 ? (
              <>
                {premadePlans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onPlay={handlePlay}
                    onSave={canSave ? handleSave : undefined}
                    onUnsave={canSave ? handleUnsave : undefined}
                    canSave={canSave}
                  />
                ))}
                {/* Load More Button */}
                {hasMorePremade && (
                  <Pressable
                    onPress={loadMorePremadePlans}
                    disabled={isLoadingPremade}
                    style={{
                      marginTop: 16,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: border,
                      alignItems: 'center',
                      opacity: isLoadingPremade ? 0.6 : 1,
                    }}
                  >
                    {isLoadingPremade ? (
                      <ActivityIndicator size="small" color={primary} />
                    ) : (
                      <Text variant="body" style={{ color: text, fontWeight: '500' }}>
                        Load more
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            ) : (
              // P1-4.4: No premades empty state with calm copy and clear actions
              <View
                style={{
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 24,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text variant="body" style={{ color: text, marginBottom: 8, textAlign: 'center' }}>
                  No plans available right now
                </Text>
                <Text
                  variant="caption"
                  style={{ color: mutedText, marginBottom: 16, textAlign: 'center' }}
                >
                  Create a custom plan in chat, or check back later for new premade plans
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/(home)')}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: border,
                  }}
                >
                  <Text variant="body" style={{ color: text }}>
                    Go to chat
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* P1-5.3: Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
        onUpgrade={() => {
          setShowPaywall(false);
          router.push('/(tabs)/settings');
        }}
        title="Save your favorite plans"
        message="Upgrade to save plans and access them anytime."
      />
    </SafeAreaView>
  );
}
