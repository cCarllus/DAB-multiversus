import { afterEach, describe, expect, it, vi } from 'vitest';

describe('backend environment configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('dotenv');
    vi.doUnmock('pg');
  });

  it('builds the database url from individual postgres variables', async () => {
    vi.doMock('dotenv', () => ({
      config: vi.fn(),
    }));
    process.env = {
      NODE_ENV: 'test',
      POSTGRES_DB: 'dab_auth',
      POSTGRES_USER: 'dab',
      POSTGRES_PASSWORD: 'secret',
      POSTGRES_HOST: 'db.internal',
      POSTGRES_PORT: '5433',
      ACCESS_TOKEN_SECRET: 'test-access-token-secret-with-32-chars',
      ALLOWED_ORIGINS: 'http://localhost:5173, http://127.0.0.1:5173',
    };

    const { env } = await import('../../config/env/backend-env');

    expect(env.DATABASE_URL).toBe('postgresql://dab:secret@db.internal:5433/dab_auth');
    expect(env.allowedOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);

    vi.resetModules();
    process.env = {
      NODE_ENV: 'test',
      POSTGRES_DB: 'dab_auth',
      POSTGRES_USER: 'dab',
      POSTGRES_PASSWORD: 'secret',
      ACCESS_TOKEN_SECRET: 'test-access-token-secret-with-32-chars',
    };

    const { env: defaultEnv } = await import('../../config/env/backend-env');
    expect(defaultEnv.DATABASE_URL).toBe('postgresql://dab:secret@127.0.0.1:5432/dab_auth');
  });

  it('prefers DATABASE_URL and rejects invalid environment setups', async () => {
    vi.doMock('dotenv', () => ({
      config: vi.fn(),
    }));
    process.env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@127.0.0.1:5432/dab',
      ACCESS_TOKEN_SECRET: 'test-access-token-secret-with-32-chars',
    };

    const configured = await import('../../config/env/backend-env');
    expect(configured.env.DATABASE_URL).toBe('postgresql://user:pass@127.0.0.1:5432/dab');

    vi.resetModules();
    process.env = {
      NODE_ENV: 'test',
      POSTGRES_DB: 'dab_auth',
      ACCESS_TOKEN_SECRET: 'short',
    };

    await expect(import('../../config/env/backend-env')).rejects.toThrow(
      'Invalid server environment configuration:',
    );

    vi.resetModules();
    process.env = {
      NODE_ENV: 'test',
      ACCESS_TOKEN_SECRET: 'test-access-token-secret-with-32-chars',
    };

    await expect(import('../../config/env/backend-env')).rejects.toThrow(
      'DATABASE_URL: Required',
    );
  });
});

