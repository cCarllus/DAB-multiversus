import { normalizeUsersProfileMigration } from './migrations/normalize-users-profile';
import { applyCoreSchema } from './schema/core-schema';
import type { DatabaseQueryable } from './types';

export async function initializeDatabaseSchema(client: DatabaseQueryable): Promise<void> {
  await applyCoreSchema(client);
  await normalizeUsersProfileMigration(client);
}
