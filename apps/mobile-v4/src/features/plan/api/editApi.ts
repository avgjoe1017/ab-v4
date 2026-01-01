/**
 * Plan Edit API
 * P1.3: API functions for editing plan drafts
 */

import { apiClient } from '@/services/apiClient';

export interface UpdatePlanDraftRequest {
  affirmations?: string[];
  affirmationCount?: number;
  title?: string;
}

export interface UpdatePlanDraftResponse {
  success: boolean;
  planDraft: {
    id: string;
    title: string;
    affirmations: string[];
    affirmationCount: number;
  };
}

/**
 * Update a plan draft with edited affirmations or affirmation count
 */
export async function updatePlanDraft(
  planDraftId: string,
  updates: UpdatePlanDraftRequest
): Promise<UpdatePlanDraftResponse> {
  return apiClient.patch<UpdatePlanDraftResponse>(
    `/v4/plans/draft/${planDraftId}`,
    updates
  );
}
