import characterCatalogSeed from '../content/character-catalog.seed.json';
import {
  ACTIVE_DECK_MAX_SLOTS,
  type CharacterCatalogEntry,
  type CharacterCatalogResponse,
  type CharacterDetailResponse,
  type UnlockCharacterResponse,
} from '../../shared/contracts/cards.contract';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { DeckRepository } from '../repositories/deck.repository';
import { CharactersRepository } from '../repositories/characters.repository';
import { UserCharactersRepository } from '../repositories/user-characters.repository';
import { WalletService } from './wallet.service';
import { mapCharacterCatalogEntry } from './characters-mapper';
import type { UpsertCharacterCatalogInput } from '../types/cards.types';

const CHARACTER_CATALOG_SEED = characterCatalogSeed as UpsertCharacterCatalogInput[];

export class CharactersService {
  private catalogSeeded = false;

  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly userCharactersRepository: UserCharactersRepository,
    private readonly deckRepository: DeckRepository,
    private readonly walletService: WalletService,
  ) {}

  async ensureCatalogSeeded(client?: DatabaseClient): Promise<void> {
    if (this.catalogSeeded) {
      return;
    }

    if (client) {
      await this.seedCatalog(client);
      this.catalogSeeded = true;
      return;
    }

    await withTransaction(async (transactionClient) => {
      await this.seedCatalog(transactionClient);
    });
    this.catalogSeeded = true;
  }

  async ensureDefaultUnlockedCharacters(userId: string, client: DatabaseClient): Promise<void> {
    const defaultCharacters = await this.charactersRepository.listDefaultUnlocked(client);
    await this.userCharactersRepository.ensureOwnerships(
      userId,
      defaultCharacters.map((character) => character.id),
      client,
    );
  }

  async getCatalog(userId: string): Promise<CharacterCatalogResponse> {
    return withTransaction(async (client) => {
      await this.ensureCatalogSeeded(client);
      await this.ensureDefaultUnlockedCharacters(userId, client);

      const [characters, ownedCharacters, activeDeck] = await Promise.all([
        this.charactersRepository.listAll(client),
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

  async getCharacterBySlug(userId: string, slug: string): Promise<CharacterDetailResponse> {
    return withTransaction(async (client) => {
      await this.ensureCatalogSeeded(client);
      await this.ensureDefaultUnlockedCharacters(userId, client);

      const character = await this.charactersRepository.findBySlug(slug, client);

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
      await this.ensureCatalogSeeded(client);
      await this.ensureDefaultUnlockedCharacters(userId, client);

      const character = await this.charactersRepository.findById(characterId, client, {
        forUpdate: true,
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
            characterSlug: character.slug,
            characterName: character.name,
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

  private async seedCatalog(client: DatabaseClient): Promise<void> {
    for (const character of CHARACTER_CATALOG_SEED) {
      await this.charactersRepository.upsertCatalogEntry(character, client);
    }
  }
}