describe('backend postgres helpers', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock('pg');
  });

  it('initializes schema and transaction helpers around the pool client', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const release = vi.fn();
    const end = vi.fn(async () => undefined);
    const connect = vi.fn(async () => ({
      query,
      release,
    }));

    class MockPool {
      connect = connect;

      end = end;
    }

    vi.doMock('pg', () => ({
      Pool: MockPool,
    }));

    const postgres = await import('../../app/backend/lib/postgres');
    await postgres.initializeDatabase();

    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS users'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS auth_sessions'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('CREATE TABLE IF NOT EXISTS user_devices'))).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalled();

    query.mockReset();
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('db failed'));

    await expect(postgres.initializeDatabase()).rejects.toThrow('db failed');
    expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);

    query.mockReset();
    query.mockResolvedValue({});
    const result = await postgres.withTransaction(async (client) => {
      await client.query('SELECT 1');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(query.mock.calls[0]?.[0]).toBe('BEGIN');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');

    query.mockReset();
    query.mockResolvedValue({});
    await expect(
      postgres.withTransaction(async () => {
        throw new Error('operation failed');
      }),
    ).rejects.toThrow('operation failed');
    expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);

    await postgres.closeDatabase();
    expect(end).toHaveBeenCalled();
  });

  it('normalizes legacy user columns, nicknames, and display names during schema migration', async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM information_schema.columns')) {
        const [tableName, columnName] = (params ?? []) as [string, string];

        if (tableName === 'users' && columnName === 'name') {
          return { rows: [{ exists: false }] };
        }

        if (tableName === 'users' && columnName === 'nickname') {
          return { rows: [{ exists: false }] };
        }

        if (tableName === 'users' && columnName === 'profile_image_url') {
          return { rows: [{ exists: false }] };
        }

        if (tableName === 'users' && columnName === 'username') {
          return { rows: [{ exists: true }] };
        }
      }

      if (normalizedSql.includes('FROM information_schema.table_constraints')) {
        return { rows: [{ exists: false }] };
      }

      if (normalizedSql.startsWith('SELECT id, email, name, nickname FROM users')) {
        return {
          rows: [
            {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'Jõsé..Player+one@example.com',
              name: '  John   Doe  ',
              nickname: null,
            },
            {
              id: '223e4567-e89b-12d3-a456-426614174000',
              email: 'a@example.com',
              name: null,
              nickname: '__',
            },
            {
              id: '323e4567-e89b-12d3-a456-426614174000',
              email: 'duplicate@example.com',
              name: '',
              nickname: 'Jose.Player.one',
            },
            {
              id: '423e4567-e89b-12d3-a456-426614174000',
              email: 'stable@example.com',
              name: 'Stable User',
              nickname: 'stable.user',
            },
          ],
        };
      }

      return { rows: [] };
    });
    const release = vi.fn();

    class MockPool {
      connect = vi.fn(async () => ({
        query,
        release,
      }));

      end = vi.fn(async () => undefined);
    }

    vi.doMock('pg', () => ({
      Pool: MockPool,
    }));

    const postgres = await import('../../app/backend/lib/postgres');
    await postgres.initializeDatabase();

    expect(query).toHaveBeenCalledWith('ALTER TABLE users ADD COLUMN name TEXT');
    expect(query).toHaveBeenCalledWith('ALTER TABLE users ADD COLUMN nickname TEXT');
    expect(query).toHaveBeenCalledWith('ALTER TABLE users ADD COLUMN profile_image_url TEXT');
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes('SET nickname = COALESCE(NULLIF(BTRIM(nickname), \'\'), NULLIF(BTRIM(username), \'\'))'),
      ),
    ).toBe(true);
    expect(query).toHaveBeenCalledWith('ALTER TABLE users DROP COLUMN username');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE users ADD CONSTRAINT users_nickname_unique UNIQUE (nickname)'),
    );

    const userUpdates = query.mock.calls.filter(([sql]) =>
      String(sql).includes('UPDATE users') && String(sql).includes('SET nickname = $2, name = $3, updated_at = NOW()'),
    );

    expect(userUpdates).toEqual([
      [
        expect.any(String),
        ['123e4567-e89b-12d3-a456-426614174000', 'jose.player.one', 'John Doe'],
      ],
      [
        expect.any(String),
        ['223e4567-e89b-12d3-a456-426614174000', 'player223e4567', 'player223e4567'],
      ],
      [
        expect.any(String),
        ['323e4567-e89b-12d3-a456-426614174000', 'jose.player.one-2', 'jose.player.one-2'],
      ],
    ]);
    expect(
      userUpdates.some(([, params]) => (params as string[])[0] === '423e4567-e89b-12d3-a456-426614174000'),
    ).toBe(false);
    expect(release).toHaveBeenCalled();
  });
});

