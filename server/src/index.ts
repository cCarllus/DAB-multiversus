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
import { createProfileController } from './modules/profile/profile.controller';
import { ProfileRepository } from './modules/profile/profile.repository';
import { createProfileRouter } from './modules/profile/profile.routes';
import { ProfileService } from './modules/profile/profile.service';
import { UsersRepository } from './modules/users/users.repository';
import { UsersService } from './modules/users/users.service';

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
