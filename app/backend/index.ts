import { createServer } from 'node:http';

import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { createApp } from './lib/create-app';
import { env } from '../../config/env/backend-env';
import { SOCIAL_PRESENCE_ROOM_NAME } from '../shared/contracts/social.contract';
import { closeDatabase, initializeDatabase } from './lib/postgres';
import { SocialPresenceRoom } from './colyseus/social-presence-room';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth.middleware';
import { createAuthController } from './controllers/auth.controller';
import { AuthRepository } from './repositories/auth.repository';
import { createAuthRouter } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { createPresenceController } from './controllers/presence.controller';
import { createProfileController } from './controllers/profile.controller';
import { createSocialController } from './controllers/social.controller';
import { ProfileRepository } from './repositories/profile.repository';
import { SocialRepository } from './repositories/social.repository';
import { createProfileRouter } from './routes/profile.routes';
import { createFriendsRouter } from './routes/friends.routes';
import { createPresenceRouter } from './routes/presence.routes';
import { createUsersRouter } from './routes/users.routes';
import { ProfileService } from './services/profile.service';
import { SessionAuthService } from './services/session-auth.service';
import { SocialService } from './services/social.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';

async function main(): Promise<void> {
  await initializeDatabase();

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository);
  const authRepository = new AuthRepository();
  const profileRepository = new ProfileRepository();
  const socialRepository = new SocialRepository();
  const profileService = new ProfileService(profileRepository, usersService);
  const socialService = new SocialService(socialRepository, usersService);
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const sessionAuthService = new SessionAuthService(authRepository, tokenService);
  await profileService.ensureStorage();
  const authService = new AuthService({
    authRepository,
    passwordService,
    profileService,
    socialService,
    tokenService,
    usersService,
  });
  const authController = createAuthController(authService);
  const profileController = createProfileController(profileService);
  const socialController = createSocialController(socialService);
  const presenceController = createPresenceController(socialService);
  const authMiddleware = createAuthMiddleware(authRepository, tokenService);
  const optionalAuthMiddleware = createOptionalAuthMiddleware(authRepository, tokenService);
  const app = createApp({
    authRouter: createAuthRouter({
      authController,
      authMiddleware,
      optionalAuthMiddleware,
    }),
    friendsRouter: createFriendsRouter({
      authMiddleware,
      socialController,
    }),
    presenceRouter: createPresenceRouter({
      authMiddleware,
      presenceController,
    }),
    profileRouter: createProfileRouter({
      authMiddleware,
      profileController,
    }),
    usersRouter: createUsersRouter({
      authMiddleware,
      socialController,
    }),
  });
  const httpServer = createServer(app);
  const realtimeServer = new Server({
    greet: false,
    transport: new WebSocketTransport({
      server: httpServer,
    }),
  });

  realtimeServer.define(SOCIAL_PRESENCE_ROOM_NAME, SocialPresenceRoom, {
    sessionAuthService,
    socialService,
  });

  await realtimeServer.listen(env.PORT);
  console.log(`Dead As Battle auth server listening on port ${env.PORT}.`);

  let isShuttingDown = false;

  const shutdown = (signal: string): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`${signal} received, shutting down auth server.`);

    void realtimeServer
      .gracefullyShutdown(false)
      .then(() => closeDatabase())
      .then(() => {
        process.exit(0);
      })
      .catch((error: unknown) => {
        console.error('Failed to close the database pool cleanly.', error);
        process.exit(1);
      });

    setTimeout(() => {
      void closeDatabase()
        .then(() => {
          process.exit(0);
        })
        .catch((error: unknown) => {
          console.error('Failed to close the database pool cleanly.', error);
          process.exit(1);
        });
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
