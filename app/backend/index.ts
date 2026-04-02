import { createApp } from './lib/create-app';
import { env } from '../../config/env/backend-env';
import { closeDatabase, initializeDatabase } from './lib/postgres';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth.middleware';
import { createAuthController } from './controllers/auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { createAuthRouter } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { createProfileController } from './controllers/profile.controller';
import { ProfileRepository } from './repositories/profile.repository';
import { createProfileRouter } from './routes/profile.routes';
import { ProfileService } from './services/profile.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

async function main(): Promise<void> {
  await initializeDatabase();

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository);
  const authRepository = new AuthRepository();
  const profileRepository = new ProfileRepository();
  const profileService = new ProfileService(profileRepository, usersService);
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  await profileService.ensureStorage();
  const authService = new AuthService({
    authRepository,
    passwordService,
    profileService,
    tokenService,
    usersService,
  });
  const authController = createAuthController(authService);
  const profileController = createProfileController(profileService);
  const authMiddleware = createAuthMiddleware(authRepository, tokenService);
  const optionalAuthMiddleware = createOptionalAuthMiddleware(authRepository, tokenService);
  const app = createApp({
    authRouter: createAuthRouter({
      authController,
      authMiddleware,
      optionalAuthMiddleware,
    }),
    profileRouter: createProfileRouter({
      authMiddleware,
      profileController,
    }),
  });

  const server = app.listen(env.PORT, () => {
    console.log(`Dead As Battle auth server listening on port ${env.PORT}.`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down auth server.`);

    server.close(() => {
      void closeDatabase()
        .then(() => {
          process.exit(0);
        })
        .catch((error: unknown) => {
          console.error('Failed to close the database pool cleanly.', error);
          process.exit(1);
        });
    });

    setTimeout(() => {
      process.exit(1);
    }, 5_000).unref();
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

void main().catch((error: unknown) => {
  console.error('Failed to start the Dead As Battle auth server.', error);
  process.exit(1);
});
