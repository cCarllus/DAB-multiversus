import type { GlobalChatMessage } from '@shared/contracts/chat.contract';

export type { GlobalChatMessage };

export interface ChatSnapshot {
  connectedUsers: number;
  isConnected: boolean;
  isLoading: boolean;
  lastError: string | null;
  messages: GlobalChatMessage[];
}
