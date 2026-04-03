import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type {
  ChatMessageRecord,
  CreateChatMessageInput,
} from '../types/chat.types';

interface ChatMessageRow {
  id: string;
  channel: 'global';
  user_id: string;
  nickname_snapshot: string;
  name_snapshot: string;
  avatar_url_snapshot: string | null;
  level_snapshot: number;
  content: string;
  created_at: Date;
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessageRecord {
  return {
    id: row.id,
    channel: row.channel,
    userId: row.user_id,
    nicknameSnapshot: row.nickname_snapshot,
    nameSnapshot: row.name_snapshot,
    avatarUrlSnapshot: row.avatar_url_snapshot,
    levelSnapshot: row.level_snapshot,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class ChatRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async createMessage(
    input: CreateChatMessageInput,
    client?: DatabaseClient,
  ): Promise<ChatMessageRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<ChatMessageRow>(
      `INSERT INTO chat_messages (
         id,
         channel,
         user_id,
         nickname_snapshot,
         name_snapshot,
         avatar_url_snapshot,
         level_snapshot,
         content,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING
         id,
         channel,
         user_id,
         nickname_snapshot,
         name_snapshot,
         avatar_url_snapshot,
         level_snapshot,
         content,
         created_at`,
      [
        randomUUID(),
        input.channel,
        input.userId,
        input.nicknameSnapshot,
        input.nameSnapshot,
        input.avatarUrlSnapshot,
        input.levelSnapshot,
        input.content,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Chat message creation did not return a database row.');
    }

    return mapChatMessageRow(result.rows[0]);
  }

  async listRecentMessages(
    channel: 'global',
    limit: number,
    client?: DatabaseClient,
  ): Promise<ChatMessageRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<ChatMessageRow>(
      `SELECT
         id,
         channel,
         user_id,
         nickname_snapshot,
         name_snapshot,
         avatar_url_snapshot,
         level_snapshot,
         content,
         created_at
       FROM chat_messages
       WHERE channel = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [channel, limit],
    );

    return result.rows.map(mapChatMessageRow);
  }
}
