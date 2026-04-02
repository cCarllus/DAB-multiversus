import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { asyncHandler } from '../lib/async-handler';
import { SocialService } from '../services/social.service';
import { updatePresenceSchema } from '../validators/social.validator';

export interface PresenceController {
  updateMe: RequestHandler;
}

export function createPresenceController(socialService: SocialService): PresenceController {
  return {
    updateMe: asyncHandler(async (request, response) => {
      if (!request.authContext) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      const payload = updatePresenceSchema.parse(request.body ?? {});
      const presence = await socialService.updatePresence(request.authContext.userId, payload);

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
