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
});

describe('backend entrypoint', () => {
  const originalExit = process.exit;
  const originalOn = process.on;
  const originalSetTimeout = globalThis.setTimeout;

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
    const closeDatabase = vi.fn(async () => undefined);
    const initializeDatabase = vi.fn(async () => undefined);
    const serverClose = vi.fn((callback: () => void) => callback());
    const listen = vi.fn((port: number, callback: () => void) => {
      callback();
      return {
        close: serverClose,
      };
    });

    process.exit = exitSpy as never;
    process.on = vi.fn((event, handler) => {
      handlers.set(event, handler as () => void);
      return process;
    }) as never;
    globalThis.setTimeout = vi.fn(() => ({
      unref: vi.fn(),
    })) as never;

    vi.doMock('../../app/backend/lib/postgres', () => ({
      closeDatabase,
      initializeDatabase,
      withTransaction: vi.fn(),
    }));
    vi.doMock('../../app/backend/lib/create-app', () => ({
      createApp: vi.fn(() => ({
        listen,
      })),
    }));
    vi.doMock('../../app/backend/middleware/auth.middleware', () => ({
      createAuthMiddleware: vi.fn(() => 'auth-middleware'),
      createOptionalAuthMiddleware: vi.fn(() => 'optional-auth-middleware'),
    }));
    vi.doMock('../../app/backend/controllers/auth.controller', () => ({
      createAuthController: vi.fn(() => 'auth-controller'),
    }));
    vi.doMock('../../app/backend/controllers/profile.controller', () => ({
      createProfileController: vi.fn(() => 'profile-controller'),
    }));
    vi.doMock('../../app/backend/routes/auth.routes', () => ({
      createAuthRouter: vi.fn(() => 'auth-router'),
    }));
    vi.doMock('../../app/backend/routes/profile.routes', () => ({
      createProfileRouter: vi.fn(() => 'profile-router'),
    }));
    class AuthRepository {}
    class ProfileRepository {}
    class UsersRepository {}
    class ProfileService {
      async ensureStorage(): Promise<void> {
        return undefined;
      }
    }
    class AuthService {}
    class PasswordService {}
    class TokenService {}
    class UsersService {}

    vi.doMock('../../app/backend/repositories/auth.repository', () => ({
      AuthRepository,
    }));
    vi.doMock('../../app/backend/repositories/profile.repository', () => ({
      ProfileRepository,
    }));
    vi.doMock('../../app/backend/repositories/users.repository', () => ({
      UsersRepository,
    }));
    vi.doMock('../../app/backend/services/profile.service', () => ({
      ProfileService,
    }));
    vi.doMock('../../app/backend/services/auth.service', () => ({
      AuthService,
    }));
    vi.doMock('../../app/backend/services/password.service', () => ({
      PasswordService,
    }));
    vi.doMock('../../app/backend/services/token.service', () => ({
      TokenService,
    }));
    vi.doMock('../../app/backend/services/users.service', () => ({
      UsersService,
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('../../app/backend/index');
    await Promise.resolve();

    expect(initializeDatabase).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(4000, expect.any(Function));
    expect(logSpy).toHaveBeenCalledWith(
      'Dead As Battle auth server listening on port 4000.',
    );

    handlers.get('SIGINT')?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(serverClose).toHaveBeenCalled();
    expect(closeDatabase).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when startup fails', async () => {
    const exitSpy = vi.fn();
    process.exit = exitSpy as never;

    vi.doMock('../../app/backend/lib/postgres', () => ({
      closeDatabase: vi.fn(),
      initializeDatabase: vi.fn(async () => {
        throw new Error('startup failed');
      }),
      withTransaction: vi.fn(),
    }));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await import('../../app/backend/index');
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to start the Dead As Battle auth server.',
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
