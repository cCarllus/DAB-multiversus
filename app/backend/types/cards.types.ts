import type {
  CharacterCategory,
  CharacterRarity,
} from '../../shared/contracts/cards.contract';

export interface CharacterRecord {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertCharacterCatalogInput {
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
}

export interface UserCharacterRecord {
  id: string;
  userId: string;
  characterId: string;
  level: number;
  unlockedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckRecord {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckCardRecord {
  id: string;
  deckId: string;
  characterId: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}
