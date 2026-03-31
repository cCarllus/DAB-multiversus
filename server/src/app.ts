import cors from 'cors';
import express, { type Router } from 'express';

import { env } from './config/env';
import { AppError } from './shared/errors/AppError';
import { errorMiddleware } from './middleware/error.middleware';

interface CreateAppOptions {
  authRouter: Router;
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin || origin === 'null' || origin.startsWith('file://')) {
    return true;
  }

  if (env.allowedOrigins.length === 0) {
    return true;
  }

  return env.allowedOrigins.includes(origin);
}

export function createApp(options: CreateAppOptions) {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError(403, 'CORS_FORBIDDEN', 'Origin is not allowed.'));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
    });
  });

  app.use('/auth', options.authRouter);

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
  });

  app.use(errorMiddleware);

  return app;
}
