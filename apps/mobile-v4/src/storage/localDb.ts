/**
 * Local storage for saved local-only stuff
 * - Recent plays
 * - Draft cache
 * TODO: Implement using AsyncStorage or similar
 */

export interface RecentPlay {
  planId: string;
  playedAt: Date;
}

export interface DraftCache {
  threadId?: string;
  messages?: unknown[];
  planDraft?: unknown;
}

class LocalDb {
  // TODO: Implement AsyncStorage methods
  async getRecentPlays(): Promise<RecentPlay[]> {
    return [];
  }

  async saveRecentPlay(play: RecentPlay): Promise<void> {
    // TODO: Save to AsyncStorage
  }

  async getDraftCache(): Promise<DraftCache | null> {
    return null;
  }

  async saveDraftCache(draft: DraftCache): Promise<void> {
    // TODO: Save to AsyncStorage
  }

  async clearDraftCache(): Promise<void> {
    // TODO: Clear from AsyncStorage
  }
}

export const localDb = new LocalDb();
