import { AppApiError } from '@frontend/services/api/api-error';
import type { AuthService } from '@frontend/services/auth/auth-service';
import {
  ACTIVE_DECK_MAX_SLOTS,
} from '@shared/contracts/cards.contract';

import { CardsApiClient } from '@frontend/services/cards/cards-api-client';
import {
  buildOptimisticDeck,
  reconcileCatalogDeckState,
  upsertCatalogCharacter,
} from '@frontend/services/cards/cards-selectors';
import type {
  CardsSnapshot,
  SaveDeckRequest,
  UnlockCharacterResponse,
} from '@frontend/services/cards/cards-types';

interface CardsStoreOptions {
  apiClient?: CardsApiClient;
  authService: AuthService;
}

function createInitialSnapshot(): CardsSnapshot {
  return {
    catalog: [],
    deck: null,
    isDetailLoading: false,
    isLoading: false,
    isSavingDeck: false,
    maxDeckSlots: ACTIVE_DECK_MAX_SLOTS,
    selectedCharacter: null,
    unlockingCharacterId: null,
  };
}

export class CardsStore {
  private readonly apiClient: CardsApiClient;

  private readonly listeners = new Set<() => void>();

  private snapshot: CardsSnapshot = createInitialSnapshot();

  constructor(private readonly options: CardsStoreOptions) {
    this.apiClient = options.apiClient ?? new CardsApiClient();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): CardsSnapshot {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = createInitialSnapshot();
    this.notify();
  }

