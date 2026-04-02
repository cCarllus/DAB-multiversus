import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../../../config/env/backend-env';
import { AppError } from '../lib/app-error';

function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string };

  return ['ECONNREFUSED', 'ECONNRESET', '57P01'].includes(candidate.code ?? '');
}

function isDatabaseConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: string };
  return candidate.code === '23505';
}

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, next) => {
  void next;

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'REQUEST_INVALID',
        message: 'Request payload is invalid.',
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (isDatabaseConflict(error)) {
    response.status(409).json({
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'The requested resource conflicts with existing data.',
      },
    });
    return;
  }

  if (isDatabaseUnavailable(error)) {
    response.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The authentication service cannot reach PostgreSQL right now.',
      },
    });
    return;
  }

  console.error(error);

  response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
      ...(env.NODE_ENV !== 'production' && error instanceof Error
        ? { details: error.message }
        : {}),
    },
  });
};
