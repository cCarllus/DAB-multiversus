import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type { ProgressionRecord } from '../types/progression.types';

interface ProgressionRow {
  id: string;
  user_id: string;
  level: number;
  xp: number;
  created_at: Date;
  updated_at: Date;
}

function mapProgressionRow(row: ProgressionRow): ProgressionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    level: row.level,
    xp: row.xp,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProgressionRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async findByUserId(
    userId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<ProgressionRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<ProgressionRow>(
      `SELECT id, user_id, level, xp, created_at, updated_at
       FROM player_progression
       WHERE user_id = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [userId],
    );

    return result.rows[0] ? mapProgressionRow(result.rows[0]) : null;
  }

  async createDefault(userId: string, client?: DatabaseClient): Promise<ProgressionRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<ProgressionRow>(
      `INSERT INTO player_progression (id, user_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, user_id, level, xp, created_at, updated_at`,
      [randomUUID(), userId],
    );

    if (result.rows[0]) {
      return mapProgressionRow(result.rows[0]);
    }

    const existing = await this.findByUserId(userId, client);

    if (!existing) {
      throw new Error('Progression creation did not return a database row.');
    }

    return existing;
  }

  async updateProgression(
    userId: string,
    input: { level: number; xp: number },
    client?: DatabaseClient,
  ): Promise<ProgressionRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<ProgressionRow>(
      `UPDATE player_progression
       SET level = $2, xp = $3, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, user_id, level, xp, created_at, updated_at`,
      [userId, input.level, input.xp],
    );

    if (!result.rows[0]) {
      throw new Error('Progression update did not return a database row.');
    }

    return mapProgressionRow(result.rows[0]);
  }
}