  async load(force = false): Promise<CardsSnapshot> {
    if (!force && this.snapshot.catalog.length > 0 && this.snapshot.deck) {
      return this.snapshot;
    }

    this.snapshot = {
      ...this.snapshot,
      isLoading: true,
    };
    this.notify();

    try {
      const accessToken = await this.requireAccessToken();
      const [catalogResponse, deck] = await Promise.all([
        this.apiClient.getCatalog(accessToken),
        this.apiClient.getDeck(accessToken),
      ]);
      const catalog = reconcileCatalogDeckState(catalogResponse.characters, deck);
      const selectedCharacter = this.resolveSelectedCharacter(
        catalog,
        this.snapshot.selectedCharacter?.id ?? null,
      );

      this.snapshot = {
        ...this.snapshot,
        catalog,
        deck,
        isLoading: false,
        maxDeckSlots: catalogResponse.maxDeckSlots,
        selectedCharacter,
      };
      this.notify();

      return this.snapshot;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
      };
      this.notify();
      throw error;
    }
  }

  async openCharacterDetail(slug: string): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      isDetailLoading: true,
    };
    this.notify();

    try {
      const accessToken = await this.requireAccessToken();
      const character = await this.apiClient.getCharacterDetail(accessToken, slug);
      const catalog = reconcileCatalogDeckState(
        upsertCatalogCharacter(this.snapshot.catalog, character),
        this.snapshot.deck,
      );

      this.snapshot = {
        ...this.snapshot,
        catalog,
        isDetailLoading: false,
        selectedCharacter: this.resolveSelectedCharacter(catalog, character.id) ?? character,
      };
      this.notify();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        isDetailLoading: false,
      };
      this.notify();
      throw error;
    }
  }

  closeCharacterDetail(): void {
    this.snapshot = {
      ...this.snapshot,
      isDetailLoading: false,
      selectedCharacter: null,
    };
    this.notify();
  }

  async unlockCharacter(characterId: string): Promise<UnlockCharacterResponse> {
    const character = this.snapshot.catalog.find((entry) => entry.id === characterId);

    if (!character) {
      throw new AppApiError('CHARACTER_NOT_FOUND', 'Character could not be found.');
    }

    if (character.isUnlocked) {
      throw new AppApiError(
        'CHARACTER_ALREADY_UNLOCKED',
        'This character is already unlocked.',
      );
    }

    this.snapshot = {
      ...this.snapshot,
      unlockingCharacterId: characterId,
    };
    this.notify();

    try {
      const accessToken = await this.requireAccessToken();
      const response = await this.apiClient.unlockCharacter(accessToken, characterId);
      const catalog = reconcileCatalogDeckState(
        upsertCatalogCharacter(this.snapshot.catalog, response.character),
        this.snapshot.deck,
      );

      this.snapshot = {
        ...this.snapshot,
        catalog,
        selectedCharacter: this.resolveSelectedCharacter(
          catalog,
          this.snapshot.selectedCharacter?.id ?? null,
        ),
        unlockingCharacterId: null,
      };
      this.notify();

      return response;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        unlockingCharacterId: null,
      };
      this.notify();
      throw error;
    }
  }

  async addCharacterToDeck(characterId: string): Promise<void> {
    await this.insertCharacterIntoDeck(characterId);
  }

  async insertCharacterIntoDeck(characterId: string, targetPosition?: number): Promise<void> {
    const deck = this.snapshot.deck;
    const character = this.snapshot.catalog.find((entry) => entry.id === characterId);

    if (!deck || !character) {
      throw new AppApiError('REQUEST_INVALID', 'The deck is not ready yet.');
    }

    if (this.snapshot.isSavingDeck) {
      throw new AppApiError('REQUEST_INVALID', 'Wait for the current deck sync to finish.');
    }

    if (!character.isActive) {
      throw new AppApiError('CHARACTER_INACTIVE', 'This character is not currently available.');
    }

    if (!character.isUnlocked) {
      throw new AppApiError(
        'CHARACTER_NOT_OWNED',
        'Unlock this character before adding it to the deck.',
      );
    }

    const currentCharacterIds = deck.cards.map((deckCard) => deckCard.character.id);

    if (currentCharacterIds.includes(characterId)) {
      if (targetPosition === undefined) {
        throw new AppApiError(
          'DECK_DUPLICATE_CHARACTERS',
          'Duplicate characters are not allowed in the active deck.',
        );
      }

      return this.moveCharacterInDeck(characterId, targetPosition);
    }

    if (currentCharacterIds.length >= this.snapshot.maxDeckSlots) {
      throw new AppApiError('DECK_TOO_LARGE', 'Remove a card before adding another character.');
    }

    const insertionIndex =
      targetPosition === undefined
        ? currentCharacterIds.length
        : Math.max(0, Math.min(targetPosition - 1, currentCharacterIds.length));
    const nextCharacterIds = [...currentCharacterIds];

    nextCharacterIds.splice(insertionIndex, 0, characterId);

    await this.persistDeck({
      cards: nextCharacterIds,
    });
  }

  async removeCharacterFromDeck(characterId: string): Promise<void> {
    const deck = this.snapshot.deck;

    if (!deck) {
      throw new AppApiError('REQUEST_INVALID', 'The deck is not ready yet.');
    }

    if (this.snapshot.isSavingDeck) {
      throw new AppApiError('REQUEST_INVALID', 'Wait for the current deck sync to finish.');
    }

    const currentCharacterIds = deck.cards.map((deckCard) => deckCard.character.id);

    if (!currentCharacterIds.includes(characterId)) {
      return;
    }

    await this.persistDeck({
      cards: currentCharacterIds.filter((deckCharacterId) => deckCharacterId !== characterId),
    });
  }

  private async moveCharacterInDeck(characterId: string, targetPosition: number): Promise<void> {
    const deck = this.snapshot.deck;

    if (!deck) {
      throw new AppApiError('REQUEST_INVALID', 'The deck is not ready yet.');
    }

    const currentCharacterIds = deck.cards.map((deckCard) => deckCard.character.id);
    const currentIndex = currentCharacterIds.indexOf(characterId);

    if (currentIndex === -1) {
      return;
    }

    const nextCharacterIds = currentCharacterIds.filter(
      (deckCharacterId) => deckCharacterId !== characterId,
    );
    const insertionIndex = Math.max(0, Math.min(targetPosition - 1, nextCharacterIds.length));

    nextCharacterIds.splice(insertionIndex, 0, characterId);

    const didChange = nextCharacterIds.some(
      (deckCharacterId, index) => deckCharacterId !== currentCharacterIds[index],
    );

    if (!didChange) {
      return;
    }

    await this.persistDeck({
      cards: nextCharacterIds,
    });
  }

  private async persistDeck(payload: SaveDeckRequest): Promise<void> {
    const previousDeck = this.snapshot.deck;
    const previousCatalog = this.snapshot.catalog;

    if (!previousDeck) {
      throw new AppApiError('REQUEST_INVALID', 'The deck is not ready yet.');
    }

    const optimisticDeck = buildOptimisticDeck(previousDeck, previousCatalog, payload.cards);
    const optimisticCatalog = reconcileCatalogDeckState(previousCatalog, optimisticDeck);

    this.snapshot = {
      ...this.snapshot,
      catalog: optimisticCatalog,
      deck: optimisticDeck,
      isSavingDeck: true,
      selectedCharacter: this.resolveSelectedCharacter(
        optimisticCatalog,
        this.snapshot.selectedCharacter?.id ?? null,
      ),
    };
    this.notify();

    try {
      const accessToken = await this.requireAccessToken();
      const savedDeck = await this.apiClient.saveDeck(accessToken, payload);
      const reconciledCatalog = reconcileCatalogDeckState(this.snapshot.catalog, savedDeck);

      this.snapshot = {
        ...this.snapshot,
        catalog: reconciledCatalog,
        deck: savedDeck,
        isSavingDeck: false,
        selectedCharacter: this.resolveSelectedCharacter(
          reconciledCatalog,
          this.snapshot.selectedCharacter?.id ?? null,
        ),
      };
      this.notify();
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        catalog: previousCatalog,
        deck: previousDeck,
        isSavingDeck: false,
        selectedCharacter: this.resolveSelectedCharacter(
          previousCatalog,
          this.snapshot.selectedCharacter?.id ?? null,
        ),
      };
      this.notify();
      throw error;
    }
  }

  private resolveSelectedCharacter(
    catalog: CardsSnapshot['catalog'],
    characterId: string | null,
  ) {
    if (!characterId) {
      return null;
    }

    return catalog.find((character) => character.id === characterId) ?? null;
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private async requireAccessToken(): Promise<string> {
    const accessToken = await this.options.authService.ensureAccessToken();

    if (!accessToken) {
      throw new AppApiError('UNAUTHENTICATED', 'No active session is available.');
    }

    return accessToken;
  }
}
