import type { DatabaseQueryable } from '../types';

const coreSchemaStatements = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      nickname TEXT NOT NULL DEFAULT '',
      profile_image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      remember_device BOOLEAN NOT NULL DEFAULT FALSE,
      device_name TEXT,
      app_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
      ON auth_sessions (user_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
      ON auth_sessions (expires_at)
  `,
  `
    CREATE TABLE IF NOT EXISTS user_devices (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      os_name TEXT NOT NULL,
      os_version TEXT,
      app_version TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_devices_user_device_unique UNIQUE (user_id, device_id)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS user_devices_user_id_idx
      ON user_devices (user_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS user_devices_last_login_idx
      ON user_devices (user_id, last_login_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS friendships (
      id UUID PRIMARY KEY,
      requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT friendships_users_distinct CHECK (requester_user_id <> addressee_user_id),
      CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked'))
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS friendships_active_pair_unique_idx
      ON friendships (
        LEAST(requester_user_id, addressee_user_id),
        GREATEST(requester_user_id, addressee_user_id)
      )
      WHERE status IN ('pending', 'accepted', 'blocked')
  `,
  `
    CREATE INDEX IF NOT EXISTS friendships_requester_status_idx
      ON friendships (requester_user_id, status, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx
      ON friendships (addressee_user_id, status, created_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'offline',
      current_activity TEXT,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT user_presence_status_check CHECK (status IN ('online', 'offline', 'in_launcher'))
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS user_presence_status_idx
      ON user_presence (status, updated_at DESC)
  `,
] as const;

export async function applyCoreSchema(client: DatabaseQueryable): Promise<void> {
  for (const statement of coreSchemaStatements) {
    await client.query(statement);
  }
}
