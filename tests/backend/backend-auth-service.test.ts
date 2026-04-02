import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as postgresModule from '../../app/backend/lib/postgres';
import { AuthService } from '../../app/backend/services/auth.service';
import { AppError } from '../../app/backend/lib/app-error';
import { env } from '../../config/env/backend-env';

async function expectRejectedAppError(
  promise: Promise<unknown>,
  expected: { code: string; statusCode: number },
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject(expected);
  }
}

describe('auth service', () => {
  const transactionClient = {
    query: vi.fn(),
  };

  let dependencies: {
    authRepository: {
      createSession: ReturnType<typeof vi.fn>;
      findById: ReturnType<typeof vi.fn>;
      findByRefreshTokenHash: ReturnType<typeof vi.fn>;
      revokeSessionById: ReturnType<typeof vi.fn>;
      rotateSession: ReturnType<typeof vi.fn>;
    };
    passwordService: {
      hashPassword: ReturnType<typeof vi.fn>;
      verifyPassword: ReturnType<typeof vi.fn>;
    };
    profileService: {
      ensureStorage: ReturnType<typeof vi.fn>;
      recordDeviceAccess: ReturnType<typeof vi.fn>;
    };
    tokenService: {
      generateAccessToken: ReturnType<typeof vi.fn>;
      generateRefreshToken: ReturnType<typeof vi.fn>;
      hashRefreshToken: ReturnType<typeof vi.fn>;
      verifyAccessToken: ReturnType<typeof vi.fn>;
    };
    usersService: {
      createUser: ReturnType<typeof vi.fn>;
      findByIdentifier: ReturnType<typeof vi.fn>;
      requireUserById: ReturnType<typeof vi.fn>;
      toPublicUser: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.spyOn(postgresModule, 'withTransaction').mockImplementation(async (operation) =>
      operation(transactionClient as never),
    );

    dependencies = {
      authRepository: {
        createSession: vi.fn(async () => ({
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash-next',
          expiresAt: new Date('2099-01-02T00:00:00.000Z'),
          revokedAt: null,
          rememberDevice: true,
          deviceName: 'Mac',
          appAgent: 'DAB',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        })),
        findById: vi.fn(async () => null),
        findByRefreshTokenHash: vi.fn(async () => null),
        revokeSessionById: vi.fn(async () => undefined),
        rotateSession: vi.fn(async () => ({
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash-next',
          expiresAt: new Date('2099-01-02T00:00:00.000Z'),
          revokedAt: null,
          rememberDevice: true,
          deviceName: 'Updated Device',
          appAgent: 'Updated Agent',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        })),
      },
      passwordService: {
        hashPassword: vi.fn(async () => 'password-hash'),
        verifyPassword: vi.fn(async () => true),
      },
      profileService: {
        ensureStorage: vi.fn(async () => undefined),
        recordDeviceAccess: vi.fn(async () => undefined),
      },
      tokenService: {
        generateAccessToken: vi.fn(() => ({
          token: 'access-token',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        })),
        generateRefreshToken: vi.fn(() => 'refresh-token'),
        hashRefreshToken: vi.fn((value: string) => `hashed:${value}`),
        verifyAccessToken: vi.fn(),
      },
      usersService: {
        createUser: vi.fn(async () => ({
          id: 'user-1',
          email: 'player@example.com',
          name: 'Player One',
          nickname: 'player.one',
          passwordHash: 'password-hash',
          profileImageUrl: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        })),
        findByIdentifier: vi.fn(async () => ({
          id: 'user-1',
          email: 'player@example.com',
          name: 'Player One',
          nickname: 'player.one',
          passwordHash: 'password-hash',
          profileImageUrl: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        })),
        requireUserById: vi.fn(async () => ({
          id: 'user-1',
          email: 'player@example.com',
          name: 'Player One',
          nickname: 'player.one',
          passwordHash: 'password-hash',
          profileImageUrl: null,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        })),
        toPublicUser: vi.fn((user) => ({
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          profileImageUrl: user.profileImageUrl,
          createdAt: user.createdAt.toISOString(),
        })),
      },
    };
  });

  it('registers a user with a hashed password', async () => {
    const service = new AuthService(dependencies as never);

    await expect(
      service.register({
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        password: 'SenhaForte123!',
      }),
    ).resolves.toEqual({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        profileImageUrl: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    });

    expect(dependencies.passwordService.hashPassword).toHaveBeenCalledWith('SenhaForte123!');
    expect(dependencies.usersService.createUser).toHaveBeenCalledWith({
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      passwordHash: 'password-hash',
    });
  });

  it('rejects invalid credentials during login', async () => {
    const service = new AuthService(dependencies as never);

    dependencies.usersService.findByIdentifier.mockResolvedValueOnce(null);
    await expectRejectedAppError(
      service.login({
        identifier: 'player@example.com',
        password: 'wrong',
        rememberDevice: false,
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      },
    );

    dependencies.passwordService.verifyPassword.mockResolvedValueOnce(false);
    await expectRejectedAppError(
      service.login({
        identifier: 'player@example.com',
        password: 'wrong',
        rememberDevice: false,
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      },
    );
  });

  it('issues sessions during login with remembered and non-remembered expiry windows', async () => {
    const service = new AuthService(dependencies as never);
    const now = new Date('2024-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const remembered = await service.login({
      identifier: 'player@example.com',
      password: 'SenhaForte123!',
      rememberDevice: true,
      deviceId: 'device-1',
      deviceName: 'Mac',
      osName: 'macOS',
      osVersion: '14.0',
      appAgent: 'DAB',
      appVersion: '0.1.0',
    });

    expect(remembered).toEqual({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        profileImageUrl: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      accessToken: 'access-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      refreshToken: 'refresh-token',
      sessionExpiresAt: '2099-01-02T00:00:00.000Z',
      rememberDevice: true,
    });
    expect(dependencies.authRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenHash: 'hashed:refresh-token',
        rememberDevice: true,
        deviceName: 'Mac',
        appAgent: 'DAB',
      }),
      transactionClient,
    );
    expect(dependencies.authRepository.createSession.mock.calls[0]?.[0].expiresAt.toISOString()).toBe(
      new Date('2024-01-31T00:00:00.000Z').toISOString(),
    );

    await service.login({
      identifier: 'player@example.com',
      password: 'SenhaForte123!',
      rememberDevice: false,
      deviceId: 'device-1',
      osName: 'macOS',
    });
    expect(
      dependencies.authRepository.createSession.mock.calls[1]?.[0].expiresAt.toISOString(),
    ).toBe(
      new Date(now.getTime() + env.SESSION_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString(),
    );
    expect(dependencies.profileService.recordDeviceAccess).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('refreshes active sessions and rotates refresh tokens', async () => {
    const service = new AuthService(dependencies as never);

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: true,
      deviceName: 'Original Device',
      appAgent: 'Original Agent',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    await expect(
      service.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        deviceName: 'Updated Device',
        osName: 'macOS',
        osVersion: '14.0',
        appAgent: 'Updated Agent',
        appVersion: '0.1.0',
      }),
    ).resolves.toEqual({
      user: {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        profileImageUrl: null,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      accessToken: 'access-token',
      accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
      refreshToken: 'refresh-token',
      sessionExpiresAt: '2099-01-02T00:00:00.000Z',
      rememberDevice: true,
    });

    expect(dependencies.authRepository.findByRefreshTokenHash).toHaveBeenCalledWith(
      'hashed:refresh-token',
      transactionClient,
      {
        forUpdate: true,
      },
    );
    expect(dependencies.authRepository.rotateSession).toHaveBeenCalledWith(
      'session-1',
      {
        refreshTokenHash: 'hashed:refresh-token',
        deviceName: 'Updated Device',
        appAgent: 'Updated Agent',
      },
      transactionClient,
    );
    expect(dependencies.profileService.recordDeviceAccess).toHaveBeenCalledWith(
      'user-1',
      {
        appVersion: '0.1.0',
        deviceId: 'device-1',
        osName: 'macOS',
        osVersion: '14.0',
      },
      transactionClient,
    );
  });

  it('rejects invalid, revoked, and expired refresh sessions', async () => {
    const service = new AuthService(dependencies as never);

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce(null);
    await expectRejectedAppError(
      service.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
      code: 'REFRESH_TOKEN_INVALID',
      statusCode: 401,
      },
    );

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: new Date('2024-01-01T00:00:00.000Z'),
      rememberDevice: true,
      deviceName: null,
      appAgent: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    await expectRejectedAppError(
      service.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
      code: 'SESSION_REVOKED',
      statusCode: 401,
      },
    );

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: true,
      deviceName: null,
      appAgent: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    await expectRejectedAppError(
      service.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
      code: 'SESSION_EXPIRED',
      statusCode: 401,
      },
    );
  });

  it('logs out using refresh tokens, session ids, and ownership checks', async () => {
    const service = new AuthService(dependencies as never);

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce(null);
    await expectRejectedAppError(service.logout({ refreshToken: 'refresh-token' }), {
        code: 'REFRESH_TOKEN_INVALID',
        statusCode: 401,
      });

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'another-user',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: true,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expectRejectedAppError(
      service.logout({ refreshToken: 'refresh-token', userId: 'user-1' }),
      {
      code: 'FORBIDDEN',
      statusCode: 403,
      },
    );

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: true,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.logout({ refreshToken: 'refresh-token', userId: 'user-1' });
    expect(dependencies.authRepository.revokeSessionById).toHaveBeenCalledWith('session-1');

    dependencies.authRepository.findByRefreshTokenHash.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hashed:refresh-token',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: new Date(),
      rememberDevice: true,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.logout({ refreshToken: 'refresh-token', userId: 'user-1' });

    await expectRejectedAppError(service.logout({}), {
      code: 'LOGOUT_TARGET_REQUIRED',
      statusCode: 400,
    });

    dependencies.authRepository.findById.mockResolvedValueOnce(null);
    await expect(service.logout({ sessionId: 'session-1', userId: 'user-1' })).resolves.toBeUndefined();

    dependencies.authRepository.findById.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'another-user',
      refreshTokenHash: 'hash',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: false,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expectRejectedAppError(
      service.logout({ sessionId: 'session-1', userId: 'user-1' }),
      {
      code: 'FORBIDDEN',
      statusCode: 403,
      },
    );

    dependencies.authRepository.findById.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: null,
      rememberDevice: false,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.logout({ sessionId: 'session-1', userId: 'user-1' });

    dependencies.authRepository.findById.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      refreshTokenHash: 'hash',
      expiresAt: new Date('2099-01-02T00:00:00.000Z'),
      revokedAt: new Date(),
      rememberDevice: false,
      deviceName: null,
      appAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.logout({ sessionId: 'session-1', userId: 'user-1' });
  });

  it('returns the current authenticated user', async () => {
    const service = new AuthService(dependencies as never);

    await expect(service.getCurrentUser('user-1')).resolves.toEqual({
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      profileImageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(dependencies.usersService.requireUserById).toHaveBeenCalledWith('user-1');
  });
});
