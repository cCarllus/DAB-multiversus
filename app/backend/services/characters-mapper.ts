import type { CharacterCatalogEntry } from '../../shared/contracts/cards.contract';
import type { CharacterRecord, UserCharacterRecord } from '../types/cards.types';

export function mapCharacterCatalogEntry(
  character: CharacterRecord,
  ownership: UserCharacterRecord | null,
  inDeck: boolean,
): CharacterCatalogEntry {
  const isUnlocked = ownership !== null;
  const status = !character.isActive
    ? 'inactive'
    : inDeck
      ? 'in_deck'
      : isUnlocked
        ? 'unlocked'
        : 'locked';

  return {
    id: character.id,
    name: character.name,
    slug: character.slug,
    shortDescription: character.shortDescription,
    shortLore: character.shortLore,
    fullLore: character.fullLore,
    imageUrl: character.imageUrl,
    rarity: character.rarity,
    category: character.category,
    costMana: character.costMana,
    unlockPriceShards: character.unlockPriceShards,
    isActive: character.isActive,
    isDefaultUnlocked: character.isDefaultUnlocked,
    releaseOrder: character.releaseOrder,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
    isUnlocked,
    level: ownership?.level ?? null,
    unlockedAt: ownership?.unlockedAt.toISOString() ?? null,
    inDeck,
    status,
  };
}
