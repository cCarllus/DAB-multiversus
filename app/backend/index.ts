import { createServer } from 'node:http';

import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { createApp } from './lib/create-app';
import { env } from '../../config/env/backend-env';
import {
  GLOBAL_CHAT_ROOM_NAME,
} from '../shared/contracts/chat.contract';
import {
  PLAYER_NOTIFICATIONS_ROOM_NAME,
} from '../shared/contracts/notifications.contract';
import { SOCIAL_PRESENCE_ROOM_NAME } from '../shared/contracts/social.contract';
import { closeDatabase, initializeDatabase } from './lib/postgres';
import { GlobalChatRoom } from './colyseus/global-chat-room';
import { PlayerNotificationsRoom } from './colyseus/player-notifications-room';
import { SocialPresenceRoom } from './colyseus/social-presence-room';
import { createAuthMiddleware, createOptionalAuthMiddleware } from './middleware/auth.middleware';
import { createAuthController } from './controllers/auth.controller';
import { createChatController } from './controllers/chat.controller';
import { createCharactersController } from './controllers/characters.controller';
import { createDeckController } from './controllers/deck.controller';
import { createNotificationsController } from './controllers/notifications.controller';
import { createPlayerStateController } from './controllers/player-state.controller';
import { AuthRepository } from './repositories/auth.repository';
import { createAuthRouter } from './routes/auth.routes';
import { createChatRouter } from './routes/chat.routes';
import { createCharactersRouter } from './routes/characters.routes';
import { createDeckRouter } from './routes/deck.routes';
import { createMeRouter } from './routes/me.routes';
import { AuthService } from './services/auth.service';
import { ChatRepository } from './repositories/chat.repository';
import { CharactersRepository } from './repositories/characters.repository';
import { DeckRepository } from './repositories/deck.repository';
import { NotificationsRepository } from './repositories/notifications.repository';
import { PasswordService } from './services/password.service';
import { PlayerAccountBootstrapService } from './services/player-account-bootstrap.service';
import { ProgressionRepository } from './repositories/progression.repository';
import { TokenService } from './services/token.service';
import { WalletRepository } from './repositories/wallet.repository';
import { createPresenceController } from './controllers/presence.controller';
import { createProfileController } from './controllers/profile.controller';
import { createSocialController } from './controllers/social.controller';
import { ChatService } from './services/chat.service';
import { NotificationsRealtimeGateway } from './services/notifications-realtime.gateway';
import { NotificationsService } from './services/notifications.service';
import { ProfileRepository } from './repositories/profile.repository';
import { SocialRepository } from './repositories/social.repository';
import { createProfileRouter } from './routes/profile.routes';
import { createFriendsRouter } from './routes/friends.routes';
import { createPresenceRouter } from './routes/presence.routes';
import { createUsersRouter } from './routes/users.routes';
import { UserCharactersRepository } from './repositories/user-characters.repository';
import { ProfileService } from './services/profile.service';
import { CharactersService } from './services/characters.service';
import { DeckService } from './services/deck.service';
import { ProgressionService } from './services/progression.service';
import { SocialPresenceSessionService } from './services/social-presence-session.service';
import { SessionAuthService } from './services/session-auth.service';
import { SocialService } from './services/social.service';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './services/users.service';
import { WalletService } from './services/wallet.service';

async function main(): Promise<void> {
  await initializeDatabase();

  const usersRepository = new UsersRepository();
  const usersService = new UsersService(usersRepository);
  const authRepository = new AuthRepository();
  const profileRepository = new ProfileRepository();
  const socialRepository = new SocialRepository();
  const progressionRepository = new ProgressionRepository();
  const walletRepository = new WalletRepository();
  const charactersRepository = new CharactersRepository();
  const userCharactersRepository = new UserCharactersRepository();
  const deckRepository = new DeckRepository();
  const notificationsRepository = new NotificationsRepository();
  const chatRepository = new ChatRepository();
  const profileService = new ProfileService(profileRepository, usersService);
  const socialService = new SocialService(socialRepository, usersService);
  const notificationsRealtimeGateway = new NotificationsRealtimeGateway();
  const notificationsService = new NotificationsService(
    notificationsRepository,
    notificationsRealtimeGateway,
  );
  const progressionService = new ProgressionService(
    progressionRepository,
    notificationsService,
  );
  const walletService = new WalletService(walletRepository);
  const deckService = new DeckService(
    deckRepository,
    charactersRepository,
    userCharactersRepository,
  );
  const charactersService = new CharactersService(
    charactersRepository,
    userCharactersRepository,
    deckRepository,
    walletService,
  );
  const playerAccountBootstrapService = new PlayerAccountBootstrapService(
    progressionService,
    walletService,
    notificationsService,
    charactersService,
    deckService,
  );
  const chatService = new ChatService(chatRepository, progressionRepository, usersService);
  const presenceSessionService = new SocialPresenceSessionService();
  const passwordService = new PasswordService();
  const tokenService = new TokenService();
  const sessionAuthService = new SessionAuthService(authRepository, tokenService);
  await profileService.ensureStorage();
  const authService = new AuthService({
    authRepository,
    passwordService,
    presenceSessionService,
    playerAccountBootstrapService,
    profileService,
    socialService,
    tokenService,
    usersService,
  });
  const authController = createAuthController(authService);
  const chatController = createChatController(chatService);
  const charactersController = createCharactersController(charactersService);
  const deckController = createDeckController(deckService);
  const notificationsController = createNotificationsController(notificationsService);
  const playerStateController = createPlayerStateController(progressionService, walletService);
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
    chatRouter: createChatRouter({
      authMiddleware,
      chatController,
    }),
    charactersRouter: createCharactersRouter({
      authMiddleware,
      charactersController,
    }),
    deckRouter: createDeckRouter({
      authMiddleware,
      deckController,
    }),
    friendsRouter: createFriendsRouter({
      authMiddleware,
      socialController,
    }),
    meRouter: createMeRouter({
      authMiddleware,
      notificationsController,
      playerStateController,
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
    presenceSessionService,
    sessionAuthService,
    socialService,
  });
  realtimeServer.define(GLOBAL_CHAT_ROOM_NAME, GlobalChatRoom, {
    chatService,
    presenceSessionService,
    sessionAuthService,
  });
  realtimeServer.define(PLAYER_NOTIFICATIONS_ROOM_NAME, PlayerNotificationsRoom, {
    notificationsRealtimeGateway,
    notificationsService,
    presenceSessionService,
    sessionAuthService,
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
