import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { asyncHandler } from '../lib/async-handler';
import { type ProfileService } from '../services/profile.service';
import { updateProfileRequestSchema } from '../validators/profile.validator';
import { requireAuthContext } from './controller-auth';

export interface ProfileController {
  devices: RequestHandler;
  me: RequestHandler;
  updateMe: RequestHandler;
  uploadAvatar: RequestHandler;
}

export function createProfileController(profileService: ProfileService): ProfileController {
  return {
    me: asyncHandler(async (request, response) => {
      const authContext = requireAuthContext(request);
      const profile = await profileService.getCurrentProfile(authContext.userId);
      response.status(200).json({
        profile,
      });
    }),

    updateMe: asyncHandler(async (request, response) => {
      const authContext = requireAuthContext(request);
      const payload = updateProfileRequestSchema.parse(request.body);
      const profile = await profileService.updateProfileName(authContext.userId, payload.name);
      response.status(200).json({
        profile,
      });
    }),

    uploadAvatar: asyncHandler(async (request, response) => {
      const authContext = requireAuthContext(request);

      if (!request.file) {
        throw new AppError(400, 'AVATAR_REQUIRED', 'Choose an image before updating your photo.');
      }

      const profile = await profileService.updateProfileAvatar(authContext.userId, {
        buffer: request.file.buffer,
        mimetype: request.file.mimetype,
        originalName: request.file.originalname,
      });

      response.status(200).json({
        profile,
      });
    }),

    devices: asyncHandler(async (request, response) => {
      const authContext = requireAuthContext(request);
      const currentDeviceId = request.header('X-Launcher-Device-Id')?.trim();
      const devices = await profileService.getProfileDevices(
        authContext.userId,
        currentDeviceId || undefined,
      );

      response.status(200).json(devices);
    }),
  };
}
