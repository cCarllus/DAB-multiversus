import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../app/backend/lib/app-error';
import { asyncHandler } from '../../app/backend/lib/async-handler';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  PROFILE_AVATAR_ROUTE_PREFIX,
  PROFILE_AVATARS_ROOT,
  PROFILE_UPLOADS_ROOT,
  ensureProfileStorage,
  isLocalAvatarPath,
  resolveAvatarAbsolutePath,
  resolveAvatarPublicPath,
} from '../../app/backend/lib/profile-storage';
import { PasswordService } from '../../app/backend/services/password.service';
import { TokenService } from '../../app/backend/services/token.service';
import { UsersService } from '../../app/backend/services/users.service';
import { loginRequestSchema, logoutRequestSchema, refreshRequestSchema, registerRequestSchema } from '../../app/backend/validators/auth.validator';
import { updateProfileRequestSchema } from '../../app/backend/validators/profile.validator';
import type { UserRecord } from '../../app/backend/types/users.types';
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

function expectThrownAppError(
  action: () => unknown,
  expected: { code: string; statusCode: number },
): void {
  try {
    action();
    throw new Error('Expected function to throw.');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject(expected);
  }
}

describe('backend core utilities', () => {
  it('stores app error metadata', () => {
    const error = new AppError(418, 'TEAPOT', 'short and stout', { cup: true });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('TEAPOT');
    expect(error.message).toBe('short and stout');
    expect(error.details).toEqual({ cup: true });
  });

  it('wraps async request handlers and forwards failures', async () => {
    const response = {} as never;
    const next = vi.fn();
    const request = {} as never;

    const successHandler = asyncHandler(async () => undefined);
    successHandler(request, response, next);
    await Promise.resolve();
    expect(next).not.toHaveBeenCalled();

    const error = new Error('boom');
    const failingHandler = asyncHandler(async () => {
      throw error;
    });

    failingHandler(request, response, next);
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });

  it('creates and resolves avatar storage paths', async () => {
    await ensureProfileStorage();

    expect(PROFILE_UPLOADS_ROOT.endsWith('/storage/uploads')).toBe(true);
    expect(PROFILE_AVATARS_ROOT.endsWith('/storage/uploads/avatars')).toBe(true);
    expect(ALLOWED_AVATAR_MIME_TYPES.get('image/png')).toBe('png');
    expect(resolveAvatarPublicPath('avatar.png')).toBe(`${PROFILE_AVATAR_ROUTE_PREFIX}avatar.png`);
    expect(resolveAvatarAbsolutePath('avatar.png')).toContain('/storage/uploads/avatars/avatar.png');
    expect(isLocalAvatarPath('/uploads/avatars/avatar.png')).toBe(true);
    expect(isLocalAvatarPath('https://example.com/avatar.png')).toBe(false);
    expect(isLocalAvatarPath(null)).toBe(false);
  });
});

describe('backend validators', () => {
  it('parses valid auth and profile payloads', () => {
    expect(
      registerRequestSchema.parse({
        email: ' PLAYER@EXAMPLE.COM ',
        name: ' Player One ',
        nickname: 'Player.One',
        password: '12345678',
      }),
    ).toEqual({
      email: 'PLAYER@EXAMPLE.COM',
      name: 'Player One',
      nickname: 'Player.One',
      password: '12345678',
    });

    expect(
      loginRequestSchema.parse({
        identifier: 'player@example.com',
        password: '12345678',
        deviceId: 'device-1234',
        osName: 'macOS',
      }).rememberDevice,
    ).toBe(false);

    expect(
      refreshRequestSchema.parse({
        refreshToken: 'x'.repeat(32),
        deviceId: 'device-1234',
        osName: 'macOS',
      }).refreshToken,
    ).toHaveLength(32);

    expect(
      logoutRequestSchema.parse({
        refreshToken: 'x'.repeat(32),
      }).refreshToken,
    ).toHaveLength(32);

    expect(updateProfileRequestSchema.parse({ name: ' Player One ' })).toEqual({
      name: 'Player One',
    });
  });

  it('rejects invalid auth and profile payloads', () => {
    expect(() =>
      registerRequestSchema.parse({
        email: 'bad',
        nickname: 'a',
        password: 'short',
      }),
    ).toThrow();

    expect(() =>
      loginRequestSchema.parse({
        identifier: 'ab',
        password: 'short',
        deviceId: 'tiny',
        osName: 'x',
      }),
    ).toThrow();

    expect(() =>
      refreshRequestSchema.parse({
        refreshToken: 'tiny',
        deviceId: 'device-1234',
        osName: 'macOS',
      }),
    ).toThrow();

    expect(() =>
      logoutRequestSchema.parse({
        sessionId: 'not-a-uuid',
      }),
    ).toThrow();

    expect(() =>
      updateProfileRequestSchema.parse({
        name: 'a',
      }),
    ).toThrow();
  });
});

