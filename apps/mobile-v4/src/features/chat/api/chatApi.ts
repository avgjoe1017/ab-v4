import { apiClient } from '@/services/apiClient';
import type { ChatTurnV4, ChatTurnResponseV4 } from '@ab/contracts';

/**
 * Process a chat turn
 */
export async function processChatTurn(
  turn: ChatTurnV4
): Promise<ChatTurnResponseV4> {
  return apiClient.post<ChatTurnResponseV4>('/v4/chat/turn', turn);
}
