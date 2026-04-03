import { Router, type RequestHandler } from 'express';

import type { DeckController } from '../controllers/deck.controller';

interface CreateDeckRouterOptions {
  authMiddleware: RequestHandler;
  deckController: DeckController;
}

export function createDeckRouter(options: CreateDeckRouterOptions): Router {
  const router = Router();

  router.get('/', options.authMiddleware, options.deckController.getActiveDeck);
  router.post('/', options.authMiddleware, options.deckController.saveActiveDeck);

  return router;
}
