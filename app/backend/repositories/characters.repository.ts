import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type {
  CharacterRecord,
  UpsertCharacterCatalogInput,
} from '../types/cards.types';

interface CharacterRow {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  short_lore: string;
  full_lore: string;
  image_url: string | null;
  rarity: CharacterRecord['rarity'];
  category: CharacterRecord['category'];
  cost_mana: number;
  unlock_price_shards: number;
  is_active: boolean;
  is_default_unlocked: boolean;
  release_order: number;
  created_at: Date;
  updated_at: Date;
}

function mapCharacterRow(row: CharacterRow): CharacterRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    shortLore: row.short_lore,
    fullLore: row.full_lore,
    imageUrl: row.image_url,
    rarity: row.rarity,
    category: row.category,
    costMana: row.cost_mana,
    unlockPriceShards: row.unlock_price_shards,
    isActive: row.is_active,
    isDefaultUnlocked: row.is_default_unlocked,
    releaseOrder: row.release_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharactersRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async upsertCatalogEntry(
    input: UpsertCharacterCatalogInput,
    client?: DatabaseClient,
  ): Promise<CharacterRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `INSERT INTO characters (
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
       )
       ON CONFLICT (slug) DO UPDATE
       SET
         name = EXCLUDED.name,
         short_description = EXCLUDED.short_description,
         short_lore = EXCLUDED.short_lore,
         full_lore = EXCLUDED.full_lore,
         image_url = EXCLUDED.image_url,
         rarity = EXCLUDED.rarity,
         category = EXCLUDED.category,
         cost_mana = EXCLUDED.cost_mana,
         unlock_price_shards = EXCLUDED.unlock_price_shards,
         is_active = EXCLUDED.is_active,
         is_default_unlocked = EXCLUDED.is_default_unlocked,
         release_order = EXCLUDED.release_order,
         updated_at = NOW()
       RETURNING
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at`,
      [
        randomUUID(),
        input.name,
        input.slug,
        input.shortDescription,
        input.shortLore,
        input.fullLore,
        input.imageUrl,
        input.rarity,
        input.category,
        input.costMana,
        input.unlockPriceShards,
        input.isActive,
        input.isDefaultUnlocked,
        input.releaseOrder,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Character catalog upsert did not return a database row.');
    }

    return mapCharacterRow(result.rows[0]);
  }

  async listAll(client?: DatabaseClient): Promise<CharacterRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `SELECT
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       FROM characters
       ORDER BY is_active DESC, release_order ASC, created_at ASC`,
    );

    return result.rows.map(mapCharacterRow);
  }

  async listByIds(characterIds: string[], client?: DatabaseClient): Promise<CharacterRecord[]> {
    if (characterIds.length === 0) {
      return [];
    }

    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `SELECT
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       FROM characters
       WHERE id = ANY($1::uuid[])`,
      [characterIds],
    );

    return result.rows.map(mapCharacterRow);
  }

  async listDefaultUnlocked(client?: DatabaseClient): Promise<CharacterRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `SELECT
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       FROM characters
       WHERE is_default_unlocked = TRUE
         AND is_active = TRUE
       ORDER BY release_order ASC, created_at ASC`,
    );

    return result.rows.map(mapCharacterRow);
  }

  async findById(
    characterId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<CharacterRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `SELECT
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       FROM characters
       WHERE id = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [characterId],
    );

    return result.rows[0] ? mapCharacterRow(result.rows[0]) : null;
  }

  async findBySlug(slug: string, client?: DatabaseClient): Promise<CharacterRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<CharacterRow>(
      `SELECT
         id,
         name,
         slug,
         short_description,
         short_lore,
         full_lore,
         image_url,
         rarity,
         category,
         cost_mana,
         unlock_price_shards,
         is_active,
         is_default_unlocked,
         release_order,
         created_at,
         updated_at
       FROM characters
       WHERE slug = $1
       LIMIT 1`,
      [slug],
    );

    return result.rows[0] ? mapCharacterRow(result.rows[0]) : null;
  }
}
