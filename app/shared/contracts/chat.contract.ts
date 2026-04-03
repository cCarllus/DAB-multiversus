export const GLOBAL_CHAT_CHANNEL = 'global';
export const GLOBAL_CHAT_ROOM_NAME = 'global_chat';
export const GLOBAL_CHAT_SEND_MESSAGE = 'chat:send';
export const GLOBAL_CHAT_MESSAGE_BROADCAST = 'chat:message';
export const GLOBAL_CHAT_PRESENCE_MESSAGE = 'chat:presence';
export const GLOBAL_CHAT_ERROR_MESSAGE = 'chat:error';

export interface GlobalChatSender {
  avatarUrl: string | null;
  level: number;
  name: string;
  nickname: string;
  userId: string;
}

export interface GlobalChatMessage {
  id: string;
  channel: typeof GLOBAL_CHAT_CHANNEL;
  content: string;
  createdAt: string;
  sender: GlobalChatSender;
}

export interface GlobalChatHistoryResponse {
  channel: typeof GLOBAL_CHAT_CHANNEL;
  messages: GlobalChatMessage[];
}

export interface GlobalChatPresence {
  connectedUsers: number;
}
