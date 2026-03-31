import { createApp } from './app';
import { env } from './config/env';
import { closeDatabase, initializeDatabase } from './db/postgres';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth.middleware';
import { createAuthController } from './modules/auth/auth.controller';
import { AuthRepository } from './modules/auth/auth.repository';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { PasswordService } from './modules/auth/password.service';
import { TokenService } from './modules/auth/token.service';
import { UsersRepository } from './modules/users/users.repository';
import { UsersService } from './modules/users/users.service';

async function main(): Promise<void> {
  await initializeDatabase();

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository);
  const authRepository = new AuthRepository();
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const authService = new AuthService({
    authRepository,
    passwordService,
    tokenService,
    usersService,
  });
  const authController = createAuthController(authService);
  const authMiddleware = createAuthMiddleware(authRepository, tokenService);
  const optionalAuthMiddleware = createOptionalAuthMiddleware(authRepository, tokenService);
  const app = createApp({
    authRouter: createAuthRouter({
      authController,
      authMiddleware,
      optionalAuthMiddleware,
    }),
  });

  const server = app.listen(env.PORT, () => {
    console.log(`Dead As Battle auth server listening on port ${env.PORT}.`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received, shutting down auth server.`);

    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 5_000).unref();
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main().catch((error: unknown) => {
  console.error('Failed to start the Dead As Battle auth server.', error);
  process.exit(1);
});
