import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/AppError';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import {
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
} from './auth.types';
import { AuthService } from './auth.service';

export interface AuthController {
  register: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  me: RequestHandler;
}

export function createAuthController(authService: AuthService): AuthController {
  return {
    register: asyncHandler(async (request, response) => {
      const payload = registerRequestSchema.parse(request.body);
      const result = await authService.register(payload);
      response.status(201).json(result);
    }),

    login: asyncHandler(async (request, response) => {
      const payload = loginRequestSchema.parse(request.body);
      const result = await authService.login(payload);
      response.status(200).json(result);
    }),

    refresh: asyncHandler(async (request, response) => {
      const payload = refreshRequestSchema.parse(request.body);
      const result = await authService.refresh(payload);
      response.status(200).json(result);
    }),

    logout: asyncHandler(async (request, response) => {
      const payload = logoutRequestSchema.parse(request.body ?? {});
      await authService.logout({
        refreshToken: payload.refreshToken,
        sessionId: payload.sessionId ?? request.auth?.sessionId,
        userId: request.auth?.userId,
      });
      response.status(204).send();
    }),

    me: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
      }

      const user = await authService.getCurrentUser(request.auth.userId);
      response.status(200).json({ user });
    }),
  };
}
