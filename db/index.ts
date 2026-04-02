import { normalizeUsersProfileMigration } from './migrations/normalize-users-profile';
import { normalizeUserPresenceStatusesMigration } from './migrations/normalize-user-presence-statuses';
import { applyCoreSchema } from './schema/core-schema';
import type { DatabaseQueryable } from './types';

export async function initializeDatabaseSchema(client: DatabaseQueryable): Promise<void> {
  await applyCoreSchema(client);
  await normalizeUsersProfileMigration(client);
  await normalizeUserPresenceStatusesMigration(client);
}
