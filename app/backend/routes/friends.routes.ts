import { Router, type RequestHandler } from 'express';

import type { SocialController } from '../controllers/social.controller';

interface CreateFriendsRouterOptions {
  authMiddleware: RequestHandler;
  socialController: SocialController;
}

export function createFriendsRouter(options: CreateFriendsRouterOptions): Router {
  const router = Router();

  router.get('/', options.authMiddleware, options.socialController.friends);
  router.get(
    '/requests/incoming',
    options.authMiddleware,
    options.socialController.incomingRequests,
  );
  router.get(
    '/requests/outgoing',
    options.authMiddleware,
    options.socialController.outgoingRequests,
  );
  router.post('/request', options.authMiddleware, options.socialController.sendFriendRequest);
  router.post(
    '/:requestId/accept',
    options.authMiddleware,
    options.socialController.acceptFriendRequest,
  );
  router.post(
    '/:requestId/reject',
    options.authMiddleware,
    options.socialController.rejectFriendRequest,
  );
  router.delete(
    '/requests/:requestId',
    options.authMiddleware,
    options.socialController.cancelOutgoingRequest,
  );
  router.delete('/:friendshipId', options.authMiddleware, options.socialController.removeFriend);

  return router;
}

