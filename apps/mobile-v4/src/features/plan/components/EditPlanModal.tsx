/**
 * EditPlanModal Component
 * P1.3: Modal for editing plan affirmations and affirmation count
 */

import { View } from '@/ui/components/view';
import { Text } from '@/ui/components/text';
import { useColor } from '@/ui/hooks/useColor';
import { Modal, ScrollView, TextInput, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import React, { useState, useEffect } from 'react';
import type { PlanPreview } from '../../chat/types';
import type { EntitlementV4 } from '@ab/contracts';
import { updatePlanDraft } from '../api/editApi';
import { PaywallModal } from '@/features/shared/components/PaywallModal';
import { router } from 'expo-router';

interface EditPlanModalProps {
  visible: boolean;
  planPreview: PlanPreview;
  entitlement?: EntitlementV4;
  onClose: () => void;
  onSave: (updatedPlan: PlanPreview) => void;
}

export function EditPlanModal({
  visible,
  planPreview,
  entitlement,
  onClose,
  onSave,
}: EditPlanModalProps) {
  const background = useColor('background');
  const card = useColor('card');
  const text = useColor('text');
  const textMuted = useColor('textMuted');
  const border = useColor('border');
  const primary = useColor('primary');

  const isFree = entitlement?.plan === 'free';
  const allowedCounts = entitlement?.limits.affirmationCountsAllowed || [6];

  // Local state for editing
  const [affirmations, setAffirmations] = useState<string[]>([]);
  const [affirmationCount, setAffirmationCount] = useState<number>(6);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Initialize state when modal opens
  useEffect(() => {
    if (visible) {
      setAffirmations([...planPreview.affirmations]);
      setAffirmationCount(planPreview.affirmations.length);
      setError(null);
    }
  }, [visible, planPreview]);

  const handleAffirmationChange = (index: number, value: string) => {
    const updated = [...affirmations];
    updated[index] = value;
    setAffirmations(updated);
  };

  const handleCountChange = (newCount: number) => {
    // P1-5.3: If free user tries to select paid count, show paywall
    if (isFree && !allowedCounts.includes(newCount)) {
      setShowPaywall(true);
      return;
    }

    setAffirmationCount(newCount);
    
    // Adjust affirmations array to match new count
    const updated = [...affirmations];
    if (newCount > updated.length) {
      // Add empty affirmations
      while (updated.length < newCount) {
        updated.push('');
      }
    } else if (newCount < updated.length) {
      // Remove extra affirmations (from end)
      updated.splice(newCount);
    }
    setAffirmations(updated);
  };

  const handleSave = async () => {
    // Validate that all affirmations have text
    const trimmed = affirmations.map(a => a.trim()).filter(a => a.length > 0);
    if (trimmed.length !== affirmationCount) {
      setError('Please fill in all affirmations');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await updatePlanDraft(planPreview.planDraftId, {
        affirmations: trimmed,
        affirmationCount,
      });

      onSave({
        ...planPreview,
        affirmations: response.planDraft.affirmations,
      });

      onClose();
    } catch (err) {
      console.error('[EditPlanModal] Failed to save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
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
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
        />
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
              Edit Affirmations
            </Text>
            {isFree && (
              <Text style={{ fontSize: 13, color: textMuted }}>
                (edits won't be saved)
              </Text>
            )}
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Affirmation Count Selector (Paid only, or if multiple counts allowed) */}
            {allowedCounts.length > 1 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginBottom: 12 }}>
                  Number of Affirmations
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {allowedCounts.map((count) => (
                    <Pressable
                      key={count}
                      onPress={() => handleCountChange(count)}
                      style={({ pressed }) => [
                        {
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: affirmationCount === count ? primary : border,
                          backgroundColor: affirmationCount === count ? primary + '20' : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                        } as ViewStyle,
                      ]}
                    >
                      <Text
                        style={{
                          color: affirmationCount === count ? primary : text,
                          fontWeight: affirmationCount === count ? '600' : '400',
                          fontSize: 15,
                        }}
                      >
                        {count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Affirmations List */}
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>
                Affirmations ({affirmationCount})
              </Text>
              {affirmations.slice(0, affirmationCount).map((affirmation, index) => (
                <View key={index} style={{ gap: 8 }}>
                  <Text style={{ fontSize: 14, color: textMuted }}>
                    {index + 1}.
                  </Text>
                  <TextInput
                    value={affirmation}
                    onChangeText={(value) => handleAffirmationChange(index, value)}
                    placeholder={`Affirmation ${index + 1}`}
                    placeholderTextColor={textMuted + '99'}
                    multiline
                    style={{
                      fontSize: 15,
                      color: text,
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: border,
                      backgroundColor: background,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>
              ))}
            </View>

            {/* Error Message */}
            {error && (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: primary + '20',
                  borderWidth: 1,
                  borderColor: primary,
                }}
              >
                <Text style={{ color: primary, fontSize: 14 }}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={{
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: border,
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Pressable
              onPress={onClose}
              disabled={isSaving}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: border,
                  alignItems: 'center',
                  opacity: pressed || isSaving ? 0.7 : 1,
                } as ViewStyle,
              ]}
            >
              <Text style={{ color: text, fontSize: 16, fontWeight: '500' }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={isSaving}
              style={({ pressed }) => [
                {
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  backgroundColor: primary,
                  alignItems: 'center',
                  opacity: pressed || isSaving ? 0.7 : 1,
                } as ViewStyle,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* P1-5.3: Paywall Modal for paid features */}
      <PaywallModal
        visible={showPaywall}
        onDismiss={() => setShowPaywall(false)}
        onUpgrade={() => {
          setShowPaywall(false);
          router.push('/(tabs)/settings');
        }}
        title="Unlock more affirmations"
        message="Choose 12, 18, or 24 affirmations with a paid plan."
      />
    </Modal>
  );
}
