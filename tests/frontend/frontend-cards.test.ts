// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';

import {
  calculateDeckOverview,
  filterCatalogCharacters,
  groupCatalogCharactersByOwnership,
} from '../../app/frontend/services/cards/cards-selectors';
import { CardsStore } from '../../app/frontend/stores/cards.store';
import type {
  CharacterCatalogEntry,
  PlayerDeck,
} from '../../app/frontend/services/cards/cards-types';

function createCharacter(
  overrides: Partial<CharacterCatalogEntry> = {},
): CharacterCatalogEntry {
  return {
    category: 'strength',
    costMana: 4,
    createdAt: '2026-04-01T00:00:00.000Z',
    fullLore: 'A veteran of a hundred sieges.',
    id: 'character-1',
    imageUrl: '/uploads/characters/strength-portrait.svg',
    inDeck: false,
    isActive: true,
    isDefaultUnlocked: false,
    isUnlocked: true,
    level: 1,
    name: 'Arcane Golem',
    rarity: 'common',
    releaseOrder: 1,
    shortDescription: 'Frontline pressure.',
    shortLore: 'Forged in war.',
    slug: 'arcane-golem',
    status: 'unlocked',
    unlockPriceShards: 80,
    unlockedAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    ...overrides,
  };
}

function createDeck(cards: CharacterCatalogEntry[]): PlayerDeck {
  return {
    cards: cards.map((character, index) => ({
      character: {
        ...character,
        inDeck: true,
        status: 'in_deck',
      },
      position: index + 1,
    })),
    createdAt: '2026-04-01T00:00:00.000Z',
    id: 'deck-1',
    isActive: true,
    maxSlots: 8,
    name: 'Primary Loadout',
    updatedAt: '2026-04-02T00:00:00.000Z',
    userId: 'user-1',
  };
}

describe('frontend cards selectors and store', () => {
  it('filters the catalog and calculates tactical overview stats', () => {
    const catalog = [
      createCharacter({
        category: 'strength',
        name: 'Arcane Golem',
        shortDescription: 'Frontline pressure.',
      }),
      createCharacter({
        category: 'agility',
        costMana: 3,
        id: 'character-2',
        name: 'Ranger',
        shortDescription: 'Ranged tempo pressure.',
      }),
      createCharacter({
        category: 'intelligence',
        costMana: 5,
        id: 'character-3',
        name: 'Void Weaver',
        shortDescription: 'Spatial control.',
      }),
    ];

    expect(filterCatalogCharacters(catalog, 'all', 'void')).toEqual([
      expect.objectContaining({
        id: 'character-3',
      }),
    ]);
    expect(filterCatalogCharacters(catalog, 'agility', '')).toEqual([
      expect.objectContaining({
        id: 'character-2',
      }),
    ]);
    expect(
      groupCatalogCharactersByOwnership([
        catalog[2]!,
        createCharacter({
          id: 'character-4',
          isUnlocked: false,
          level: null,
          unlockedAt: null,
        }),
        catalog[0]!,
      ]),
    ).toEqual({
      locked: [expect.objectContaining({ id: 'character-4' })],
      unlocked: [
        expect.objectContaining({ id: 'character-3' }),
        expect.objectContaining({ id: 'character-1' }),
      ],
    });

    const overview = calculateDeckOverview(
      createDeck([catalog[0]!, catalog[1]!, catalog[2]!]),
    );

    expect(overview.averageCost).toBeCloseTo(4);
    expect(overview.categoryCounts).toEqual({
      agility: 1,
      intelligence: 1,
      strength: 1,
    });
  });

  it('loads catalog state, unlocks a character, and persists ordered deck changes', async () => {
    const unlockedCharacter = createCharacter({
      id: 'character-1',
      name: 'Arcane Golem',
      status: 'in_deck',
    });
    const lockedCharacter = createCharacter({
      category: 'agility',
      id: 'character-2',
      isUnlocked: false,
      level: null,
      name: 'Swiftblade',
      shortDescription: 'Tempo duelist.',
      slug: 'swiftblade',
      status: 'locked',
      unlockPriceShards: 140,
      unlockedAt: null,
    });
    let liveCatalog = [unlockedCharacter, lockedCharacter];
    const authService = {
      ensureAccessToken: vi.fn(async () => 'access-token'),
    };
    const apiClient = {
      getCatalog: vi.fn(async () => ({
        characters: liveCatalog,
        maxDeckSlots: 8,
      })),
      getCharacterDetail: vi.fn(async (_accessToken: string, slug: string) => {
        const character = liveCatalog.find((entry) => entry.slug === slug);

        if (!character) {
          throw new Error('missing character');
        }

        return character;
      }),
      getDeck: vi.fn(async () => createDeck([unlockedCharacter])),
      saveDeck: vi.fn(async (_accessToken: string, payload: { cards: string[] }) =>
        createDeck(
          payload.cards
            .map((characterId) => liveCatalog.find((entry) => entry.id === characterId)!)
            .filter(Boolean),
        )),
      unlockCharacter: vi.fn(async () => {
        const unlocked = {
          ...lockedCharacter,
          isUnlocked: true,
          level: 1,
          status: 'unlocked' as const,
          unlockedAt: '2026-04-03T00:00:00.000Z',
        };
        liveCatalog = [unlockedCharacter, unlocked];

        return {
          character: unlocked,
          transaction: {
            amount: 140,
            createdAt: '2026-04-03T00:00:00.000Z',
            currencyType: 'shards' as const,
            direction: 'debit' as const,
            id: 'wallet-transaction-1',
            metadataJson: null,
            reason: 'character_unlock' as const,
          },
          wallet: {
            createdAt: '2026-04-01T00:00:00.000Z',
            shards: 360,
            updatedAt: '2026-04-03T00:00:00.000Z',
          },
        };
      }),
    };
    const store = new CardsStore({
      apiClient: apiClient as never,
      authService: authService as never,
    });

    await store.load();
    expect(store.getSnapshot().catalog).toEqual([
      expect.objectContaining({
        id: 'character-1',
        inDeck: true,
        status: 'in_deck',
      }),
      expect.objectContaining({
        id: 'character-2',
        isUnlocked: false,
        status: 'locked',
      }),
    ]);

    await store.unlockCharacter('character-2');
    expect(store.getSnapshot().catalog[1]).toMatchObject({
      id: 'character-2',
      isUnlocked: true,
      level: 1,
      status: 'unlocked',
    });

    await store.insertCharacterIntoDeck('character-2', 1);
    expect(apiClient.saveDeck).toHaveBeenCalledWith('access-token', {
      cards: ['character-2', 'character-1'],
    });
    expect(store.getSnapshot().deck?.cards).toEqual([
      expect.objectContaining({
        position: 1,
        character: expect.objectContaining({
          id: 'character-2',
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

    await store.insertCharacterIntoDeck('character-1', 1);
    expect(apiClient.saveDeck).toHaveBeenLastCalledWith('access-token', {
      cards: ['character-1', 'character-2'],
    });

    await store.removeCharacterFromDeck('character-2');
    await store.addCharacterToDeck('character-2');
    expect(apiClient.saveDeck).toHaveBeenLastCalledWith('access-token', {
      cards: ['character-1', 'character-2'],
    });
  });
});
