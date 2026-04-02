import { Router, type RequestHandler } from 'express';

import type { AuthController } from '../controllers/auth.controller';

interface CreateAuthRouterOptions {
  authController: AuthController;
  authMiddleware: RequestHandler;
  optionalAuthMiddleware: RequestHandler;
}

export function createAuthRouter(options: CreateAuthRouterOptions): Router {
  const router = Router();

  router.post('/register', options.authController.register);
  router.post('/login', options.authController.login);
  router.post('/refresh', options.authController.refresh);
  router.post('/logout', options.optionalAuthMiddleware, options.authController.logout);
  router.get('/me', options.authMiddleware, options.authController.me);

  return router;
}