describe('backend entrypoint', () => {
  const originalExit = process.exit;
  const originalOn = process.on;
  const originalSetTimeout = globalThis.setTimeout;

  async function flushAsyncWork(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  function mockEntrypointDependencies(options?: {
    closeDatabase?: ReturnType<typeof vi.fn>;
    gracefullyShutdown?: ReturnType<typeof vi.fn>;
    initializeDatabase?: ReturnType<typeof vi.fn>;
  }) {
    const app = { name: 'mock-app' };
    const httpServer = { name: 'mock-http-server' };
    const closeDatabase = options?.closeDatabase ?? vi.fn(async () => undefined);
    const createApp = vi.fn(() => app);
    const createServer = vi.fn(() => httpServer);
    const define = vi.fn();
    const ensureStorage = vi.fn(async () => undefined);
    const gracefullyShutdown = options?.gracefullyShutdown ?? vi.fn(async () => undefined);
    const initializeDatabase = options?.initializeDatabase ?? vi.fn(async () => undefined);
    const listen = vi.fn(async () => undefined);
    const WebSocketTransport = vi.fn(function MockWebSocketTransport(this: { options: unknown }, transportOptions: unknown) {
      this.options = transportOptions;
    });
    const MockRealtimeServer = vi.fn(function MockRealtimeServer(this: {
      define: typeof define;
      gracefullyShutdown: typeof gracefullyShutdown;
      listen: typeof listen;
    }) {
      this.define = define;
      this.gracefullyShutdown = gracefullyShutdown;
      this.listen = listen;
    });
    const SocialPresenceRoom = class MockSocialPresenceRoom { };
    const GlobalChatRoom = class MockGlobalChatRoom { };
    const PlayerNotificationsRoom = class MockPlayerNotificationsRoom { };

    vi.doMock('../../config/env/backend-env', () => ({
      env: {
        PORT: 4000,
      },
    }));
    vi.doMock('node:http', () => ({
      createServer,
    }));
    vi.doMock('@colyseus/core', () => ({
      Room: class MockRoom { },
      Server: MockRealtimeServer,
    }));
    vi.doMock('@colyseus/ws-transport', () => ({
      WebSocketTransport,
    }));
    vi.doMock('../../app/backend/colyseus/social-presence-room', () => ({
      SocialPresenceRoom,
    }));
    vi.doMock('../../app/backend/colyseus/global-chat-room', () => ({
      GlobalChatRoom,
    }));
    vi.doMock('../../app/backend/colyseus/player-notifications-room', () => ({
      PlayerNotificationsRoom,
    }));
    vi.doMock('../../app/backend/lib/postgres', () => ({
      closeDatabase,
      dbPool: {},
      initializeDatabase,
      withTransaction: vi.fn(),
    }));
    vi.doMock('../../app/backend/lib/create-app', () => ({
      createApp,
    }));
    vi.doMock('../../app/backend/middleware/auth.middleware', () => ({
      createAuthMiddleware: vi.fn(() => 'auth-middleware'),
      createOptionalAuthMiddleware: vi.fn(() => 'optional-auth-middleware'),
    }));
    vi.doMock('../../app/backend/controllers/auth.controller', () => ({
      createAuthController: vi.fn(() => 'auth-controller'),
    }));
    vi.doMock('../../app/backend/controllers/chat.controller', () => ({
      createChatController: vi.fn(() => 'chat-controller'),
    }));
    vi.doMock('../../app/backend/controllers/characters.controller', () => ({
      createCharactersController: vi.fn(() => 'characters-controller'),
    }));
    vi.doMock('../../app/backend/controllers/deck.controller', () => ({
      createDeckController: vi.fn(() => 'deck-controller'),
    }));
    vi.doMock('../../app/backend/controllers/notifications.controller', () => ({
      createNotificationsController: vi.fn(() => 'notifications-controller'),
    }));
    vi.doMock('../../app/backend/controllers/player-state.controller', () => ({
      createPlayerStateController: vi.fn(() => 'player-state-controller'),
    }));
    vi.doMock('../../app/backend/controllers/presence.controller', () => ({
      createPresenceController: vi.fn(() => 'presence-controller'),
    }));
    vi.doMock('../../app/backend/controllers/profile.controller', () => ({
      createProfileController: vi.fn(() => 'profile-controller'),
    }));
    vi.doMock('../../app/backend/controllers/social.controller', () => ({
      createSocialController: vi.fn(() => 'social-controller'),
    }));
    vi.doMock('../../app/backend/routes/auth.routes', () => ({
      createAuthRouter: vi.fn(() => 'auth-router'),
    }));
    vi.doMock('../../app/backend/routes/chat.routes', () => ({
      createChatRouter: vi.fn(() => 'chat-router'),
    }));
    vi.doMock('../../app/backend/routes/characters.routes', () => ({
      createCharactersRouter: vi.fn(() => 'characters-router'),
    }));
    vi.doMock('../../app/backend/routes/deck.routes', () => ({
      createDeckRouter: vi.fn(() => 'deck-router'),
    }));
    vi.doMock('../../app/backend/routes/friends.routes', () => ({
      createFriendsRouter: vi.fn(() => 'friends-router'),
    }));
    vi.doMock('../../app/backend/routes/me.routes', () => ({
      createMeRouter: vi.fn(() => 'me-router'),
    }));
    vi.doMock('../../app/backend/routes/presence.routes', () => ({
      createPresenceRouter: vi.fn(() => 'presence-router'),
    }));
    vi.doMock('../../app/backend/routes/profile.routes', () => ({
      createProfileRouter: vi.fn(() => 'profile-router'),
    }));
    vi.doMock('../../app/backend/routes/users.routes', () => ({
      createUsersRouter: vi.fn(() => 'users-router'),
    }));
    vi.doMock('../../app/backend/repositories/auth.repository', () => ({
      AuthRepository: vi.fn(function MockAuthRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/chat.repository', () => ({
      ChatRepository: vi.fn(function MockChatRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/characters.repository', () => ({
      CharactersRepository: vi.fn(function MockCharactersRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/deck.repository', () => ({
      DeckRepository: vi.fn(function MockDeckRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/notifications.repository', () => ({
      NotificationsRepository: vi.fn(function MockNotificationsRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/profile.repository', () => ({
      ProfileRepository: vi.fn(function MockProfileRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/progression.repository', () => ({
      ProgressionRepository: vi.fn(function MockProgressionRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/social.repository', () => ({
      SocialRepository: vi.fn(function MockSocialRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/users.repository', () => ({
      UsersRepository: vi.fn(function MockUsersRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/user-characters.repository', () => ({
      UserCharactersRepository: vi.fn(function MockUserCharactersRepository() { }),
    }));
    vi.doMock('../../app/backend/repositories/wallet.repository', () => ({
      WalletRepository: vi.fn(function MockWalletRepository() { }),
    }));
    vi.doMock('../../app/backend/services/profile.service', () => ({
      ProfileService: vi.fn(function MockProfileService() {
        return {
          ensureStorage,
        };
      }),
    }));
    vi.doMock('../../app/backend/services/chat.service', () => ({
      ChatService: vi.fn(function MockChatService() { }),
    }));
    vi.doMock('../../app/backend/services/characters.service', () => ({
      CharactersService: vi.fn(function MockCharactersService() {
        return {
          ensureCatalogSeeded: vi.fn(async () => undefined),
        };
      }),
    }));
    vi.doMock('../../app/backend/services/deck.service', () => ({
      DeckService: vi.fn(function MockDeckService() { }),
    }));
    vi.doMock('../../app/backend/services/notifications-realtime.gateway', () => ({
      NotificationsRealtimeGateway: vi.fn(function MockNotificationsRealtimeGateway() { }),
    }));
    vi.doMock('../../app/backend/services/notifications.service', () => ({
      NotificationsService: vi.fn(function MockNotificationsService() { }),
    }));
    vi.doMock('../../app/backend/services/player-account-bootstrap.service', () => ({
      PlayerAccountBootstrapService: vi.fn(function MockPlayerAccountBootstrapService() { }),
    }));
    vi.doMock('../../app/backend/services/social-presence-session.service', () => ({
      SocialPresenceSessionService: vi.fn(function MockSocialPresenceSessionService() { }),
    }));
    vi.doMock('../../app/backend/services/progression.service', () => ({
      ProgressionService: vi.fn(function MockProgressionService() { }),
    }));
    vi.doMock('../../app/backend/services/session-auth.service', () => ({
      SessionAuthService: vi.fn(function MockSessionAuthService() { }),
    }));
    vi.doMock('../../app/backend/services/social.service', () => ({
      SocialService: vi.fn(function MockSocialService() { }),
    }));
    vi.doMock('../../app/backend/services/auth.service', () => ({
      AuthService: vi.fn(function MockAuthService() { }),
    }));
    vi.doMock('../../app/backend/services/password.service', () => ({
      PasswordService: vi.fn(function MockPasswordService() { }),
    }));
    vi.doMock('../../app/backend/services/token.service', () => ({
      TokenService: vi.fn(function MockTokenService() { }),
    }));
    vi.doMock('../../app/backend/services/users.service', () => ({
      UsersService: vi.fn(function MockUsersService() { }),
    }));
    vi.doMock('../../app/backend/services/wallet.service', () => ({
      WalletService: vi.fn(function MockWalletService() { }),
    }));

    return {
      GlobalChatRoom,
      PlayerNotificationsRoom,
      SocialPresenceRoom,
      WebSocketTransport,
      app,
      closeDatabase,
      createApp,
      createServer,
      define,
      ensureStorage,
      gracefullyShutdown,
      httpServer,
      initializeDatabase,
      listen,
    };
  }

  afterEach(() => {
    process.exit = originalExit;
    process.on = originalOn;
    globalThis.setTimeout = originalSetTimeout;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('boots the backend server and registers shutdown handlers', async () => {
    const exitSpy = vi.fn();
    const handlers = new Map<string, () => void>();
    const unref = vi.fn();
    const mocks = mockEntrypointDependencies();

    process.exit = exitSpy as never;
    process.on = vi.fn((event, handler) => {
      handlers.set(event, handler as () => void);
      return process;
    }) as never;
    globalThis.setTimeout = vi.fn(() => ({ unref })) as never;

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('../../app/backend/index');
    await flushAsyncWork();

    expect(mocks.initializeDatabase).toHaveBeenCalled();
    expect(mocks.ensureStorage).toHaveBeenCalled();
    expect(mocks.createApp).toHaveBeenCalledWith({
      authRouter: 'auth-router',
      chatRouter: 'chat-router',
      charactersRouter: 'characters-router',
      deckRouter: 'deck-router',
      friendsRouter: 'friends-router',
      meRouter: 'me-router',
      presenceRouter: 'presence-router',
      profileRouter: 'profile-router',
      usersRouter: 'users-router',
    });
    expect(mocks.createServer).toHaveBeenCalledWith(mocks.app);
    expect(mocks.WebSocketTransport).toHaveBeenCalledWith({
      server: mocks.httpServer,
    });
    expect(mocks.define).toHaveBeenCalledWith(
      'social_presence',
      mocks.SocialPresenceRoom,
      expect.objectContaining({
        presenceSessionService: expect.any(Object),
        sessionAuthService: expect.any(Object),
        socialService: expect.any(Object),
      }),
    );
    expect(mocks.define).toHaveBeenCalledWith(
      'global_chat',
      mocks.GlobalChatRoom,
      expect.objectContaining({
        chatService: expect.any(Object),
        presenceSessionService: expect.any(Object),
        sessionAuthService: expect.any(Object),
      }),
    );
    expect(mocks.define).toHaveBeenCalledWith(
      'player_notifications',
      mocks.PlayerNotificationsRoom,
      expect.objectContaining({
        notificationsRealtimeGateway: expect.any(Object),
        notificationsService: expect.any(Object),
        presenceSessionService: expect.any(Object),
        sessionAuthService: expect.any(Object),
      }),
    );
    expect(mocks.listen).toHaveBeenCalledWith(4000);
    expect(logSpy).toHaveBeenCalledWith(
      'Dead As Battle auth server listening on port 4000.',
    );
    expect(unref).not.toHaveBeenCalled();

    handlers.get('SIGINT')?.();
    await flushAsyncWork();
    expect(mocks.gracefullyShutdown).toHaveBeenCalledWith(false);
    expect(mocks.closeDatabase).toHaveBeenCalled();
    expect(unref).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when shutdown cleanup fails or times out', async () => {
    const exitSpy = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = new Map<string, () => void>();
    const closeDatabase = vi.fn(async () => {
      throw new Error('close failed');
    });
    let timeoutHandler: (() => void) | null = null;
    const mocks = mockEntrypointDependencies({
      closeDatabase,
    });

    process.exit = exitSpy as never;
    process.on = vi.fn((event, handler) => {
      handlers.set(event, handler as () => void);
      return process;
    }) as never;
    globalThis.setTimeout = vi.fn((handler) => {
      timeoutHandler = handler as () => void;
      return {
        unref: vi.fn(),
      } as never;
    }) as never;

    await import('../../app/backend/index');
    await flushAsyncWork();
    handlers.get('SIGTERM')?.();
    await flushAsyncWork();

    expect(mocks.gracefullyShutdown).toHaveBeenCalledWith(false);
    expect(closeDatabase).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to close the database pool cleanly.',
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    timeoutHandler?.();
    await flushAsyncWork();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 when startup fails', async () => {
    const exitSpy = vi.fn();
    mockEntrypointDependencies({
      initializeDatabase: vi.fn(async () => {
        throw new Error('startup failed');
      }),
    });
    process.exit = exitSpy as never;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../app/backend/index');
    await flushAsyncWork();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to start the Dead As Battle auth server.',
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
