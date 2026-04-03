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
