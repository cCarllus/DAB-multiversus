import multer from 'multer';
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';

import { AppError } from '../../shared/errors/AppError';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_BYTES,
} from './profile.storage';
import type { ProfileController } from './profile.controller';

interface CreateProfileRouterOptions {
  authMiddleware: RequestHandler;
  profileController: ProfileController;
}

const avatarUpload = multer({
  limits: {
    fileSize: MAX_AVATAR_FILE_BYTES,
  },
  storage: multer.memoryStorage(),
  fileFilter(_request, file, callback) {
    if (ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(
      new AppError(
        400,
        'INVALID_AVATAR_TYPE',
        'Profile photo must be a PNG, JPG, or WEBP image.',
      ),
    );
  },
});

function handleAvatarUpload(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  avatarUpload.single('avatar')(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'AVATAR_TOO_LARGE', 'Profile photo must be 5 MB or smaller.'));
      return;
    }

    next(error);
  });
}

export function createProfileRouter(options: CreateProfileRouterOptions): Router {
  const router = Router();

  router.get('/me', options.authMiddleware, options.profileController.me);
  router.patch('/me', options.authMiddleware, options.profileController.updateMe);
  router.post(
    '/me/avatar',
    options.authMiddleware,
    handleAvatarUpload,
    options.profileController.uploadAvatar,
  );
  router.get('/me/devices', options.authMiddleware, options.profileController.devices);

  return router;
}
