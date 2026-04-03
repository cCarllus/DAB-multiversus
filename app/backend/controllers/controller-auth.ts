import type { Request } from 'express-serve-static-core';

import { AppError } from '../lib/app-error';

export function requireAuthContext(request: Request) {
  if (!request.authContext) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }

  return request.authContext;
}

export function requireAuthUserId(request: Request): string {
  return requireAuthContext(request).userId;
}
