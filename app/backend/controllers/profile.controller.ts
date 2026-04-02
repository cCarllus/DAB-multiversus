import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { asyncHandler } from '../lib/async-handler';
import { type ProfileService } from '../services/profile.service';
import { updateProfileRequestSchema } from '../validators/profile.validator';

export interface ProfileController {
  devices: RequestHandler;
  me: RequestHandler;
  updateMe: RequestHandler;
  uploadAvatar: RequestHandler;
}

export function createProfileController(profileService: ProfileService): ProfileController {
  return {
    me: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      const profile = await profileService.getCurrentProfile(request.auth.userId);
      response.status(200).json({
        profile,
      });
    }),

    updateMe: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      const payload = updateProfileRequestSchema.parse(request.body);
      const profile = await profileService.updateProfileName(request.auth.userId, payload.name);
      response.status(200).json({
        profile,
      });
    }),

    uploadAvatar: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      if (!request.file) {
        throw new AppError(400, 'AVATAR_REQUIRED', 'Choose an image before updating your photo.');
      }

      const profile = await profileService.updateProfileAvatar(request.auth.userId, {
        buffer: request.file.buffer,
        mimetype: request.file.mimetype,
        originalName: request.file.originalname,
      });

      response.status(200).json({
        profile,
      });
    }),

    devices: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      const currentDeviceId = request.header('X-Launcher-Device-Id')?.trim();
      const devices = await profileService.getProfileDevices(
        request.auth.userId,
        currentDeviceId || undefined,
      );

      response.status(200).json(devices);
    }),
  };
}
