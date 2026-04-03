import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotificationsController } from '../../app/backend/controllers/notifications.controller';
import { createPlayerStateController } from '../../app/backend/controllers/player-state.controller';
import { createMeRouter } from '../../app/backend/routes/me.routes';
import { STARTER_SHARDS_AMOUNT } from '../../app/backend/services/wallet.service';
import { createRequest, createResponse } from '../helpers/backend';

async function flushAsyncHandler(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('backend player platform controllers and routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves player progression, wallet, and wallet transactions through the controller', async () => {
    const progressionService = {
      getProgression: vi.fn(async () => ({
        progression: {
          createdAt: '2026-04-01T00:00:00.000Z',
          level: 3,
          updatedAt: '2026-04-02T00:00:00.000Z',
          xp: 255,
          xpForNextLevel: 150,
          xpIntoCurrentLevel: 5,
        },
      })),
    };
    const walletService = {
      getTransactions: vi.fn(async () => ({
        total: 1,
        transactions: [
          {
            amount: 80,
            createdAt: '2026-04-02T02:00:00.000Z',
            currencyType: 'shards',
            direction: 'credit',
            id: 'wallet-transaction-1',
            metadataJson: null,
            reason: 'starter_bonus',
          },
        ],
      })),
      getWallet: vi.fn(async () => ({
        wallet: {
          createdAt: '2026-04-01T00:00:00.000Z',
          shards: STARTER_SHARDS_AMOUNT,
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
      })),
    };
    const controller = createPlayerStateController(
      progressionService as never,
      walletService as never,
    );
    const response = createResponse();
    const next = vi.fn();

    controller.meProgression(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(response.status).toHaveBeenLastCalledWith(200);
    expect(response.json).toHaveBeenLastCalledWith({
      progression: expect.objectContaining({
        level: 3,
      }),
    });

    controller.meWallet(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(walletService.getWallet).toHaveBeenCalledWith('user-1');

    controller.meWalletTransactions(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
        query: {
          limit: '15',
        },
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(walletService.getTransactions).toHaveBeenCalledWith('user-1', 15);

    controller.meWalletTransactions(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
        query: {
          limit: '0',
        },
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(next).toHaveBeenCalled();
  });

  it('serves notifications lifecycle actions through the controller', async () => {
    const notificationsService = {
      getUnreadCount: vi.fn(async () => ({
        unreadCount: 2,
      })),
      listNotifications: vi.fn(async () => ({
        notifications: [
          {
            category: 'reward',
            createdAt: '2026-04-02T03:00:00.000Z',
            id: 'notification-1',
            isRead: false,
            message: 'Reward granted.',
            metadataJson: null,
            readAt: null,
            title: 'Reward unlocked',
            type: 'success',
          },
        ],
        total: 1,
      })),
      markAllRead: vi.fn(async () => ({
        unreadCount: 0,
      })),
      markRead: vi.fn(async () => ({
        category: 'reward',
        createdAt: '2026-04-02T03:00:00.000Z',
        id: 'notification-1',
        isRead: true,
        message: 'Reward granted.',
        metadataJson: null,
        readAt: '2026-04-02T04:00:00.000Z',
        title: 'Reward unlocked',
        type: 'success',
      })),
    };
    const controller = createNotificationsController(notificationsService as never);
    const response = createResponse();
    const next = vi.fn();

    controller.listMine(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
        query: {
          limit: '10',
        },
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(notificationsService.listNotifications).toHaveBeenCalledWith('user-1', 10);

    controller.markRead(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
        params: {
          notificationId: '6ed6c420-1d64-4f1b-afad-a1310f734111',
        },
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(notificationsService.markRead).toHaveBeenCalledWith(
      'user-1',
      '6ed6c420-1d64-4f1b-afad-a1310f734111',
    );

    controller.markAllRead(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(notificationsService.markAllRead).toHaveBeenCalledWith('user-1');

    controller.unreadCount(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-1');

    controller.markRead(
      createRequest({
        authContext: {
          userId: 'user-1',
        } as never,
        params: {
          notificationId: 'bad-id',
        },
      }),
      response,
      next,
    );
    await flushAsyncHandler();
    expect(next).toHaveBeenCalled();
  });

  it('wires all player platform endpoints through the me router', async () => {
    const authMiddleware = vi.fn((req, _res, next) => {
      req.authContext = {
        userId: 'user-1',
      } as never;
      next();
    });
    const notificationsController = {
      listMine: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'notifications',
        });
      }),
      markAllRead: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'notifications-read-all',
        });
      }),
      markRead: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'notifications-read',
        });
      }),
      unreadCount: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'notifications-unread',
        });
      }),
    };
    const playerStateController = {
      meProgression: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'progression',
        });
      }),
      meWallet: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'wallet',
        });
      }),
      meWalletTransactions: vi.fn((_req, res) => {
        res.status(200).json({
          route: 'wallet-transactions',
        });
      }),
    };
    const app = express();
    app.use(
      '/me',
      createMeRouter({
        authMiddleware,
        notificationsController: notificationsController as never,
        playerStateController: playerStateController as never,
      }),
    );

    await request(app).get('/me/progression').expect(200, {
      route: 'progression',
    });
    await request(app).get('/me/wallet').expect(200, {
      route: 'wallet',
    });
    await request(app).get('/me/wallet/transactions').expect(200, {
      route: 'wallet-transactions',
    });
    await request(app).get('/me/notifications').expect(200, {
      route: 'notifications',
    });
    await request(app)
      .patch('/me/notifications/6ed6c420-1d64-4f1b-afad-a1310f734111/read')
      .expect(200, {
        route: 'notifications-read',
      });
    await request(app).patch('/me/notifications/read-all').expect(200, {
      route: 'notifications-read-all',
    });
    await request(app).get('/me/notifications/unread-count').expect(200, {
      route: 'notifications-unread',
    });

    expect(authMiddleware).toHaveBeenCalledTimes(7);
  });
});
