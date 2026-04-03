import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { SocialService } from '../services/social.service';
import { updatePresenceSchema } from '../validators/social.validator';
import { requireAuthContext } from './controller-auth';

export interface PresenceController {
  updateMe: RequestHandler;
}

export function createPresenceController(socialService: SocialService): PresenceController {
  return {
    updateMe: asyncHandler(async (request, response) => {
      const authContext = requireAuthContext(request);
      const payload = updatePresenceSchema.parse(request.body ?? {});
      const presence = await socialService.updatePresence(authContext.userId, payload);

      response.status(200).json({
        presence: {
          currentActivity: presence.currentActivity,
          lastSeenAt: presence.lastSeenAt.toISOString(),
          status: presence.status,
        },
      });
    }),
  };
}
