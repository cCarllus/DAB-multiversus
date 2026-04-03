import type { DatabaseQueryable } from '../types';

const platformSchemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS player_progression (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT player_progression_level_check CHECK (level >= 1),
      CONSTRAINT player_progression_xp_check CHECK (xp >= 0)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS player_progression_user_id_idx
      ON player_progression (user_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS player_wallet (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      shards INTEGER NOT NULL DEFAULT 500,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT player_wallet_shards_check CHECK (shards >= 0)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS player_wallet_user_id_idx
      ON player_wallet (user_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      currency_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      direction TEXT NOT NULL,
      reason TEXT NOT NULL,
      metadata_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT wallet_transactions_currency_type_check CHECK (currency_type IN ('shards')),
      CONSTRAINT wallet_transactions_amount_check CHECK (amount > 0),
      CONSTRAINT wallet_transactions_direction_check CHECK (direction IN ('credit', 'debit'))
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_created_at_idx
      ON wallet_transactions (user_id, created_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json JSONB,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      CONSTRAINT notifications_type_check
        CHECK (type IN ('info', 'success', 'warning', 'error', 'social', 'reward', 'system')),
      CONSTRAINT notifications_category_check
        CHECK (
          category IN ('social', 'progression', 'economy', 'launcher', 'account', 'system', 'event')
        )
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
      ON notifications (user_id, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
      ON notifications (user_id, is_read, created_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS characters (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_description TEXT NOT NULL,
      short_lore TEXT NOT NULL,
      full_lore TEXT NOT NULL,
      image_url TEXT,
      rarity TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_mana INTEGER NOT NULL,
      unlock_price_shards INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      is_default_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
      release_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT characters_rarity_check CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
      CONSTRAINT characters_cost_mana_check CHECK (cost_mana >= 0),
      CONSTRAINT characters_unlock_price_shards_check CHECK (unlock_price_shards >= 0),
      CONSTRAINT characters_release_order_check CHECK (release_order >= 0)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS characters_is_active_release_order_idx
      ON characters (is_active DESC, release_order ASC, created_at ASC)
  `,
  `
    CREATE TABLE IF NOT EXISTS user_characters (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      level INTEGER NOT NULL DEFAULT 1,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_characters_level_check CHECK (level >= 1),
      CONSTRAINT user_characters_user_character_unique UNIQUE (user_id, character_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS user_characters_user_id_idx
      ON user_characters (user_id, created_at ASC)
  `,
  `
    CREATE INDEX IF NOT EXISTS user_characters_character_id_idx
      ON user_characters (character_id, user_id)
  `,
  `
    CREATE TABLE IF NOT EXISTS decks (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS decks_user_active_unique_idx
      ON decks (user_id)
      WHERE is_active = TRUE
  `,
  `
    CREATE INDEX IF NOT EXISTS decks_user_id_idx
      ON decks (user_id, updated_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS deck_cards (
      id UUID PRIMARY KEY,
      deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT deck_cards_position_check CHECK (position >= 1 AND position <= 8),
      CONSTRAINT deck_cards_deck_position_unique UNIQUE (deck_id, position),
      CONSTRAINT deck_cards_deck_character_unique UNIQUE (deck_id, character_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS deck_cards_deck_id_position_idx
      ON deck_cards (deck_id, position ASC)
  `,
  `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY,
      channel TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nickname_snapshot TEXT NOT NULL,
      name_snapshot TEXT NOT NULL,
      avatar_url_snapshot TEXT,
      level_snapshot INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chat_messages_channel_check CHECK (channel = 'global'),
      CONSTRAINT chat_messages_content_check CHECK (char_length(content) > 0 AND char_length(content) <= 320)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS chat_messages_channel_created_at_idx
      ON chat_messages (channel, created_at DESC)
  `,
] as const;

export async function applyPlatformSchema(client: DatabaseQueryable): Promise<void> {
  for (const statement of platformSchemaStatements) {
    await client.query(statement);
  }
}
