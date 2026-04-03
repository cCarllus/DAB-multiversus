import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postgresState = vi.hoisted(() => ({
  client: {
    query: vi.fn(),
  },
  dbPool: {
    query: vi.fn(),
  },
  withTransaction: vi.fn(
    async (handler: (client: typeof postgresState.client) => Promise<unknown>) =>
      handler(postgresState.client),
  ),
}));

vi.mock('../../app/backend/lib/postgres', () => ({
  dbPool: postgresState.dbPool,
  withTransaction: postgresState.withTransaction,
}));

import { AppError } from '../../app/backend/lib/app-error';
import { NotificationsRealtimeGateway } from '../../app/backend/services/notifications-realtime.gateway';
import { NotificationsService } from '../../app/backend/services/notifications.service';
import { PlayerAccountBootstrapService } from '../../app/backend/services/player-account-bootstrap.service';
import { ProgressionService } from '../../app/backend/services/progression.service';
import { STARTER_SHARDS_AMOUNT, WalletService } from '../../app/backend/services/wallet.service';
import type { WalletTransactionRecord } from '../../app/backend/types/wallet.types';
import {
  createNotificationRecord,
  createProgressionRecord,
  createWalletRecord,
  createWalletTransactionRecord,
} from './helpers/player-platform.fixtures';

