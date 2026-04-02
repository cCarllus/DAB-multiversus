import type { Request } from 'express-serve-static-core';
import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { asyncHandler } from '../lib/async-handler';
import { SocialService } from '../services/social.service';
import {
  friendRequestSchema,
  friendshipIdParamsSchema,
  publicProfileParamsSchema,
  requestIdParamsSchema,
  socialDirectoryQuerySchema,
} from '../validators/social.validator';

export interface SocialController {
  acceptFriendRequest: RequestHandler;
  cancelOutgoingRequest: RequestHandler;
  friends: RequestHandler;
  globalUsers: RequestHandler;
  incomingRequests: RequestHandler;
  outgoingRequests: RequestHandler;
  publicProfile: RequestHandler;
  rejectFriendRequest: RequestHandler;
  removeFriend: RequestHandler;
  searchUsers: RequestHandler;
  sendFriendRequest: RequestHandler;
}

function requireAuthUserId(request: Request): string {
  if (!request.authContext) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  return request.authContext.userId;
}

export function createSocialController(socialService: SocialService): SocialController {
  return {
    globalUsers: asyncHandler(async (request, response) => {
      const viewerUserId = requireAuthUserId(request);
      const query = socialDirectoryQuerySchema.parse(request.query);
      const result = await socialService.listGlobalUsers(viewerUserId, {
        page: query.page,
        pageSize: query.pageSize,
        presence: query.presence,
        query: query.q,
        relationship: query.relationship,
      });
      response.status(200).json(result);
    }),

    searchUsers: asyncHandler(async (request, response) => {
      const viewerUserId = requireAuthUserId(request);
      const query = socialDirectoryQuerySchema.parse(request.query);
      const result = await socialService.listGlobalUsers(viewerUserId, {
        page: query.page,
        pageSize: query.pageSize,
        presence: query.presence,
        query: query.q,
        relationship: query.relationship,
      });
      response.status(200).json(result);
    }),

    publicProfile: asyncHandler(async (request, response) => {
      const viewerUserId = requireAuthUserId(request);
      const params = publicProfileParamsSchema.parse(request.params);
      const result = await socialService.getPublicProfile(viewerUserId, params.nickname);
      response.status(200).json(result);
    }),

    friends: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await socialService.listFriends(userId);
      response.status(200).json(result);
    }),

    incomingRequests: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await socialService.listIncomingRequests(userId);
      response.status(200).json(result);
    }),

    outgoingRequests: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const result = await socialService.listOutgoingRequests(userId);
      response.status(200).json(result);
    }),

    sendFriendRequest: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const payload = friendRequestSchema.parse(request.body);
      await socialService.sendFriendRequest(userId, payload.nickname);
      response.status(201).json({
        success: true,
      });
    }),

    acceptFriendRequest: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = requestIdParamsSchema.parse(request.params);
      await socialService.acceptFriendRequest(userId, params.requestId);
      response.status(204).send();
    }),

    rejectFriendRequest: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = requestIdParamsSchema.parse(request.params);
      await socialService.rejectFriendRequest(userId, params.requestId);
      response.status(204).send();
    }),

    cancelOutgoingRequest: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = requestIdParamsSchema.parse(request.params);
      await socialService.cancelOutgoingRequest(userId, params.requestId);
      response.status(204).send();
    }),

    removeFriend: asyncHandler(async (request, response) => {
      const userId = requireAuthUserId(request);
      const params = friendshipIdParamsSchema.parse(request.params);
      await socialService.removeFriend(userId, params.friendshipId);
      response.status(204).send();
    }),
  };
}
