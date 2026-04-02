import type { DatabaseQueryable } from '../types';

export async function normalizeUserPresenceStatusesMigration(
  client: DatabaseQueryable,
): Promise<void> {
  await client.query(`
    UPDATE user_presence
    SET
      status = CASE
        WHEN status IN ('in_match', 'away') THEN 'online'
        ELSE status
      END,
      updated_at = NOW()
    WHERE status IN ('in_match', 'away')
  `);

  await client.query(`
    ALTER TABLE IF EXISTS user_presence
    DROP CONSTRAINT IF EXISTS user_presence_status_check
  `);

  await client.query(`
    ALTER TABLE IF EXISTS user_presence
    ADD CONSTRAINT user_presence_status_check
    CHECK (status IN ('online', 'offline', 'in_launcher'))
  `);
}
