import {
  ACTIVE_DECK_MAX_SLOTS,
  type CharacterCatalogResponse,
  type CharacterDetailResponse,
  type UnlockCharacterResponse,
} from '../../shared/contracts/cards.contract';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { DeckRepository } from '../repositories/deck.repository';
import { CharactersRepository } from '../repositories/characters.repository';
import { UserCharactersRepository } from '../repositories/user-characters.repository';
import { mapCharacterCatalogEntry } from './characters-mapper';
import { WalletService } from './wallet.service';

interface CharacterLookupOptions {
  includeInactive?: boolean;
}

export class CharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly userCharactersRepository: UserCharactersRepository,
    private readonly deckRepository: DeckRepository,
    private readonly walletService: WalletService,
  ) {}

  async ensureDefaultUnlockedCharacters(userId: string, client: DatabaseClient): Promise<void> {
    const defaultCharacters = await this.charactersRepository.listDefaultUnlocked(client);
    await this.userCharactersRepository.ensureOwnerships(
      userId,
      defaultCharacters.map((character) => character.id),
      client,
    );
  }

  async getCatalog(
    userId: string,
    options: CharacterLookupOptions = {},
  ): Promise<CharacterCatalogResponse> {
    return withTransaction(async (client) => {
      const includeInactive = options.includeInactive ?? false;
      const [characters, ownedCharacters, activeDeck] = await Promise.all([
        this.charactersRepository.listAll(client, { includeInactive }),
        this.userCharactersRepository.listByUserId(userId, client),
        this.deckRepository.findActiveByUserId(userId, client),
      ]);

      const deckCards = activeDeck ? await this.deckRepository.listCards(activeDeck.id, client) : [];
      const ownedByCharacterId = new Map(
        ownedCharacters.map((ownedCharacter) => [ownedCharacter.characterId, ownedCharacter]),
      );
      const deckCharacterIds = new Set(deckCards.map((card) => card.characterId));

      return {
        characters: characters.map((character) =>
          mapCharacterCatalogEntry(
            character,
            ownedByCharacterId.get(character.id) ?? null,
            deckCharacterIds.has(character.id),
          ),
        ),
        maxDeckSlots: ACTIVE_DECK_MAX_SLOTS,
      };
    });
  }

  async getCharacterBySlug(
    userId: string,
    slug: string,
    options: CharacterLookupOptions = {},
  ): Promise<CharacterDetailResponse> {
    return withTransaction(async (client) => {
      const character = await this.charactersRepository.findBySlug(slug, client, {
        includeInactive: options.includeInactive ?? false,
      });

      if (!character) {
        throw new AppError(404, 'CHARACTER_NOT_FOUND', 'Character could not be found.');
      }

      const [ownership, activeDeck] = await Promise.all([
        this.userCharactersRepository.findByUserAndCharacter(userId, character.id, client),
        this.deckRepository.findActiveByUserId(userId, client),
      ]);
      const deckCards = activeDeck ? await this.deckRepository.listCards(activeDeck.id, client) : [];

      return {
        character: mapCharacterCatalogEntry(
          character,
          ownership,
          deckCards.some((deckCard) => deckCard.characterId === character.id),
        ),
      };
    });
  }

  async unlockCharacter(userId: string, characterId: string): Promise<UnlockCharacterResponse> {
    return withTransaction(async (client) => {
      const character = await this.charactersRepository.findById(characterId, client, {
        forUpdate: true,
        includeInactive: true,
      });

      if (!character) {
        throw new AppError(404, 'CHARACTER_NOT_FOUND', 'Character could not be found.');
      }

      if (!character.isActive) {
        throw new AppError(409, 'CHARACTER_INACTIVE', 'This character is not currently available.');
      }

      const existingOwnership = await this.userCharactersRepository.findByUserAndCharacter(
        userId,
        character.id,
        client,
        {
          forUpdate: true,
        },
      );

      if (existingOwnership) {
        throw new AppError(409, 'CHARACTER_ALREADY_UNLOCKED', 'This character is already unlocked.');
      }

      const walletResult = await this.walletService.applyShardTransactionInTransaction(
        userId,
        {
          amount: character.unlockPriceShards,
          direction: 'debit',
          reason: 'character_unlock',
          metadataJson: {
            characterId: character.id,
            characterName: character.name,
            characterSlug: character.slug,
          },
        },
        client,
      );
      const ownership = await this.userCharactersRepository.createOwnership(
        {
          characterId: character.id,
          level: 1,
          userId,
        },
        client,
      );

      return {
        character: mapCharacterCatalogEntry(character, ownership, false),
        transaction: walletResult.transaction,
        wallet: walletResult.wallet,
      };
    });
  }
}
