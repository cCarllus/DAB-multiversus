import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsRepository } from '../../app/backend/repositories/notifications.repository';
import { ProgressionRepository } from '../../app/backend/repositories/progression.repository';
import { WalletRepository } from '../../app/backend/repositories/wallet.repository';
import { STARTER_SHARDS_AMOUNT } from '../../app/backend/services/wallet.service';
import {
  createNotificationRecord,
  createProgressionRecord,
  createWalletRecord,
  createWalletTransactionRecord,
} from './helpers/player-platform.fixtures';

describe('backend player platform repositories', () => {
  let database: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    database = {
      query: vi.fn(),
    };
  });

  it('maps progression rows and covers creation fallback and update errors', async () => {
    const repository = new ProgressionRepository(database as never);
    const row = {
      created_at: new Date('2026-04-01T00:00:00.000Z'),
      id: 'progression-1',
      level: 3,
      updated_at: new Date('2026-04-02T00:00:00.000Z'),
      user_id: 'user-1',
      xp: 255,
    };

    database.query.mockResolvedValueOnce({ rows: [row] });
    await expect(
      repository.findByUserId('user-1', undefined, {
        forUpdate: true,
      }),
    ).resolves.toMatchObject({
      id: 'progression-1',
      level: 3,
      userId: 'user-1',
      xp: 255,
    });
    expect(database.query.mock.calls[0]?.[0]).toContain('FOR UPDATE');

    database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] });
    await expect(repository.createDefault('user-1')).resolves.toMatchObject({
      id: 'progression-1',
      userId: 'user-1',
    });

    database.query.mockResolvedValueOnce({ rows: [row] });
    await expect(repository.createDefault('user-3')).resolves.toMatchObject({
      id: 'progression-1',
      level: 3,
    });

    database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await expect(repository.createDefault('user-2')).rejects.toThrow(
      'Progression creation did not return a database row.',
    );

    database.query.mockResolvedValueOnce({ rows: [row] });
    await expect(
      repository.updateProgression('user-1', {
        level: 4,
        xp: 400,
      }),
    ).resolves.toMatchObject({
      id: 'progression-1',
      userId: 'user-1',
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.updateProgression('user-1', {
        level: 4,
        xp: 400,
      }),
    ).rejects.toThrow('Progression update did not return a database row.');
  });

  it('maps wallet rows, starter defaults, transactions, and count fallbacks', async () => {
    const repository = new WalletRepository(database as never);
    const walletRow = {
      created_at: new Date('2026-04-01T00:00:00.000Z'),
      id: 'wallet-1',
      shards: STARTER_SHARDS_AMOUNT,
      updated_at: new Date('2026-04-02T00:00:00.000Z'),
      user_id: 'user-1',
    };
    const transactionRow = {
      amount: 80,
      created_at: new Date('2026-04-02T02:00:00.000Z'),
      currency_type: 'shards',
      direction: 'credit',
      id: 'wallet-transaction-1',
      metadata_json: null,
      reason: 'starter_bonus',
      user_id: 'user-1',
    };

    database.query.mockResolvedValueOnce({ rows: [walletRow] });
    await expect(repository.findByUserId('user-1')).resolves.toMatchObject({
      shards: STARTER_SHARDS_AMOUNT,
      userId: 'user-1',
    });

    database.query.mockResolvedValueOnce({ rows: [walletRow] });
    await expect(
      repository.findByUserId('user-1', undefined, {
        forUpdate: true,
      }),
    ).resolves.toMatchObject({
      id: 'wallet-1',
    });
    expect(database.query.mock.calls[1]?.[0]).toContain('FOR UPDATE');

    database.query.mockResolvedValueOnce({ rows: [walletRow] });
    await expect(repository.createDefault('user-1')).resolves.toMatchObject({
      created: true,
      wallet: expect.objectContaining({
        id: 'wallet-1',
      }),
    });

    database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [walletRow] });
    await expect(repository.createDefault('user-2')).resolves.toMatchObject({
      created: false,
      wallet: expect.objectContaining({
        id: 'wallet-1',
      }),
    });

    database.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await expect(repository.createDefault('user-3')).rejects.toThrow(
      'Wallet creation did not return a database row.',
    );

    database.query.mockResolvedValueOnce({ rows: [walletRow] });
    await expect(repository.updateShards('user-1', 620)).resolves.toMatchObject({
      shards: STARTER_SHARDS_AMOUNT,
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.updateShards('user-1', 620)).rejects.toThrow(
      'Wallet update did not return a database row.',
    );

    database.query.mockResolvedValueOnce({ rows: [transactionRow] });
    await expect(
      repository.createTransaction({
        amount: 80,
        currencyType: 'shards',
        direction: 'credit',
        reason: 'starter_bonus',
        userId: 'user-1',
      }),
    ).resolves.toMatchObject({
      currencyType: 'shards',
      metadataJson: null,
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.createTransaction({
        amount: 10,
        currencyType: 'shards',
        direction: 'debit',
        reason: 'purchase',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Wallet transaction creation did not return a database row.');

    database.query.mockResolvedValueOnce({ rows: [transactionRow] });
    await expect(repository.listTransactions('user-1', 10)).resolves.toEqual([
      expect.objectContaining({
        amount: 80,
        reason: 'starter_bonus',
      }),
    ]);

    database.query.mockResolvedValueOnce({ rows: [{ count: '4' }] });
    await expect(repository.countTransactions('user-1')).resolves.toBe(4);

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.countTransactions('user-2')).resolves.toBe(0);
  });

  it('maps notification rows and supports read state queries', async () => {
    const repository = new NotificationsRepository(database as never);
    const row = {
      category: 'system',
      created_at: new Date('2026-04-02T03:00:00.000Z'),
      id: 'notification-1',
      is_read: false,
      message: 'Welcome online.',
      metadata_json: null,
      read_at: null,
      title: 'System message',
      type: 'info',
      user_id: 'user-1',
    };
    const readRow = {
      ...row,
      is_read: true,
      read_at: new Date('2026-04-02T04:00:00.000Z'),
    };

    database.query.mockResolvedValueOnce({ rows: [row] });
    await expect(
      repository.create('user-1', {
        category: 'system',
        message: 'Welcome online.',
        title: 'System message',
        type: 'info',
      }),
    ).resolves.toMatchObject({
      id: 'notification-1',
      isRead: false,
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.create('user-1', {
        category: 'system',
        message: 'Broken',
        title: 'Broken',
        type: 'info',
      }),
    ).rejects.toThrow('Notification creation did not return a database row.');

    database.query.mockResolvedValueOnce({ rows: [row] });
    await expect(repository.listForUser('user-1', 20)).resolves.toEqual([
      expect.objectContaining({
        title: 'System message',
      }),
    ]);

    database.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
    await expect(repository.countForUser('user-1')).resolves.toBe(3);

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.countForUser('user-2')).resolves.toBe(0);

    database.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    await expect(repository.countUnread('user-1')).resolves.toBe(2);

    database.query.mockResolvedValueOnce({ rows: [readRow] });
    await expect(repository.markRead('user-1', 'notification-1')).resolves.toMatchObject({
      isRead: true,
      readAt: readRow.read_at,
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.markRead('user-1', 'missing')).resolves.toBeNull();

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.countUnread('user-2')).resolves.toBe(0);

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.markAllRead('user-1')).resolves.toBeUndefined();
  });
});
