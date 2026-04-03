import type {
  CharacterCatalogEntry,
  CharacterCategory,
  CharacterDetailResponse,
  CharacterRarity,
  CharacterCatalogResponse,
  DeckResponse,
  PlayerDeck,
  SaveDeckRequest,
  SaveDeckResponse,
  UnlockCharacterResponse,
} from '@shared/contracts/cards.contract';

export type {
  CharacterCatalogEntry,
  CharacterCatalogResponse,
  CharacterCategory,
  CharacterDetailResponse,
  CharacterRarity,
  DeckResponse,
  PlayerDeck,
  SaveDeckRequest,
  SaveDeckResponse,
  UnlockCharacterResponse,
};

export type CardsFilter = 'all' | CharacterCategory;

export interface CardsSnapshot {
  catalog: CharacterCatalogEntry[];
  deck: PlayerDeck | null;
  isDetailLoading: boolean;
  isLoading: boolean;
  isSavingDeck: boolean;
  maxDeckSlots: number;
  selectedCharacter: CharacterCatalogEntry | null;
  unlockingCharacterId: string | null;
}
