import { Router, type RequestHandler } from 'express';

import type { ChatController } from '../controllers/chat.controller';

interface CreateChatRouterOptions {
  authMiddleware: RequestHandler;
  chatController: ChatController;
}

export function createChatRouter(options: CreateChatRouterOptions): Router {
  const router = Router();

  router.get('/global/history', options.authMiddleware, options.chatController.globalHistory);

  return router;
}
