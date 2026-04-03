import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type { DeckCardRecord, DeckRecord } from '../types/cards.types';

interface DeckRow {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DeckCardRow {
  id: string;
  deck_id: string;
  character_id: string;
  position: number;
  created_at: Date;
  updated_at: Date;
}

function mapDeckRow(row: DeckRow): DeckRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDeckCardRow(row: DeckCardRow): DeckCardRecord {
  return {
    id: row.id,
    deckId: row.deck_id,
    characterId: row.character_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DeckRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async findActiveByUserId(
    userId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<DeckRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<DeckRow>(
      `SELECT id, user_id, name, is_active, created_at, updated_at
       FROM decks
       WHERE user_id = $1
         AND is_active = TRUE
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [userId],
    );

    return result.rows[0] ? mapDeckRow(result.rows[0]) : null;
  }

  async createActiveDeck(
    input: {
      name: string;
      userId: string;
    },
    client?: DatabaseClient,
  ): Promise<DeckRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<DeckRow>(
      `INSERT INTO decks (
         id,
         user_id,
         name,
         is_active,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())
       RETURNING id, user_id, name, is_active, created_at, updated_at`,
      [randomUUID(), input.userId, input.name],
    );

    if (!result.rows[0]) {
      throw new Error('Deck creation did not return a database row.');
    }

    return mapDeckRow(result.rows[0]);
  }

  async listCards(deckId: string, client?: DatabaseClient): Promise<DeckCardRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<DeckCardRow>(
      `SELECT id, deck_id, character_id, position, created_at, updated_at
       FROM deck_cards
       WHERE deck_id = $1
       ORDER BY position ASC`,
      [deckId],
    );

    return result.rows.map(mapDeckCardRow);
  }

  async replaceCards(deckId: string, characterIds: string[], client?: DatabaseClient): Promise<void> {
    const executor = client ?? this.database;
    await executor.query('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);

    for (const [index, characterId] of characterIds.entries()) {
      await executor.query(
        `INSERT INTO deck_cards (
           id,
           deck_id,
           character_id,
           position,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [randomUUID(), deckId, characterId, index + 1],
      );
    }
  }

  async touchDeck(deckId: string, client?: DatabaseClient): Promise<DeckRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<DeckRow>(
      `UPDATE decks
       SET updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, name, is_active, created_at, updated_at`,
      [deckId],
    );

    if (!result.rows[0]) {
      throw new Error('Deck update did not return a database row.');
    }

    return mapDeckRow(result.rows[0]);
  }
}
