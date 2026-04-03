import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type { GlobalChatHistoryResponse } from '@shared/contracts/chat.contract';

const CHAT_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_CHAT_ERROR',
  failureMessage: 'Chat request failed.',
  networkMessage: 'The launcher could not reach the chat service.',
} as const;

export class ChatApiClient extends BackendApiClient {
  async getGlobalHistory(accessToken: string, limit = 40): Promise<GlobalChatHistoryResponse> {
    const search = new URLSearchParams({
      limit: String(limit),
    });

    return this.request<GlobalChatHistoryResponse>(
      `/chat/global/history?${search.toString()}`,
      {
        accessToken,
        method: 'GET',
      },
      CHAT_REQUEST_MESSAGES,
    );
  }
}