describe('backend player platform services', () => {
  beforeEach(() => {
    postgresState.withTransaction.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ensures and returns default progression state', async () => {
    const progressionRepository = {
      createDefault: vi.fn(async () => createProgressionRecord()),
      findByUserId: vi.fn(async () => null),
    };
    const service = new ProgressionService(progressionRepository as never);

    const result = await service.getProgression('user-1');

    expect(postgresState.withTransaction).toHaveBeenCalledTimes(1);
    expect(progressionRepository.findByUserId).toHaveBeenCalledWith(
      'user-1',
      postgresState.client,
      {
        forUpdate: true,
      },
    );
    expect(progressionRepository.createDefault).toHaveBeenCalledWith(
      'user-1',
      postgresState.client,
    );
    expect(result.progression).toMatchObject({
      level: 1,
      xp: 0,
      xpForNextLevel: 100,
      xpIntoCurrentLevel: 0,
    });
  });

  it('returns the current level and grants xp without leveling up', async () => {
    const progressionRepository = {
      createDefault: vi.fn(),
      findByUserId: vi.fn(async () =>
        createProgressionRecord({
          level: 1,
          xp: 25,
        })),
      updateProgression: vi.fn(async (_userId: string, input: { level: number; xp: number }) =>
        createProgressionRecord({
          level: input.level,
          updatedAt: new Date('2026-04-02T05:00:00.000Z'),
          xp: input.xp,
        })),
    };
    const notificationsService = {
      createAndPublish: vi.fn(),
    };
    const service = new ProgressionService(
      progressionRepository as never,
      notificationsService as never,
    );

    await expect(service.getCurrentLevel('user-1')).resolves.toBe(1);
    await expect(
      service.grantXp('user-1', {
        amount: 40,
        source: 'login_reward',
      }),
    ).resolves.toMatchObject({
      progression: {
        level: 1,
        xp: 65,
        xpForNextLevel: 100,
        xpIntoCurrentLevel: 65,
      },
    });
    expect(progressionRepository.updateProgression).toHaveBeenCalledWith(
      'user-1',
      {
        level: 1,
        xp: 65,
      },
      postgresState.client,
    );
    expect(notificationsService.createAndPublish).not.toHaveBeenCalled();
  });

  it('exposes ensureProgression directly when bootstrap code needs a transaction-scoped record', async () => {
    const progressionRepository = {
      createDefault: vi.fn(),
      findByUserId: vi.fn(async () =>
        createProgressionRecord({
          level: 5,
          xp: 725,
        })),
    };
    const service = new ProgressionService(progressionRepository as never);

    await expect(
      service.ensureProgression('user-1', postgresState.client as never),
    ).resolves.toMatchObject({
      level: 5,
      xp: 725,
    });
  });

  it('publishes a level-up notification when granted xp crosses a level threshold', async () => {
    const progressionRepository = {
      findByUserId: vi.fn(async () =>
        createProgressionRecord({
          level: 1,
          xp: 80,
        })),
      updateProgression: vi.fn(async () =>
        createProgressionRecord({
          level: 2,
          updatedAt: new Date('2026-04-02T06:00:00.000Z'),
          xp: 140,
        })),
    };
    const notificationsService = {
      createAndPublish: vi.fn(async () => undefined),
    };
    const service = new ProgressionService(
      progressionRepository as never,
      notificationsService as never,
    );

    const result = await service.grantXp('user-1', {
      amount: 60,
      source: 'match_won',
    });

    expect(result.progression).toMatchObject({
      level: 2,
      xp: 140,
      xpForNextLevel: 125,
      xpIntoCurrentLevel: 40,
    });
    expect(notificationsService.createAndPublish).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        category: 'progression',
        metadataJson: {
          level: 2,
          source: 'match_won',
          xpGranted: 60,
        },
        title: 'Level 2 unlocked',
        type: 'success',
      }),
    );
  });

  it('creates starter wallet transactions only once and returns transaction history', async () => {
    const walletRepository = {
      countTransactions: vi.fn(async () => 2),
      createDefault: vi.fn(async () => ({
        created: true,
        wallet: createWalletRecord(),
      })),
      createTransaction: vi.fn(async () =>
        createWalletTransactionRecord({
          reason: 'starter_bonus',
        })),
      findByUserId: vi.fn(async () => null),
      listTransactions: vi.fn(async () => [createWalletTransactionRecord()]),
      updateShards: vi.fn(),
    };
    const service = new WalletService(walletRepository as never);

    await expect(service.ensureWallet('user-1', postgresState.client as never)).resolves.toMatchObject({
      id: 'wallet-1',
      shards: STARTER_SHARDS_AMOUNT,
    });
    expect(walletRepository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: STARTER_SHARDS_AMOUNT,
        direction: 'credit',
        metadataJson: {
          source: 'account_creation',
        },
        reason: 'starter_bonus',
        userId: 'user-1',
      }),
      postgresState.client,
    );

    await expect(service.getTransactions('user-1', 25)).resolves.toMatchObject({
      total: 2,
      transactions: [
        expect.objectContaining({
          amount: 120,
          currencyType: 'shards',
        }),
      ],
    });
  });

  it('returns wallet state, applies shard updates, and blocks overdrafts', async () => {
    const walletRepository = {
      createDefault: vi.fn(),
      createTransaction: vi.fn(async (input: { amount: number; direction: 'credit' | 'debit'; reason: string }) =>
        createWalletTransactionRecord({
          amount: input.amount,
          direction: input.direction,
          metadataJson: null,
          reason: input.reason as WalletTransactionRecord['reason'],
        })),
      findByUserId: vi.fn(async () =>
        createWalletRecord({
          shards: 500,
        })),
      updateShards: vi.fn(async (_userId: string, shards: number) =>
        createWalletRecord({
          shards,
          updatedAt: new Date('2026-04-02T07:00:00.000Z'),
        })),
    };
    const service = new WalletService(walletRepository as never);

    await expect(service.getWallet('user-1')).resolves.toMatchObject({
      wallet: {
        shards: 500,
      },
    });

    await expect(
      service.applyShardTransaction('user-1', {
        amount: 125,
        direction: 'credit',
        reason: 'event_reward',
      }),
    ).resolves.toMatchObject({
      transaction: {
        amount: 125,
        direction: 'credit',
        reason: 'event_reward',
      },
      wallet: {
        shards: 625,
      },
    });

    walletRepository.findByUserId.mockResolvedValueOnce(
      createWalletRecord({
        shards: 40,
      }),
    );
    await expect(
      service.applyShardTransaction('user-1', {
        amount: 50,
        direction: 'debit',
        reason: 'purchase',
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[AppError: You do not have enough shards for this transaction.]`,
    );
    expect(walletRepository.updateShards).toHaveBeenCalledTimes(1);
  });

  it('skips the starter-bonus ledger write when the wallet already exists', async () => {
    const walletRepository = {
      createDefault: vi.fn(async () => ({
        created: false,
        wallet: createWalletRecord({
          shards: 820,
        }),
      })),
      createTransaction: vi.fn(),
      findByUserId: vi.fn(async () => null),
    };
    const service = new WalletService(walletRepository as never);

    await expect(service.ensureWallet('user-1', postgresState.client as never)).resolves.toMatchObject({
      shards: 820,
    });
    expect(walletRepository.createTransaction).not.toHaveBeenCalled();
  });

  it('lists notifications, publishes delivery and state changes, and handles missing notifications', async () => {
    const notificationsRepository = {
      countForUser: vi.fn(async () => 3),
      countUnread: vi.fn(async () => 2),
      create: vi.fn(async () => createNotificationRecord()),
      listForUser: vi.fn(async () => [createNotificationRecord()]),
      markAllRead: vi.fn(async () => undefined),
      markRead: vi.fn(async () =>
        createNotificationRecord({
          isRead: true,
          readAt: new Date('2026-04-02T04:00:00.000Z'),
        })),
    };
    const realtimeGateway = {
      publishDelivered: vi.fn(),
      publishState: vi.fn(),
    };
    const service = new NotificationsService(
      notificationsRepository as never,
      realtimeGateway as never,
    );

    await expect(service.listNotifications('user-1', 20)).resolves.toMatchObject({
      total: 3,
      notifications: [
        expect.objectContaining({
          id: 'notification-1',
          readAt: null,
        }),
      ],
    });
    await expect(service.getUnreadCount('user-1')).resolves.toEqual({
      unreadCount: 2,
    });
    await expect(
      service.createNotification('user-1', {
        category: 'system',
        message: 'Online now.',
        title: 'Presence',
        type: 'info',
      }),
    ).resolves.toMatchObject({
      message: 'Reward granted.',
    });
    await expect(
      service.createAndPublish('user-1', {
        category: 'reward',
        message: 'Reward granted.',
        title: 'Reward unlocked',
        type: 'success',
      }),
    ).resolves.toMatchObject({
      id: 'notification-1',
    });
    expect(realtimeGateway.publishDelivered).toHaveBeenCalledWith('user-1', {
      notification: expect.objectContaining({
        id: 'notification-1',
      }),
      unreadCount: 2,
    });

    await expect(service.markRead('user-1', 'notification-1')).resolves.toMatchObject({
      isRead: true,
      readAt: '2026-04-02T04:00:00.000Z',
    });
    expect(realtimeGateway.publishState).toHaveBeenCalledWith('user-1', {
      unreadCount: 2,
    });

    notificationsRepository.markRead.mockResolvedValueOnce(null);
    await expect(service.markRead('user-1', 'missing')).rejects.toThrowError(AppError);

    notificationsRepository.countUnread.mockResolvedValueOnce(0);
    await expect(service.markAllRead('user-1')).resolves.toEqual({
      unreadCount: 0,
    });
  });

  it('broadcasts realtime notification payloads only to active listeners', () => {
    const gateway = new NotificationsRealtimeGateway();
    const firstListener = {
      onDelivered: vi.fn(),
      onState: vi.fn(),
    };
    const secondListener = {
      onDelivered: vi.fn(),
      onState: vi.fn(),
    };

    const disposeFirst = gateway.registerConnection('user-1', firstListener);
    const disposeSecondSameUser = gateway.registerConnection('user-1', secondListener);

    gateway.publishDelivered('user-1', {
      notification: {
        category: 'system',
        createdAt: '2026-04-02T03:00:00.000Z',
        id: 'notification-1',
        isRead: false,
        message: 'Welcome.',
        metadataJson: null,
        readAt: null,
        title: 'Welcome',
        type: 'info',
      },
      unreadCount: 1,
    });
    gateway.publishState('user-1', {
      unreadCount: 3,
    });

    expect(firstListener.onDelivered).toHaveBeenCalledTimes(1);
    expect(firstListener.onState).toHaveBeenCalledWith({
      unreadCount: 3,
    });
    expect(secondListener.onDelivered).toHaveBeenCalledTimes(1);
    expect(secondListener.onState).toHaveBeenCalledWith({
      unreadCount: 3,
    });

    disposeFirst();
    gateway.publishDelivered('user-1', {
      notification: {
        category: 'system',
        createdAt: '2026-04-02T03:00:00.000Z',
        id: 'notification-1',
        isRead: false,
        message: 'Welcome.',
        metadataJson: null,
        readAt: null,
        title: 'Welcome',
        type: 'info',
      },
      unreadCount: 2,
    });

    expect(firstListener.onDelivered).toHaveBeenCalledTimes(1);
    expect(secondListener.onDelivered).toHaveBeenCalledTimes(2);

    disposeSecondSameUser();
    disposeSecondSameUser();
  });

  it('bootstraps progression, wallet, and welcome notifications for new accounts', async () => {
    const progressionService = {
      ensureProgression: vi.fn(async () => createProgressionRecord()),
    };
    const walletService = {
      ensureWallet: vi.fn(async () => createWalletRecord()),
    };
    const notificationsService = {
      createNotification: vi.fn(async () => createNotificationRecord()),
    };
    const service = new PlayerAccountBootstrapService(
      progressionService as never,
      walletService as never,
      notificationsService as never,
    );

    await service.initializeNewAccount('user-1', postgresState.client as never);

    expect(progressionService.ensureProgression).toHaveBeenCalledWith(
      'user-1',
      postgresState.client,
    );
    expect(walletService.ensureWallet).toHaveBeenCalledWith('user-1', postgresState.client);
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        category: 'account',
        metadataJson: {
          shardsGranted: 500,
          welcome: true,
        },
        title: 'Welcome to Dead As Battle',
        type: 'success',
      }),
      postgresState.client,
    );
  });
});
