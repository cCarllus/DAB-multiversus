import { Router, type RequestHandler } from 'express';

import type { NotificationsController } from '../controllers/notifications.controller';
import type { PlayerStateController } from '../controllers/player-state.controller';

interface CreateMeRouterOptions {
  authMiddleware: RequestHandler;
  notificationsController: NotificationsController;
  playerStateController: PlayerStateController;
}

export function createMeRouter(options: CreateMeRouterOptions): Router {
  const router = Router();

  router.get('/progression', options.authMiddleware, options.playerStateController.meProgression);
  router.get('/wallet', options.authMiddleware, options.playerStateController.meWallet);
  router.get(
    '/wallet/transactions',
    options.authMiddleware,
    options.playerStateController.meWalletTransactions,
  );
  router.get('/notifications', options.authMiddleware, options.notificationsController.listMine);
  router.patch(
    '/notifications/:notificationId/read',
    options.authMiddleware,
    options.notificationsController.markRead,
  );
  router.patch(
    '/notifications/read-all',
    options.authMiddleware,
    options.notificationsController.markAllRead,
  );
  router.get(
    '/notifications/unread-count',
    options.authMiddleware,
    options.notificationsController.unreadCount,
  );

  return router;
}
