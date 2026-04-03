export interface ChatMessageRecord {
  id: string;
  channel: 'global';
  userId: string;
  nicknameSnapshot: string;
  nameSnapshot: string;
  avatarUrlSnapshot: string | null;
  levelSnapshot: number;
  content: string;
  createdAt: Date;
}

export interface CreateChatMessageInput {
  channel: 'global';
  userId: string;
  nicknameSnapshot: string;
  nameSnapshot: string;
  avatarUrlSnapshot: string | null;
  levelSnapshot: number;
  content: string;
}
