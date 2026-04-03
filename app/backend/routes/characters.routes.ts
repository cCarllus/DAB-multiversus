import { Router, type RequestHandler } from 'express';

import type { CharactersController } from '../controllers/characters.controller';

interface CreateCharactersRouterOptions {
  authMiddleware: RequestHandler;
  charactersController: CharactersController;
}

export function createCharactersRouter(options: CreateCharactersRouterOptions): Router {
  const router = Router();

  router.get('/', options.authMiddleware, options.charactersController.list);
  router.get('/:slug', options.authMiddleware, options.charactersController.detail);
  router.post('/:characterId/unlock', options.authMiddleware, options.charactersController.unlock);

  return router;
}
