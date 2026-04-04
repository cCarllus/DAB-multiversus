import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postgresState = vi.hoisted(() => ({
  client: {
    query: vi.fn(),
  },
  dbPool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(
    async (handler: (client: typeof postgresState.client) => Promise<unknown>) =>
      handler(postgresState.client),
  ),
}));

vi.mock('../../app/backend/lib/postgres', () => ({
  dbPool: postgresState.dbPool,
  withTransaction: postgresState.withTransaction,
}));

import { CatalogSyncService } from '../../app/backend/services/catalog-sync.service';
import { createCharacterRecord } from './helpers/player-platform.fixtures';

describe('backend catalog sync service', () => {
  beforeEach(() => {
    postgresState.withTransaction.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inserts new characters from the seed', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => []),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(async () => createCharacterRecord()),
      markMissingEntriesInactive: vi.fn(async () => 0),
      hardDeleteMissingEntries: vi.fn(async () => 0),
    };
    const service = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'New Hero',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'new-hero',
        unlockPriceShards: 100,
      },
      ],
    });

    const result = await service.syncCatalog();

    expect(result).toMatchObject({
      defaultOwnershipsEnsured: 0,
      deactivated: 0,
      hardDeleted: 0,
      inserted: 1,
      totalSeedEntries: 1,
      updated: 0,
    });
    expect(charactersRepository.upsertCatalogEntry).toHaveBeenCalledTimes(1);
    expect(charactersRepository.markMissingEntriesInactive).toHaveBeenCalledWith(
      ['new-hero'],
      postgresState.client,
    );
  });

  it('updates existing characters from the seed', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => [
        createCharacterRecord({
          slug: 'existing-hero',
        }),
      ]),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(async () => createCharacterRecord()),
      markMissingEntriesInactive: vi.fn(async () => 0),
      hardDeleteMissingEntries: vi.fn(async () => 0),
    };
    const service = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 6,
        fullLore: 'Updated lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Existing Hero',
        rarity: 'legendary',
        releaseOrder: 3,
        shortDescription: 'Updated',
        shortLore: 'Updated lore',
        slug: 'existing-hero',
        unlockPriceShards: 300,
      },
      ],
    });

    const result = await service.syncCatalog();

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  it('marks characters missing from the seed as inactive by default', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => [
        createCharacterRecord({ slug: 'existing-hero' }),
        createCharacterRecord({ slug: 'removed-hero' }),
      ]),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(async () => createCharacterRecord()),
      markMissingEntriesInactive: vi.fn(async () => 1),
      hardDeleteMissingEntries: vi.fn(async () => 0),
    };
    const service = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Existing Hero',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'existing-hero',
        unlockPriceShards: 100,
      },
      ],
    });

    const result = await service.syncCatalog();

    expect(result.deactivated).toBe(1);
    expect(charactersRepository.markMissingEntriesInactive).toHaveBeenCalledWith(
      ['existing-hero'],
      postgresState.client,
    );
    expect(charactersRepository.hardDeleteMissingEntries).not.toHaveBeenCalled();
  });

  it('hard deletes characters missing from the seed when requested', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => [
        createCharacterRecord({ slug: 'existing-hero' }),
        createCharacterRecord({ slug: 'removed-hero' }),
      ]),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(async () => createCharacterRecord()),
      markMissingEntriesInactive: vi.fn(async () => 0),
      hardDeleteMissingEntries: vi.fn(async () => 1),
    };
    const service = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Existing Hero',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'existing-hero',
        unlockPriceShards: 100,
      },
      ],
    });

    const result = await service.syncCatalog({ hardDelete: true });

    expect(result.hardDeleted).toBe(1);
    expect(charactersRepository.hardDeleteMissingEntries).toHaveBeenCalledWith(
      ['existing-hero'],
      postgresState.client,
    );
    expect(charactersRepository.markMissingEntriesInactive).not.toHaveBeenCalled();
  });

  it('fails safely when the seed is invalid', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => []),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(),
      markMissingEntriesInactive: vi.fn(),
      hardDeleteMissingEntries: vi.fn(),
    };
    const service = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'invalid-category',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Broken Hero',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'broken-hero',
        unlockPriceShards: 100,
      },
      ],
    });

    await expect(service.syncCatalog()).rejects.toThrow();
    expect(postgresState.withTransaction).not.toHaveBeenCalled();
    expect(charactersRepository.upsertCatalogEntry).not.toHaveBeenCalled();
  });

  it('enforces unique slugs and validates image url format', async () => {
    const charactersRepository = {
      listAll: vi.fn(async () => []),
      listDefaultUnlocked: vi.fn(async () => []),
      upsertCatalogEntry: vi.fn(),
      markMissingEntriesInactive: vi.fn(),
      hardDeleteMissingEntries: vi.fn(),
    };

    const duplicateSlugService = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/strength-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Hero One',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'duplicate-hero',
        unlockPriceShards: 100,
      },
      {
        category: 'agility',
        costMana: 3,
        fullLore: 'Lore',
        imageUrl: '/uploads/characters/agility-portrait.svg',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Hero Two',
        rarity: 'epic',
        releaseOrder: 2,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'duplicate-hero',
        unlockPriceShards: 120,
      },
      ],
    });

    await expect(duplicateSlugService.syncCatalog()).rejects.toThrow(/Duplicate slug/);

    const invalidImageService = new CatalogSyncService(charactersRepository as never, {
      seedEntries: [
      {
        category: 'strength',
        costMana: 4,
        fullLore: 'Lore',
        imageUrl: 'bad-path.png',
        isActive: true,
        isDefaultUnlocked: false,
        name: 'Hero Three',
        rarity: 'rare',
        releaseOrder: 1,
        shortDescription: 'Desc',
        shortLore: 'Lore',
        slug: 'hero-three',
        unlockPriceShards: 100,
      },
      ],
    });

    await expect(invalidImageService.syncCatalog()).rejects.toThrow(/imageUrl/);
  });

  it('ensures default unlocked ownerships for existing users during sync', async () => {
    const defaultCharacter = createCharacterRecord({
      id: 'character-default',
      isDefaultUnlocked: true,
      slug: 'default-hero',
    });
    const charactersRepository = {
      listAll: vi.fn(async () => []),
      listDefaultUnlocked: vi.fn(async () => [defaultCharacter]),
      upsertCatalogEntry: vi.fn(async () => defaultCharacter),
      markMissingEntriesInactive: vi.fn(async () => 0),
      hardDeleteMissingEntries: vi.fn(async () => 0),
    };
    const usersRepository = {
      listIds: vi.fn(async () => ['user-1', 'user-2']),
    };
    const userCharactersRepository = {
      ensureOwnerships: vi.fn(async () => undefined),
    };
    const service = new CatalogSyncService(
      charactersRepository as never,
      {
        seedEntries: [
        {
          category: 'strength',
          costMana: 4,
          fullLore: 'Lore',
          imageUrl: '/uploads/characters/strength-portrait.svg',
          isActive: true,
          isDefaultUnlocked: true,
          name: 'Default Hero',
          rarity: 'rare',
          releaseOrder: 1,
          shortDescription: 'Desc',
          shortLore: 'Lore',
          slug: 'default-hero',
          unlockPriceShards: 0,
        },
        ],
        userCharactersRepository: userCharactersRepository as never,
        usersRepository: usersRepository as never,
      },
    );

    const result = await service.syncCatalog();

    expect(result.defaultOwnershipsEnsured).toBe(2);
    expect(usersRepository.listIds).toHaveBeenCalledWith(postgresState.client);
    expect(charactersRepository.listDefaultUnlocked).toHaveBeenCalledWith(postgresState.client);
    expect(userCharactersRepository.ensureOwnerships).toHaveBeenNthCalledWith(
      1,
      'user-1',
      ['character-default'],
      postgresState.client,
    );
    expect(userCharactersRepository.ensureOwnerships).toHaveBeenNthCalledWith(
      2,
      'user-2',
      ['character-default'],
      postgresState.client,
    );
  });
});
