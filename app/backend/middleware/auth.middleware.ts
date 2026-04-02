import type { Request } from 'express-serve-static-core';
import type { RequestHandler } from 'express';

import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from '../services/token.service';
import { AppError } from '../lib/app-error';
import { asyncHandler } from '../lib/async-handler';
import { SessionAuthService } from '../services/session-auth.service';

function extractBearerToken(request: Request): string | null {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function attachAuthenticationContext(
  request: Request,
  sessionAuthService: SessionAuthService,
): Promise<void> {
  const accessToken = extractBearerToken(request);

  if (!accessToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  const identity = await sessionAuthService.authenticateAccessToken(accessToken);

  request.authContext = {
    userId: identity.userId,
    sessionId: identity.sessionId,
    email: identity.email,
    nickname: identity.nickname,
  };
}

export function createAuthMiddleware(
  authRepository: AuthRepository,
  tokenService: TokenService,
): RequestHandler {
  const sessionAuthService = new SessionAuthService(authRepository, tokenService);

  return asyncHandler(async (request, _response, next) => {
    await attachAuthenticationContext(request, sessionAuthService);
    next();
  });
}

export function createOptionalAuthMiddleware(
  authRepository: AuthRepository,
  tokenService: TokenService,
): RequestHandler {
  const sessionAuthService = new SessionAuthService(authRepository, tokenService);

  return asyncHandler(async (request, _response, next) => {
    const accessToken = extractBearerToken(request);

    if (!accessToken) {
      next();
      return;
    }

    try {
      await attachAuthenticationContext(request, sessionAuthService);
    } catch {
      request.authContext = undefined;
    }

    next();
  });
}
