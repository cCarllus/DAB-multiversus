import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type {
  CreateNotificationInput,
  NotificationRecord,
} from '../types/notifications.types';

interface NotificationRow {
  id: string;
  user_id: string;
  type: CreateNotificationInput['type'];
  category: CreateNotificationInput['category'];
  title: string;
  message: string;
  metadata_json: Record<string, unknown> | null;
  is_read: boolean;
  created_at: Date;
  read_at: Date | null;
}

interface CountRow {
  count: string;
}

function mapNotificationRow(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category,
    title: row.title,
    message: row.message,
    metadataJson: row.metadata_json,
    isRead: row.is_read,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export class NotificationsRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async create(
    userId: string,
    input: CreateNotificationInput,
    client?: DatabaseClient,
  ): Promise<NotificationRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<NotificationRow>(
      `INSERT INTO notifications (
         id,
         user_id,
         type,
         category,
         title,
         message,
         metadata_json,
         is_read,
         created_at,
         read_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW(), NULL)
       RETURNING
         id,
         user_id,
         type,
         category,
         title,
         message,
         metadata_json,
         is_read,
         created_at,
         read_at`,
      [
        randomUUID(),
        userId,
        input.type,
        input.category,
        input.title,
        input.message,
        input.metadataJson ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Notification creation did not return a database row.');
    }

    return mapNotificationRow(result.rows[0]);
  }

  async listForUser(userId: string, limit: number, client?: DatabaseClient): Promise<NotificationRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<NotificationRow>(
      `SELECT
         id,
         user_id,
         type,
         category,
         title,
         message,
         metadata_json,
         is_read,
         created_at,
         read_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows.map(mapNotificationRow);
  }

  async countForUser(userId: string, client?: DatabaseClient): Promise<number> {
    const executor = client ?? this.database;
    const result = await executor.query<CountRow>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1`,
      [userId],
    );

    return Number(result.rows[0]?.count ?? '0');
  }

  async countUnread(userId: string, client?: DatabaseClient): Promise<number> {
    const executor = client ?? this.database;
    const result = await executor.query<CountRow>(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = $1
       AND is_read = FALSE`,
      [userId],
    );

    return Number(result.rows[0]?.count ?? '0');
  }

  async markRead(
    userId: string,
    notificationId: string,
    client?: DatabaseClient,
  ): Promise<NotificationRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<NotificationRow>(
      `UPDATE notifications
       SET
         is_read = TRUE,
         read_at = COALESCE(read_at, NOW())
       WHERE id = $1
       AND user_id = $2
       RETURNING
         id,
         user_id,
         type,
         category,
         title,
         message,
         metadata_json,
         is_read,
         created_at,
         read_at`,
      [notificationId, userId],
    );

    return result.rows[0] ? mapNotificationRow(result.rows[0]) : null;
  }

  async markAllRead(userId: string, client?: DatabaseClient): Promise<void> {
    const executor = client ?? this.database;
    await executor.query(
      `UPDATE notifications
       SET
         is_read = TRUE,
         read_at = COALESCE(read_at, NOW())
       WHERE user_id = $1
       AND is_read = FALSE`,
      [userId],
    );
  }
}
