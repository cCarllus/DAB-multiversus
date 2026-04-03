import { BackendApiClient } from '@frontend/services/api/backend-api-client';

import type {
  CharacterCatalogEntry,
  CharacterCatalogResponse,
  CharacterDetailResponse,
  DeckResponse,
  SaveDeckRequest,
  UnlockCharacterResponse,
} from './cards-types';

const CARDS_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_CARDS_ERROR',
  failureMessage: 'Character request failed.',
  networkMessage: 'The launcher could not reach the character service.',
} as const;

function resolveCharacterAssetUrls(
  client: BackendApiClient,
  character: CharacterCatalogEntry,
): CharacterCatalogEntry {
  return {
    ...character,
    imageUrl: client.resolveAssetUrl(character.imageUrl),
  };
}

export class CardsApiClient extends BackendApiClient {
  async getCatalog(accessToken: string): Promise<CharacterCatalogResponse> {
    const response = await this.request<CharacterCatalogResponse>(
      '/characters',
      {
        accessToken,
        method: 'GET',
      },
      CARDS_REQUEST_MESSAGES,
    );

    return {
      ...response,
      characters: response.characters.map((character) => resolveCharacterAssetUrls(this, character)),
    };
  }

  async getCharacterDetail(accessToken: string, slug: string): Promise<CharacterCatalogEntry> {
    const response = await this.request<CharacterDetailResponse>(
      `/characters/${encodeURIComponent(slug)}`,
      {
        accessToken,
        method: 'GET',
      },
      CARDS_REQUEST_MESSAGES,
    );

    return resolveCharacterAssetUrls(this, response.character);
  }

  async unlockCharacter(accessToken: string, characterId: string): Promise<UnlockCharacterResponse> {
    const response = await this.request<UnlockCharacterResponse>(
      `/characters/${encodeURIComponent(characterId)}/unlock`,
      {
        accessToken,
        method: 'POST',
      },
      CARDS_REQUEST_MESSAGES,
    );

    return {
      ...response,
      character: resolveCharacterAssetUrls(this, response.character),
    };
  }

  async getDeck(accessToken: string) {
    const response = await this.request<DeckResponse>(
      '/deck',
      {
        accessToken,
        method: 'GET',
      },
      CARDS_REQUEST_MESSAGES,
    );

    return {
      ...response.deck,
      cards: response.deck.cards.map((deckCard) => ({
        ...deckCard,
        character: resolveCharacterAssetUrls(this, deckCard.character),
      })),
    };
  }

  async saveDeck(accessToken: string, payload: SaveDeckRequest) {
    const response = await this.request<DeckResponse>(
      '/deck',
      {
        accessToken,
        body: JSON.stringify(payload),
        method: 'POST',
      },
      CARDS_REQUEST_MESSAGES,
    );

    return {
      ...response.deck,
      cards: response.deck.cards.map((deckCard) => ({
        ...deckCard,
        character: resolveCharacterAssetUrls(this, deckCard.character),
      })),
    };
  }
}
