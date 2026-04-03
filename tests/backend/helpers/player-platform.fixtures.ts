import type {
  CharacterRecord,
  DeckCardRecord,
  DeckRecord,
  UserCharacterRecord,
} from '../../../app/backend/types/cards.types';
import type { NotificationRecord } from '../../../app/backend/types/notifications.types';
import type { ProgressionRecord } from '../../../app/backend/types/progression.types';
import type {
  WalletRecord,
  WalletTransactionRecord,
} from '../../../app/backend/types/wallet.types';
import { STARTER_SHARDS_AMOUNT } from '../../../app/backend/services/wallet.service';

export function createProgressionRecord(
  overrides: Partial<ProgressionRecord> = {},
): ProgressionRecord {
  return {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    id: 'progression-1',
    level: 1,
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    userId: 'user-1',
    xp: 0,
    ...overrides,
  };
}

export function createCharacterRecord(
  overrides: Partial<CharacterRecord> = {},
): CharacterRecord {
  return {
    category: 'strength',
    costMana: 4,
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    fullLore: 'A veteran of a hundred sieges.',
    id: 'character-1',
    imageUrl: '/uploads/characters/strength-portrait.svg',
    isActive: true,
    isDefaultUnlocked: false,
    name: 'Grommash',
    rarity: 'rare',
    releaseOrder: 1,
    shortDescription: 'Frontline pressure.',
    shortLore: 'Forged in war.',
    slug: 'grommash',
    unlockPriceShards: 140,
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function createUserCharacterRecord(
  overrides: Partial<UserCharacterRecord> = {},
): UserCharacterRecord {
  return {
    characterId: 'character-1',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    id: 'user-character-1',
    level: 1,
    unlockedAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    userId: 'user-1',
    ...overrides,
  };
}

export function createDeckRecord(
  overrides: Partial<DeckRecord> = {},
): DeckRecord {
  return {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    id: 'deck-1',
    isActive: true,
    name: 'Primary Loadout',
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    userId: 'user-1',
    ...overrides,
  };
}

export function createDeckCardRecord(
  overrides: Partial<DeckCardRecord> = {},
): DeckCardRecord {
  return {
    characterId: 'character-1',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    deckId: 'deck-1',
    id: 'deck-card-1',
    position: 1,
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    ...overrides,
  };
}

export function createWalletRecord(overrides: Partial<WalletRecord> = {}): WalletRecord {
  return {
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    id: 'wallet-1',
    shards: STARTER_SHARDS_AMOUNT,
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    userId: 'user-1',
    ...overrides,
  };
}

export function createWalletTransactionRecord(
  overrides: Partial<WalletTransactionRecord> = {},
): WalletTransactionRecord {
  return {
    amount: 120,
    createdAt: new Date('2026-04-02T01:00:00.000Z'),
    currencyType: 'shards',
    direction: 'credit',
    id: 'wallet-transaction-1',
    metadataJson: {
      source: 'quest',
    },
    reason: 'reward_claim',
    userId: 'user-1',
    ...overrides,
  };
}

export function createNotificationRecord(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    category: 'reward',
    createdAt: new Date('2026-04-02T03:00:00.000Z'),
    id: 'notification-1',
    isRead: false,
    message: 'Reward granted.',
    metadataJson: {
      shards: 120,
    },
    readAt: null,
    title: 'Reward unlocked',
    type: 'success',
    userId: 'user-1',
    ...overrides,
  };
}
