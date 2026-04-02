import { Router, type RequestHandler } from 'express';

import type { SocialController } from '../controllers/social.controller';

interface CreateUsersRouterOptions {
  authMiddleware: RequestHandler;
  socialController: SocialController;
}

export function createUsersRouter(options: CreateUsersRouterOptions): Router {
  const router = Router();

  router.get('/global', options.authMiddleware, options.socialController.globalUsers);
  router.get('/search', options.authMiddleware, options.socialController.searchUsers);
  router.get(
    '/:nickname/public-profile',
    options.authMiddleware,
    options.socialController.publicProfile,
  );

  return router;
}

