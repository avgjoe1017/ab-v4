import type { ChatTurnResponseV4 } from '@ab/contracts';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface PlanPreview {
  planDraftId: string;
  title: string;
  affirmations: string[];
  intent?: string;
}

export interface ChatTurnState {
  threadId?: string;
  messages: ChatMessage[];
  planPreview?: PlanPreview;
  suggestedChips?: Array<{ id: string; text: string }>;
}
