import { Router, type RequestHandler } from 'express';

import type { PresenceController } from '../controllers/presence.controller';

interface CreatePresenceRouterOptions {
  authMiddleware: RequestHandler;
  presenceController: PresenceController;
}

export function createPresenceRouter(options: CreatePresenceRouterOptions): Router {
  const router = Router();

  router.patch('/me', options.authMiddleware, options.presenceController.updateMe);

  return router;
}

