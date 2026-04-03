import type { RequestHandler } from 'express';

import { asyncHandler } from '../lib/async-handler';
import { NotificationsService } from '../services/notifications.service';
import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
} from '../validators/player-platform.validator';
import { requireAuthUserId } from './controller-auth';

export interface NotificationsController {
  listMine: RequestHandler;
  markAllRead: RequestHandler;
  markRead: RequestHandler;
  unreadCount: RequestHandler;
}

export function createNotificationsController(
  notificationsService: NotificationsService,
): NotificationsController {
  return {
    listMine: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const query = notificationsQuerySchema.parse(request.query);
      const result = await notificationsService.listNotifications(userId, query.limit);
      response.status(200).json(result);
    }),

    markRead: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = notificationIdParamsSchema.parse(request.params);
      const notification = await notificationsService.markRead(userId, params.notificationId);
      response.status(200).json({
        notification,
      });
    }),

    markAllRead: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await notificationsService.markAllRead(userId);
      response.status(200).json(result);
    }),

    unreadCount: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await notificationsService.getUnreadCount(userId);
      response.status(200).json(result);
    }),
  };
}
