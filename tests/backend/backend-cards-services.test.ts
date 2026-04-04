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

import { CharactersService } from '../../app/backend/services/characters.service';
import { DeckService } from '../../app/backend/services/deck.service';
import {
  createCharacterRecord,
  createDeckCardRecord,
  createDeckRecord,
  createUserCharacterRecord,
  createWalletRecord,
  createWalletTransactionRecord,
} from './helpers/player-platform.fixtures';

describe('backend cards services', () => {
  beforeEach(() => {
    postgresState.withTransaction.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves the character catalog with unlock and deck state', async () => {
    const ownedCharacter = createCharacterRecord({
      id: 'character-owned',
      isDefaultUnlocked: true,
      name: 'Arcane Golem',
      slug: 'arcane-golem',
    });
    const lockedCharacter = createCharacterRecord({
      category: 'agility',
      id: 'character-locked',
      name: 'Swiftblade',
      slug: 'swiftblade',
    });
    const charactersRepository = {
      listAll: vi.fn(async () => [ownedCharacter, lockedCharacter]),
    };
    const userCharactersRepository = {
      listByUserId: vi.fn(async () => [
        createUserCharacterRecord({
          characterId: ownedCharacter.id,
          level: 3,
        }),
      ]),
    };
    const deckRepository = {
      findActiveByUserId: vi.fn(async () => createDeckRecord()),
      listCards: vi.fn(async () => [
        createDeckCardRecord({
          characterId: ownedCharacter.id,
        }),
      ]),
    };
    const walletService = {
      applyShardTransactionInTransaction: vi.fn(),
    };
    const service = new CharactersService(
      charactersRepository as never,
      userCharactersRepository as never,
      deckRepository as never,
      walletService as never,
    );

    const result = await service.getCatalog('user-1');

    expect(charactersRepository.listAll).toHaveBeenCalledWith(postgresState.client, {
      includeInactive: false,
    });
    expect(result.maxDeckSlots).toBe(8);
    expect(result.characters).toEqual([
      expect.objectContaining({
        id: 'character-owned',
        inDeck: true,
        isUnlocked: true,
        level: 3,
        status: 'in_deck',
      }),
      expect.objectContaining({
        id: 'character-locked',
        inDeck: false,
        isUnlocked: false,
        level: null,
        status: 'locked',
      }),
    ]);
  });

  it('retrieves character detail with lore and deck state', async () => {
    const character = createCharacterRecord({
      id: 'character-1',
      name: 'Void Weaver',
      slug: 'void-weaver',
      category: 'intelligence',
      rarity: 'epic',
    });
    const charactersRepository = {
      findBySlug: vi.fn(async () => character),
    };
    const userCharactersRepository = {
      findByUserAndCharacter: vi.fn(async () =>
        createUserCharacterRecord({
          characterId: character.id,
          level: 5,
        })),
    };
    const deckRepository = {
      findActiveByUserId: vi.fn(async () => createDeckRecord()),
      listCards: vi.fn(async () => [
        createDeckCardRecord({
          characterId: character.id,
        }),
      ]),
    };
    const walletService = {
      applyShardTransactionInTransaction: vi.fn(),
    };
    const service = new CharactersService(
      charactersRepository as never,
      userCharactersRepository as never,
      deckRepository as never,
      walletService as never,
    );

    const result = await service.getCharacterBySlug('user-1', 'void-weaver');

    expect(charactersRepository.findBySlug).toHaveBeenCalledWith('void-weaver', postgresState.client, {
      includeInactive: false,
    });
    expect(result.character).toMatchObject({
      fullLore: character.fullLore,
      id: character.id,
      inDeck: true,
      isUnlocked: true,
      level: 5,
      slug: 'void-weaver',
      status: 'in_deck',
    });
  });

  it('unlocks characters, debits shards, and creates ownership', async () => {
    const character = createCharacterRecord({
      id: 'character-epic',
      name: 'Necromancer',
      slug: 'necromancer',
      unlockPriceShards: 270,
    });
    const charactersRepository = {
      findById: vi.fn(async () => character),
    };
    const userCharactersRepository = {
      createOwnership: vi.fn(async () =>
        createUserCharacterRecord({
          characterId: character.id,
        })),
      findByUserAndCharacter: vi.fn(async () => null),
    };
    const deckRepository = {};
    const walletService = {
      applyShardTransactionInTransaction: vi.fn(async () => ({
        transaction: {
          ...createWalletTransactionRecord({
            amount: 270,
            direction: 'debit',
            reason: 'character_unlock',
          }),
          createdAt: '2026-04-02T01:00:00.000Z',
        },
        wallet: {
          ...createWalletRecord({
            shards: 230,
          }),
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      })),
    };
    const service = new CharactersService(
      charactersRepository as never,
      userCharactersRepository as never,
      deckRepository as never,
      walletService as never,
    );

    const result = await service.unlockCharacter('user-1', character.id);

    expect(walletService.applyShardTransactionInTransaction).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        amount: 270,
        direction: 'debit',
        reason: 'character_unlock',
      }),
      postgresState.client,
    );
    expect(userCharactersRepository.createOwnership).toHaveBeenCalledWith(
      {
        characterId: character.id,
        level: 1,
        userId: 'user-1',
      },
      postgresState.client,
    );
    expect(result).toMatchObject({
      character: {
        id: character.id,
        isUnlocked: true,
        level: 1,
      },
      transaction: {
        amount: 270,
        direction: 'debit',
        reason: 'character_unlock',
      },
      wallet: {
        shards: 230,
      },
    });
  });

  it('prevents duplicate unlocks, blocks inactive unlocks, and propagates insufficient shards', async () => {
    const character = createCharacterRecord({
      id: 'character-dup',
      name: 'Shadow Assassin',
      slug: 'shadow-assassin',
      unlockPriceShards: 240,
    });
    const baseCharactersRepository = {
      findById: vi.fn(async () => character),
    };
    const duplicateOwnershipRepository = {
      findByUserAndCharacter: vi.fn(async () =>
        createUserCharacterRecord({
          characterId: character.id,
        })),
    };
    const walletService = {
      applyShardTransactionInTransaction: vi.fn(),
    };

    const duplicateService = new CharactersService(
      baseCharactersRepository as never,
      duplicateOwnershipRepository as never,
      {} as never,
      walletService as never,
    );

    await expect(duplicateService.unlockCharacter('user-1', character.id)).rejects.toMatchObject({
      code: 'CHARACTER_ALREADY_UNLOCKED',
      statusCode: 409,
    });
    expect(walletService.applyShardTransactionInTransaction).not.toHaveBeenCalled();

    baseCharactersRepository.findById.mockResolvedValue({
      ...character,
      isActive: false,
    });

    const inactiveService = new CharactersService(
      baseCharactersRepository as never,
      {
        findByUserAndCharacter: vi.fn(async () => null),
      } as never,
      {} as never,
      walletService as never,
    );

    await expect(inactiveService.unlockCharacter('user-1', character.id)).rejects.toMatchObject({
      code: 'CHARACTER_INACTIVE',
      statusCode: 409,
    });

    const missingShardsRepository = {
      createOwnership: vi.fn(),
      findByUserAndCharacter: vi.fn(async () => null),
    };
    const insufficientWalletService = {
      applyShardTransactionInTransaction: vi.fn(async () => {
        throw new Error('You do not have enough shards for this transaction.');
      }),
    };
    baseCharactersRepository.findById.mockResolvedValue({
      ...character,
      isActive: true,
    });
    const insufficientService = new CharactersService(
      baseCharactersRepository as never,
      missingShardsRepository as never,
      {} as never,
      insufficientWalletService as never,
    );

    await expect(insufficientService.unlockCharacter('user-1', character.id)).rejects.toThrow(
      'You do not have enough shards for this transaction.',
    );
    expect(missingShardsRepository.createOwnership).not.toHaveBeenCalled();
  });

  it('supports inactive filtering and avoids default-unlock side effects in read endpoints', async () => {
    const activeCharacter = createCharacterRecord({
      id: 'character-active',
      slug: 'active-character',
    });
    const inactiveCharacter = createCharacterRecord({
      id: 'character-inactive',
      isActive: false,
      slug: 'inactive-character',
    });
    const charactersRepository = {
      findBySlug: vi.fn(async (_slug: string, _client: unknown, options?: { includeInactive?: boolean }) =>
        options?.includeInactive ? inactiveCharacter : null),
      listAll: vi.fn(async (_client: unknown, options?: { includeInactive?: boolean }) =>
        options?.includeInactive ? [activeCharacter, inactiveCharacter] : [activeCharacter]),
    };
    const userCharactersRepository = {
      ensureOwnerships: vi.fn(async () => undefined),
      findByUserAndCharacter: vi.fn(async () => null),
      listByUserId: vi.fn(async () => []),
    };
    const deckRepository = {
      findActiveByUserId: vi.fn(async () => null),
    };
    const service = new CharactersService(
      charactersRepository as never,
      userCharactersRepository as never,
      deckRepository as never,
      { applyShardTransactionInTransaction: vi.fn() } as never,
    );

    const catalog = await service.getCatalog('user-1', { includeInactive: true });
    expect(catalog.characters).toHaveLength(2);
    expect(userCharactersRepository.ensureOwnerships).not.toHaveBeenCalled();

    await expect(service.getCharacterBySlug('user-1', 'inactive-character')).rejects.toMatchObject({
      code: 'CHARACTER_NOT_FOUND',
      statusCode: 404,
    });

    const detail = await service.getCharacterBySlug('user-1', 'inactive-character', {
      includeInactive: true,
    });
    expect(detail.character.status).toBe('inactive');
  });

  it('rejects oversized and locked decks, then persists deck order and positions', async () => {
    const deckRepository = {
      createActiveDeck: vi.fn(),
      findActiveByUserId: vi.fn(async () => createDeckRecord()),
      listCards: vi.fn(async () => [
        createDeckCardRecord({
          characterId: 'character-2',
          id: 'deck-card-2',
          position: 1,
        }),
        createDeckCardRecord({
          characterId: 'character-1',
          id: 'deck-card-1',
          position: 2,
        }),
      ]),
      replaceCards: vi.fn(async () => undefined),
      touchDeck: vi.fn(async () =>
        createDeckRecord({
          updatedAt: new Date('2026-04-03T00:00:00.000Z'),
        })),
    };
    const charactersRepository = {
      listByIds: vi.fn(async () => [
        createCharacterRecord({
          id: 'character-1',
          name: 'Arcane Golem',
          slug: 'arcane-golem',
        }),
        createCharacterRecord({
          category: 'agility',
          id: 'character-2',
          name: 'Ranger',
          slug: 'ranger',
        }),
      ]),
    };
    const userCharactersRepository = {
      listByUserId: vi.fn(async () => [
        createUserCharacterRecord({
          characterId: 'character-1',
        }),
      ]),
    };
    const service = new DeckService(
      deckRepository as never,
      charactersRepository as never,
      userCharactersRepository as never,
    );

    await expect(
      service.saveActiveDeck('user-1', {
        cards: new Array(9).fill('00000000-0000-0000-0000-000000000001'),
      }),
    ).rejects.toMatchObject({
      code: 'DECK_TOO_LARGE',
      statusCode: 400,
    });

    await expect(
      service.saveActiveDeck('user-1', {
        cards: ['character-1', 'character-2'],
      }),
    ).rejects.toMatchObject({
      code: 'CHARACTER_NOT_OWNED',
      statusCode: 403,
    });

    userCharactersRepository.listByUserId.mockResolvedValue([
      createUserCharacterRecord({
        characterId: 'character-1',
      }),
      createUserCharacterRecord({
        characterId: 'character-2',
        id: 'user-character-2',
      }),
    ]);

    const result = await service.saveActiveDeck('user-1', {
      cards: ['character-2', 'character-1'],
    });

    expect(deckRepository.replaceCards).toHaveBeenCalledWith(
      'deck-1',
      ['character-2', 'character-1'],
      postgresState.client,
    );
    expect(result.deck.cards).toEqual([
      expect.objectContaining({
        position: 1,
        character: expect.objectContaining({
          id: 'character-2',
          inDeck: true,
        }),
      }),
      expect.objectContaining({
        position: 2,
        character: expect.objectContaining({
          id: 'character-1',
          inDeck: true,
        }),
      }),
    ]);
  });
});
