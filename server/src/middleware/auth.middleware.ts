import type { Request, RequestHandler } from 'express';

import { AuthRepository } from '../modules/auth/auth.repository';
import { TokenService } from '../modules/auth/token.service';
import { AppError } from '../shared/errors/AppError';
import { asyncHandler } from '../shared/utils/asyncHandler';

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
  authRepository: AuthRepository,
  tokenService: TokenService,
): Promise<void> {
  const accessToken = extractBearerToken(request);

  if (!accessToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  const payload = tokenService.verifyAccessToken(accessToken);
  const session = await authRepository.findById(payload.sid);

  if (!session) {
    throw new AppError(401, 'UNAUTHORIZED', 'Session is invalid.');
  }

  if (session.userId !== payload.sub) {
    throw new AppError(401, 'UNAUTHORIZED', 'Access token does not match the current session.');
  }

  if (session.revokedAt) {
    throw new AppError(401, 'SESSION_REVOKED', 'This session has been revoked.');
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, 'SESSION_EXPIRED', 'This session has expired.');
  }

  request.auth = {
    userId: payload.sub,
    sessionId: payload.sid,
    email: payload.email,
    username: payload.username,
  };
}

export function createAuthMiddleware(
  authRepository: AuthRepository,
  tokenService: TokenService,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    await attachAuthenticationContext(request, authRepository, tokenService);
    next();
  });
}

export function createOptionalAuthMiddleware(
  authRepository: AuthRepository,
  tokenService: TokenService,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const accessToken = extractBearerToken(request);

    if (!accessToken) {
      next();
      return;
    }

    try {
      await attachAuthenticationContext(request, authRepository, tokenService);
    } catch {
      request.auth = undefined;
    }

    next();
  });
}
