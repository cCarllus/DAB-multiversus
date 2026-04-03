import type { PlayerWallet, WalletTransaction } from './wallet.contract';

export const CHARACTER_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export const CHARACTER_CATEGORIES = ['strength', 'agility', 'intelligence'] as const;
export const CARD_STATUS_VALUES = ['locked', 'unlocked', 'in_deck', 'inactive'] as const;
export const ACTIVE_DECK_MAX_SLOTS = 8;

export type CharacterRarity = (typeof CHARACTER_RARITIES)[number];
export type CharacterCategory = (typeof CHARACTER_CATEGORIES)[number];
export type CharacterCardStatus = (typeof CARD_STATUS_VALUES)[number];

export interface CharacterCatalogEntry {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  shortLore: string;
  fullLore: string;
  imageUrl: string | null;
  rarity: CharacterRarity;
  category: CharacterCategory;
  costMana: number;
  unlockPriceShards: number;
  isActive: boolean;
  isDefaultUnlocked: boolean;
  releaseOrder: number;
  createdAt: string;
  updatedAt: string;
  isUnlocked: boolean;
  level: number | null;
  unlockedAt: string | null;
  inDeck: boolean;
  status: CharacterCardStatus;
}

export interface CharacterCatalogResponse {
  characters: CharacterCatalogEntry[];
  maxDeckSlots: number;
}

export interface CharacterDetailResponse {
  character: CharacterCatalogEntry;
}

export interface UnlockCharacterResponse {
  character: CharacterCatalogEntry;
  transaction: WalletTransaction;
  wallet: PlayerWallet;
}

export interface PlayerDeckCard {
  position: number;
  character: CharacterCatalogEntry;
}

export interface PlayerDeck {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  maxSlots: number;
  cards: PlayerDeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckResponse {
  deck: PlayerDeck;
}

export interface SaveDeckRequest {
  cards: string[];
}

export interface SaveDeckResponse {
  deck: PlayerDeck;
}
