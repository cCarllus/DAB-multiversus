import {
  ACTIVE_DECK_MAX_SLOTS,
  type DeckResponse,
  type PlayerDeck,
  type SaveDeckRequest,
  type SaveDeckResponse,
} from '../../shared/contracts/cards.contract';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { DeckRepository } from '../repositories/deck.repository';
import { CharactersRepository } from '../repositories/characters.repository';
import { UserCharactersRepository } from '../repositories/user-characters.repository';
import { mapCharacterCatalogEntry } from './characters-mapper';
import type { DeckCardRecord, DeckRecord } from '../types/cards.types';

const DEFAULT_ACTIVE_DECK_NAME = 'Primary Loadout';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}

export class DeckService {
  constructor(
    private readonly deckRepository: DeckRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly userCharactersRepository: UserCharactersRepository,
  ) {}

  async ensureActiveDeck(userId: string, client: DatabaseClient): Promise<DeckRecord> {
    const existingDeck = await this.deckRepository.findActiveByUserId(userId, client, {
      forUpdate: true,
    });

    if (existingDeck) {
      return existingDeck;
    }

    try {
      return await this.deckRepository.createActiveDeck(
        {
          name: DEFAULT_ACTIVE_DECK_NAME,
          userId,
        },
        client,
      );
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const recoveredDeck = await this.deckRepository.findActiveByUserId(userId, client, {
        forUpdate: true,
      });

      if (!recoveredDeck) {
        throw error;
      }

      return recoveredDeck;
    }
  }

  async getActiveDeck(userId: string): Promise<DeckResponse> {
    return withTransaction(async (client) => {
      const deck = await this.ensureActiveDeck(userId, client);
      return {
        deck: await this.buildDeckResponse(deck, userId, client),
      };
    });
  }

  async saveActiveDeck(userId: string, input: SaveDeckRequest): Promise<SaveDeckResponse> {
    return withTransaction(async (client) => {
      if (input.cards.length > ACTIVE_DECK_MAX_SLOTS) {
        throw new AppError(400, 'DECK_TOO_LARGE', 'A deck can contain at most 8 characters.');
      }

      const uniqueCharacterIds = new Set(input.cards);

      if (uniqueCharacterIds.size !== input.cards.length) {
        throw new AppError(
          400,
          'DECK_DUPLICATE_CHARACTERS',
          'Duplicate characters are not allowed in the active deck.',
        );
      }

      const [characters, ownedCharacters, deck] = await Promise.all([
        this.charactersRepository.listByIds(input.cards, client),
        this.userCharactersRepository.listByUserId(userId, client),
        this.ensureActiveDeck(userId, client),
      ]);

      if (characters.length !== input.cards.length) {
        throw new AppError(400, 'CHARACTER_NOT_FOUND', 'One or more selected characters do not exist.');
      }

      const characterById = new Map(characters.map((character) => [character.id, character]));
      const ownedCharacterIds = new Set(ownedCharacters.map((ownedCharacter) => ownedCharacter.characterId));

      for (const characterId of input.cards) {
        const character = characterById.get(characterId);

        if (!character) {
          throw new AppError(
            400,
            'CHARACTER_NOT_FOUND',
            'One or more selected characters do not exist.',
          );
        }

        if (!character.isActive) {
          throw new AppError(
            409,
            'CHARACTER_INACTIVE',
            `Character ${character.name} is not currently available for deck building.`,
          );
        }

        if (!ownedCharacterIds.has(characterId)) {
          throw new AppError(
            403,
            'CHARACTER_NOT_OWNED',
            `Character ${character.name} must be unlocked before it can be added to the deck.`,
          );
        }
      }

      await this.deckRepository.replaceCards(deck.id, input.cards, client);
      const updatedDeck = await this.deckRepository.touchDeck(deck.id, client);

      return {
        deck: await this.buildDeckResponse(updatedDeck, userId, client),
      };
    });
  }

  private async buildDeckResponse(
    deck: DeckRecord,
    userId: string,
    client: DatabaseClient,
  ): Promise<PlayerDeck> {
    const [deckCards, ownedCharacters] = await Promise.all([
      this.deckRepository.listCards(deck.id, client),
      this.userCharactersRepository.listByUserId(userId, client),
    ]);

    const characterIds = deckCards.map((deckCard) => deckCard.characterId);
    const characters = await this.charactersRepository.listByIds(characterIds, client);
    const characterById = new Map(characters.map((character) => [character.id, character]));
    const ownershipByCharacterId = new Map(
      ownedCharacters.map((ownedCharacter) => [ownedCharacter.characterId, ownedCharacter]),
    );
    const deckCharacterIds = new Set(characterIds);

    return {
      id: deck.id,
      userId: deck.userId,
      name: deck.name,
      isActive: deck.isActive,
      maxSlots: ACTIVE_DECK_MAX_SLOTS,
      cards: deckCards
        .map((deckCard) => this.mapDeckCard(deckCard, characterById, ownershipByCharacterId, deckCharacterIds))
        .filter(
          (
            deckCard,
          ): deckCard is NonNullable<ReturnType<DeckService['mapDeckCard']>> => deckCard !== null,
        ),
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
    };
  }

  private mapDeckCard(
    deckCard: DeckCardRecord,
    characterById: Map<string, Awaited<ReturnType<CharactersRepository['listByIds']>>[number]>,
    ownershipByCharacterId: Map<
      string,
      Awaited<ReturnType<UserCharactersRepository['listByUserId']>>[number]
    >,
    deckCharacterIds: Set<string>,
  ) {
    const character = characterById.get(deckCard.characterId);

    if (!character) {
      return null;
    }

    return {
      position: deckCard.position,
      character: mapCharacterCatalogEntry(
        character,
        ownershipByCharacterId.get(character.id) ?? null,
        deckCharacterIds.has(character.id),
      ),
    };
  }
}
