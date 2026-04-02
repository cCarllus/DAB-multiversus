import multer from 'multer';
import { Router, type RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_BYTES,
} from '../lib/profile-storage';
import type { ProfileController } from '../controllers/profile.controller';

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

const handleAvatarUpload: RequestHandler = (request, response, next): void => {
  avatarUpload.single('avatar')(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'AVATAR_TOO_LARGE', 'Profile photo must be 5 MB or smaller.'));
      return;
    }

    next(error);
  });
};

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
