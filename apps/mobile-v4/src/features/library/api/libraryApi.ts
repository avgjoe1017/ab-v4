/**
 * Library API - Fetch premade and saved plans
 */

import { apiClient } from '@/services/apiClient';
import type { PlanV4 } from '@ab/contracts';

export interface PremadePlansResponse {
  plans: PlanV4[];
  limit: number;
  cursor: string | null; // Next cursor for pagination (ISO datetime)
  hasMore: boolean;
}

export interface SavedPlansResponse {
  plans: PlanV4[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function fetchPremadePlans(
  limit: number = 20,
  cursor?: string | null
): Promise<PremadePlansResponse> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (cursor) {
    params.append('cursor', cursor);
  }
  return apiClient.get<PremadePlansResponse>(
    `/v4/library/premade?${params.toString()}`
  );
}

export async function fetchSavedPlans(
  limit: number = 20,
  offset: number = 0
): Promise<SavedPlansResponse> {
  return apiClient.get<SavedPlansResponse>(
    `/v4/library/saved?limit=${limit}&offset=${offset}`
  );
}

export async function savePlan(planId: string): Promise<{ success: boolean; planId: string; alreadySaved?: boolean }> {
  return apiClient.post<{ success: boolean; planId: string; alreadySaved?: boolean }>(
    `/v4/library/save/${planId}`,
    {}
  );
}

export async function unsavePlan(planId: string): Promise<{ success: boolean; planId: string }> {
  return apiClient.delete<{ success: boolean; planId: string }>(
    `/v4/library/save/${planId}`
  );
}
