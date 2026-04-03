import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type { UserCharacterRecord } from '../types/cards.types';

interface UserCharacterRow {
  id: string;
  user_id: string;
  character_id: string;
  level: number;
  unlocked_at: Date;
  created_at: Date;
  updated_at: Date;
}

function mapUserCharacterRow(row: UserCharacterRow): UserCharacterRecord {
  return {
    id: row.id,
    userId: row.user_id,
    characterId: row.character_id,
    level: row.level,
    unlockedAt: row.unlocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserCharactersRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async listByUserId(userId: string, client?: DatabaseClient): Promise<UserCharacterRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<UserCharacterRow>(
      `SELECT id, user_id, character_id, level, unlocked_at, created_at, updated_at
       FROM user_characters
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId],
    );

    return result.rows.map(mapUserCharacterRow);
  }

  async findByUserAndCharacter(
    userId: string,
    characterId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<UserCharacterRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserCharacterRow>(
      `SELECT id, user_id, character_id, level, unlocked_at, created_at, updated_at
       FROM user_characters
       WHERE user_id = $1
         AND character_id = $2
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [userId, characterId],
    );

    return result.rows[0] ? mapUserCharacterRow(result.rows[0]) : null;
  }

  async createOwnership(
    input: {
      characterId: string;
      level?: number;
      userId: string;
    },
    client?: DatabaseClient,
  ): Promise<UserCharacterRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<UserCharacterRow>(
      `INSERT INTO user_characters (
         id,
         user_id,
         character_id,
         level,
         unlocked_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       RETURNING id, user_id, character_id, level, unlocked_at, created_at, updated_at`,
      [randomUUID(), input.userId, input.characterId, input.level ?? 1],
    );

    if (!result.rows[0]) {
      throw new Error('User character creation did not return a database row.');
    }

    return mapUserCharacterRow(result.rows[0]);
  }

  async ensureOwnerships(
    userId: string,
    characterIds: string[],
    client?: DatabaseClient,
  ): Promise<void> {
    if (characterIds.length === 0) {
      return;
    }

    const executor = client ?? this.database;

    for (const characterId of characterIds) {
      await executor.query(
        `INSERT INTO user_characters (
           id,
           user_id,
           character_id,
           level,
           unlocked_at,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, 1, NOW(), NOW(), NOW())
         ON CONFLICT (user_id, character_id) DO NOTHING`,
        [randomUUID(), userId, characterId],
      );
    }
  }
}
