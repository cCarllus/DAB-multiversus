import type { CharacterCategory } from '@shared/contracts/cards.contract';

import type {
  CardsFilter,
  CharacterCatalogEntry,
  PlayerDeck,
} from './cards-types';

export interface DeckOverview {
  averageCost: number;
  categoryCounts: Record<CharacterCategory, number>;
}

export interface GroupedCatalogCharacters {
  locked: CharacterCatalogEntry[];
  unlocked: CharacterCatalogEntry[];
}

function resolveCharacterStatus(
  character: CharacterCatalogEntry,
  inDeck: boolean,
): CharacterCatalogEntry['status'] {
  if (!character.isActive) {
    return 'inactive';
  }

  if (inDeck) {
    return 'in_deck';
  }

  return character.isUnlocked ? 'unlocked' : 'locked';
}

export function reconcileCatalogDeckState(
  catalog: CharacterCatalogEntry[],
  deck: PlayerDeck | null,
): CharacterCatalogEntry[] {
  const deckIds = new Set(deck?.cards.map((card) => card.character.id) ?? []);

  return catalog.map((character) => {
    const inDeck = deckIds.has(character.id);

    return {
      ...character,
      inDeck,
      status: resolveCharacterStatus(character, inDeck),
    };
  });
}

export function upsertCatalogCharacter(
  catalog: CharacterCatalogEntry[],
  character: CharacterCatalogEntry,
): CharacterCatalogEntry[] {
  const existingIndex = catalog.findIndex((entry) => entry.id === character.id);

  if (existingIndex === -1) {
    return [...catalog, character].sort((left, right) => left.releaseOrder - right.releaseOrder);
  }

  return catalog.map((entry) => (entry.id === character.id ? character : entry));
}

export function filterCatalogCharacters(
  catalog: CharacterCatalogEntry[],
  filter: CardsFilter,
  query: string,
): CharacterCatalogEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return catalog.filter((character) => {
    if (filter !== 'all' && character.category !== filter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      character.name.toLowerCase().includes(normalizedQuery) ||
      character.shortDescription.toLowerCase().includes(normalizedQuery) ||
      character.shortLore.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function groupCatalogCharactersByOwnership(
  catalog: CharacterCatalogEntry[],
): GroupedCatalogCharacters {
  return catalog.reduce<GroupedCatalogCharacters>(
    (groups, character) => {
      if (character.isUnlocked) {
        groups.unlocked.push(character);
      } else {
        groups.locked.push(character);
      }

      return groups;
    },
    {
      locked: [],
      unlocked: [],
    },
  );
}

export function calculateDeckOverview(deck: PlayerDeck | null): DeckOverview {
  const categoryCounts: Record<CharacterCategory, number> = {
    agility: 0,
    intelligence: 0,
    strength: 0,
  };

  if (!deck || deck.cards.length === 0) {
    return {
      averageCost: 0,
      categoryCounts,
    };
  }

  let totalCost = 0;

  for (const deckCard of deck.cards) {
    totalCost += deckCard.character.costMana;
    categoryCounts[deckCard.character.category] += 1;
  }

  return {
    averageCost: totalCost / deck.cards.length,
    categoryCounts,
  };
}

export function buildOptimisticDeck(
  baseDeck: PlayerDeck,
  catalog: CharacterCatalogEntry[],
  characterIds: string[],
): PlayerDeck {
  const characterById = new Map(catalog.map((character) => [character.id, character]));
  const deckIds = new Set(characterIds);

  return {
    ...baseDeck,
    cards: characterIds
      .map((characterId, index) => {
        const character = characterById.get(characterId);

        if (!character) {
          return null;
        }

        return {
          position: index + 1,
          character: {
            ...character,
            inDeck: true,
            status: resolveCharacterStatus(character, deckIds.has(character.id)),
          },
        };
      })
      .filter(
        (
          deckCard,
        ): deckCard is NonNullable<ReturnType<typeof buildOptimisticDeck>['cards'][number]> =>
          deckCard !== null,
      ),
  };
}
