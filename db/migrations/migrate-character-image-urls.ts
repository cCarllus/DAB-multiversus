import type { DatabaseQueryable } from '../types';

export async function migrateCharacterImageUrlsMigration(
  client: DatabaseQueryable,
): Promise<void> {
  await client.query(`
    UPDATE characters
    SET image_url = REPLACE(image_url, '/uploads/characters/', '/assets/game/characters/')
    WHERE image_url LIKE '/uploads/characters/%'
  `);
}
