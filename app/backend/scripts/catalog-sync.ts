import { closeDatabase, initializeDatabase } from '../lib/postgres';
import { CharactersRepository } from '../repositories/characters.repository';
import { UserCharactersRepository } from '../repositories/user-characters.repository';
import { UsersRepository } from '../repositories/users.repository';
import { CatalogSyncService } from '../services/catalog-sync.service';

async function main(): Promise<void> {
  const hardDelete = process.argv.includes('--hard-delete');

  await initializeDatabase();

  const syncService = new CatalogSyncService(new CharactersRepository(), {
    userCharactersRepository: new UserCharactersRepository(),
    usersRepository: new UsersRepository(),
  });
  const result = await syncService.syncCatalog({
    hardDelete,
    logger: console,
  });

  console.info(
    `[catalog:sync] completed | seed=${result.totalSeedEntries} inserted=${result.inserted} updated=${result.updated} deactivated=${result.deactivated} hardDeleted=${result.hardDeleted} defaultOwnershipsEnsured=${result.defaultOwnershipsEnsured}`,
  );
}

main()
  .catch((error) => {
    console.error('[catalog:sync] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
