/**
 * Settings Screen
 * P0-4: Real settings route to fix upgrade dead ends
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { SafeAreaView, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Check, X, ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { apiClient } from '@/services/apiClient';

interface EntitlementResponse {
  plan: 'free' | 'pro';
  limits: {
    maxSessionDurationMs: number | 'unlimited';
    maxPlansPerDay?: number;
    maxRerollsPerPlan?: number;
  };
}

export default function SettingsScreen() {
  const background = useColor('background');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const card = useColor('card');
  const border = useColor('border');
  const primary = useColor('primary');
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEntitlement = async () => {
      try {
        const response = await apiClient.get<EntitlementResponse>('/v4/me/entitlement');
        setEntitlement(response);
      } catch (err) {
        console.error('[SettingsScreen] Failed to fetch entitlement:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntitlement();
  }, []);

  const handleUpgrade = () => {
    // P0-4: For now, show a clear message that upgrade is not available in this build
    // In production, this would open the purchase flow
    Alert.alert(
      'Upgrade to Pro',
      'Upgrade functionality is not available in this build. Check back soon for Pro features!',
      [
        {
          text: 'Learn More',
          onPress: () => router.push('/learn/affirmation-science'),
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ]
    );
  };

  const isPro = entitlement?.plan === 'pro';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ marginRight: 16, padding: 4 }}
          >
            <ArrowLeft size={24} color={text} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: '600', color: text }}>
            Settings
          </Text>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={primary} />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Plan Status */}
            <View
              style={{
                backgroundColor: card,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginBottom: 8 }}>
                Your Plan
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '700',
                    color: isPro ? primary : text,
                    marginRight: 8,
                  }}
                >
                  {isPro ? 'Pro' : 'Free'}
                </Text>
                {isPro && (
                  <View
                    style={{
                      backgroundColor: primary + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: primary }}>
                      ACTIVE
                    </Text>
                  </View>
                )}
              </View>

              {!isPro && (
                <Pressable
                  onPress={handleUpgrade}
                  style={{
                    backgroundColor: primary,
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                    Upgrade to Pro
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Features */}
            <View
              style={{
                backgroundColor: card,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginBottom: 16 }}>
                {isPro ? 'Pro Features' : 'What Pro Unlocks'}
              </Text>

              {[
                {
                  feature: 'Unlimited session time',
                  free: typeof entitlement?.limits.maxSessionDurationMs === 'number',
                  pro: true,
                },
                {
                  feature: 'Save your favorite plans',
                  free: false,
                  pro: true,
                },
                {
                  feature: 'Custom voice selection',
                  free: false,
                  pro: true,
                },
                {
                  feature: 'Choose brain tracks',
                  free: false,
                  pro: true,
                },
                {
                  feature: 'Custom background sounds',
                  free: false,
                  pro: true,
                },
                {
                  feature: 'More affirmations per plan',
                  free: false,
                  pro: true,
                },
              ].map((item, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: index < 5 ? 1 : 0,
                    borderBottomColor: border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: text }}>{item.feature}</Text>
                  </View>
                  {isPro ? (
                    <Check size={20} color={primary} />
                  ) : (
                    <X size={20} color={textMuted} />
                  )}
                </View>
              ))}
            </View>

            {/* Current Limits (Free users) */}
            {!isPro && entitlement && (
              <View
                style={{
                  backgroundColor: card,
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: border,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600', color: text, marginBottom: 16 }}>
                  Current Limits
                </Text>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, color: textMuted, marginBottom: 4 }}>
                    Session Duration
                  </Text>
                  <Text style={{ fontSize: 16, color: text }}>
                    {typeof entitlement.limits.maxSessionDurationMs === 'number'
                      ? `${Math.floor(entitlement.limits.maxSessionDurationMs / 60000)} minutes`
                      : 'Unlimited'}
                  </Text>
                </View>
                {entitlement.limits.maxRerollsPerPlan !== undefined && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 14, color: textMuted, marginBottom: 4 }}>
                      Regenerations per Plan
                    </Text>
                    <Text style={{ fontSize: 16, color: text }}>
                      {entitlement.limits.maxRerollsPerPlan} times
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Learn More */}
            <Pressable
              onPress={() => router.push('/learn/affirmation-science')}
              style={{
                backgroundColor: card,
                borderRadius: 12,
                padding: 20,
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: primary, textAlign: 'center' }}>
                Learn How It Works
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