describe('backend security services', () => {
  it('hashes and verifies passwords', async () => {
    const service = new PasswordService();
    const hash = await service.hashPassword('SenhaForte123!');

    expect(hash).not.toBe('SenhaForte123!');
    await expect(service.verifyPassword('SenhaForte123!', hash)).resolves.toBe(true);
    await expect(service.verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('generates and validates access and refresh tokens', () => {
    const service = new TokenService();
    const accessToken = service.generateAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      email: 'player@example.com',
      nickname: 'player.one',
    });

    expect(accessToken.token).toBeTypeOf('string');
    expect(accessToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(service.verifyAccessToken(accessToken.token)).toEqual({
      sub: 'user-1',
      sid: 'session-1',
      email: 'player@example.com',
      nickname: 'player.one',
      type: 'access',
    });

    const refreshToken = service.generateRefreshToken();
    expect(refreshToken.length).toBeGreaterThan(40);
    expect(service.hashRefreshToken(refreshToken)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects expired and malformed access tokens', () => {
    const service = new TokenService();

    const expiredToken = jwt.sign(
      {
        sub: 'user-1',
        sid: 'session-1',
        email: 'player@example.com',
        nickname: 'player.one',
        type: 'access',
      },
      env.ACCESS_TOKEN_SECRET,
      {
        algorithm: 'HS256',
        issuer: 'dead-as-battle-auth',
        audience: 'dead-as-battle-launcher',
        expiresIn: -1,
      },
    );

    expectThrownAppError(() => service.verifyAccessToken(expiredToken), {
      code: 'ACCESS_TOKEN_EXPIRED',
      statusCode: 401,
    });

    const invalidToken = jwt.sign(
      {
        sub: 'user-1',
        sid: 'session-1',
        email: 'player@example.com',
        nickname: 'player.one',
        type: 'refresh',
      },
      env.ACCESS_TOKEN_SECRET,
      {
        algorithm: 'HS256',
        issuer: 'dead-as-battle-auth',
        audience: 'dead-as-battle-launcher',
        expiresIn: 60,
      },
    );

    expectThrownAppError(() => service.verifyAccessToken(invalidToken), {
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });

    expectThrownAppError(() => service.verifyAccessToken('bad-token'), {
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });
});

describe('users service', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIdentifier: ReturnType<typeof vi.fn>;
    findByNickname: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
  };

  let service: UsersService;
  let user: UserRecord;

  beforeEach(() => {
    user = {
      id: 'user-1',
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      passwordHash: 'hash',
      profileImageUrl: null,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    repository = {
      create: vi.fn(async () => user),
      findByEmail: vi.fn(async () => null),
      findById: vi.fn(async () => user),
      findByIdentifier: vi.fn(async () => user),
      findByNickname: vi.fn(async () => null),
      updateProfile: vi.fn(async () => user),
    };
    service = new UsersService(repository as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a normalized user when email and nickname are available', async () => {
    const created = await service.createUser({
      email: ' PLAYER@EXAMPLE.COM ',
      name: '  Player    One ',
      nickname: ' Player.One ',
      passwordHash: 'hash',
    });

    expect(repository.findByEmail).toHaveBeenCalledWith('player@example.com', undefined);
    expect(repository.findByNickname).toHaveBeenCalledWith('player.one', undefined);
    expect(repository.create).toHaveBeenCalledWith(
      {
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        passwordHash: 'hash',
      },
      undefined,
    );
    expect(created).toBe(user);
  });

  it('falls back to nickname as the display name', async () => {
    await service.createUser({
      email: 'player@example.com',
      nickname: 'Player.One',
      passwordHash: 'hash',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'player.one',
      }),
      undefined,
    );
  });

  it('rejects duplicate emails and nicknames', async () => {
    repository.findByEmail.mockResolvedValueOnce(user);
    await expectRejectedAppError(
      service.createUser({
        email: 'player@example.com',
        nickname: 'player.one',
        passwordHash: 'hash',
      }),
      {
      code: 'EMAIL_ALREADY_IN_USE',
      statusCode: 409,
      },
    );

    repository.findByEmail.mockResolvedValueOnce(null);
    repository.findByNickname.mockResolvedValueOnce(user);
    await expectRejectedAppError(
      service.createUser({
        email: 'player@example.com',
        nickname: 'player.one',
        passwordHash: 'hash',
      }),
      {
      code: 'NICKNAME_ALREADY_IN_USE',
      statusCode: 409,
      },
    );
  });

  it('normalizes identifier lookup and exposes public user data', async () => {
    await expect(service.findByIdentifier(' PLAYER@EXAMPLE.COM ')).resolves.toBe(user);
    expect(repository.findByIdentifier).toHaveBeenCalledWith('player@example.com', undefined);
    await expect(service.findById('user-1')).resolves.toBe(user);
    await expect(service.requireUserById('user-1')).resolves.toBe(user);
    expect(service.toPublicUser(user)).toEqual({
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      profileImageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
  });

  it('throws when a required user cannot be found', async () => {
    repository.findById.mockResolvedValueOnce(null);

    await expectRejectedAppError(service.requireUserById('missing'), {
      code: 'USER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('updates names and profile images', async () => {
    await expect(service.updateName('user-1', '  New   Name ')).resolves.toBe(user);
    expect(repository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      {
        name: 'New Name',
      },
      undefined,
    );

    await expect(service.updateProfileImage('user-1', '/uploads/avatars/a.png')).resolves.toBe(
      user,
    );
    expect(repository.updateProfile).toHaveBeenCalledWith(
      'user-1',
      {
        profileImageUrl: '/uploads/avatars/a.png',
      },
      undefined,
    );
  });

  it('rejects empty normalized names', async () => {
    await expectRejectedAppError(service.updateName('user-1', '    '), {
      code: 'INVALID_NAME',
      statusCode: 400,
    });
  });
});
