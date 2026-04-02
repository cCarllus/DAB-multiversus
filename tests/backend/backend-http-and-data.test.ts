import express from 'express';
import request from 'supertest';
import { ZodError, z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthController } from '../../app/backend/controllers/auth.controller';
import { createProfileController } from '../../app/backend/controllers/profile.controller';
import { createApp } from '../../app/backend/lib/create-app';
import { AppError } from '../../app/backend/lib/app-error';
import { createAuthMiddleware, createOptionalAuthMiddleware } from '../../app/backend/middleware/auth.middleware';
import { errorMiddleware } from '../../app/backend/middleware/error.middleware';
import { AuthRepository } from '../../app/backend/repositories/auth.repository';
import { ProfileRepository } from '../../app/backend/repositories/profile.repository';
import { UsersRepository } from '../../app/backend/repositories/users.repository';
import { createAuthRouter } from '../../app/backend/routes/auth.routes';
import { createProfileRouter } from '../../app/backend/routes/profile.routes';
import { env } from '../../config/env/backend-env';
import { createRequest, createResponse } from '../helpers/backend';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('backend repositories', () => {
  let database: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    database = {
      query: vi.fn(),
    };
  });

  it('maps rows in the users repository and enforces returned rows', async () => {
    const repository = new UsersRepository(database as never);
    const row = {
      id: 'user-1',
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      password_hash: 'hash',
      profile_image_url: '/uploads/avatars/a.png',
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-02T00:00:00.000Z'),
    };

    database.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] });

    await expect(repository.findById('user-1')).resolves.toMatchObject({
      id: 'user-1',
      passwordHash: 'hash',
      profileImageUrl: '/uploads/avatars/a.png',
    });
    await expect(repository.findByEmail('player@example.com')).resolves.toMatchObject({
      email: 'player@example.com',
    });
    await expect(repository.findByNickname('player.one')).resolves.toMatchObject({
      nickname: 'player.one',
    });
    await expect(repository.findByIdentifier('player.one')).resolves.toMatchObject({
      nickname: 'player.one',
    });
    await expect(
      repository.create({
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        passwordHash: 'hash',
      }),
    ).resolves.toMatchObject({
      id: 'user-1',
    });
    await expect(
      repository.updateProfile('user-1', {
        name: 'New Name',
      }),
    ).resolves.toMatchObject({
      name: 'Player One',
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.findById('missing')).resolves.toBeNull();

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.create({
        email: 'player@example.com',
        name: 'Player One',
        nickname: 'player.one',
        passwordHash: 'hash',
      }),
    ).rejects.toThrow('User creation did not return a database row.');

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.updateProfile('user-1', {})).rejects.toThrow(
      'Profile update did not return a database row.',
    );
  });

  it('maps rows in the auth repository and handles missing sessions', async () => {
    const repository = new AuthRepository(database as never);
    const row = {
      id: 'session-1',
      user_id: 'user-1',
      refresh_token_hash: 'hash',
      expires_at: new Date('2099-01-01T00:00:00.000Z'),
      revoked_at: null,
      remember_device: true,
      device_name: 'Mac',
      app_agent: 'DAB',
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-01T00:00:00.000Z'),
    };

    database.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [row] });

    await expect(
      repository.createSession({
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        rememberDevice: true,
        deviceName: 'Mac',
        appAgent: 'DAB',
      }),
    ).resolves.toMatchObject({
      id: 'session-1',
      userId: 'user-1',
      rememberDevice: true,
    });

    await expect(repository.findById('session-1')).resolves.toMatchObject({
      id: 'session-1',
    });
    expect(database.query.mock.calls[1]?.[0]).not.toContain('FOR UPDATE');

    await expect(
      repository.findByRefreshTokenHash('hash', undefined, {
        forUpdate: true,
      }),
    ).resolves.toMatchObject({
      refreshTokenHash: 'hash',
    });
    expect(database.query.mock.calls[2]?.[0]).toContain('FOR UPDATE');

    await expect(
      repository.rotateSession('session-1', {
        refreshTokenHash: 'next-hash',
        deviceName: 'Updated Device',
        appAgent: 'Updated Agent',
      }),
    ).resolves.toMatchObject({
      deviceName: 'Mac',
    });

    await expect(repository.revokeSessionById('session-1')).resolves.toMatchObject({
      id: 'session-1',
    });

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.createSession({
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date(),
        rememberDevice: false,
        deviceName: null,
        appAgent: null,
      }),
    ).rejects.toThrow('Session creation did not return a database row.');

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.rotateSession('missing', {
        refreshTokenHash: 'hash',
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`[AppError: Session could not be found.]`);

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.revokeSessionById('missing')).resolves.toBeNull();
  });

  it('maps device rows in the profile repository and enforces persistence results', async () => {
    const repository = new ProfileRepository(database as never);
    const row = {
      id: 'row-1',
      user_id: 'user-1',
      device_id: 'device-1',
      os_name: 'macOS',
      os_version: '14.0',
      app_version: '0.1.0',
      first_seen_at: new Date('2024-01-01T00:00:00.000Z'),
      last_login_at: new Date('2024-01-02T00:00:00.000Z'),
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      updated_at: new Date('2024-01-02T00:00:00.000Z'),
    };

    database.query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [row] });

    await expect(
      repository.upsertUserDevice('user-1', {
        deviceId: 'device-1',
        osName: 'macOS',
        osVersion: '14.0',
        appVersion: '0.1.0',
      }),
    ).resolves.toMatchObject({
      deviceId: 'device-1',
      osName: 'macOS',
    });

    await expect(repository.listUserDevices('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'row-1',
        userId: 'user-1',
        deviceId: 'device-1',
      }),
    ]);

    database.query.mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.upsertUserDevice('user-1', {
        deviceId: 'device-1',
        osName: 'macOS',
      }),
    ).rejects.toThrow('Device tracking did not return a database row.');
  });
});

describe('backend middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps handled and unhandled errors to API responses', () => {
    const response = createResponse();
    const next = vi.fn();

    errorMiddleware(new ZodError([]), {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(400);

    errorMiddleware(new AppError(403, 'FORBIDDEN', 'Denied', { x: true }), {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenLastCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Denied',
        details: { x: true },
      },
    });

    errorMiddleware({ code: '23505' }, {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(409);

    errorMiddleware({ code: 'ECONNREFUSED' }, {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(503);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    errorMiddleware(new Error('boom'), {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenLastCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.',
        details: 'boom',
      },
    });
    expect(errorSpy).toHaveBeenCalled();

    errorMiddleware('plain failure', {} as never, response, next);
    expect(response.status).toHaveBeenCalledWith(500);
  });

  it('attaches authenticated context for valid access tokens', async () => {
    const repository = {
      findById: vi.fn(async () => ({
        id: 'session-1',
        userId: 'user-1',
        refreshTokenHash: 'hash',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        revokedAt: null,
        rememberDevice: true,
        deviceName: null,
        appAgent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };
    const tokenService = {
      verifyAccessToken: vi.fn(() => ({
        sub: 'user-1',
        sid: 'session-1',
        email: 'player@example.com',
        nickname: 'player.one',
        type: 'access',
      })),
    };

    const request = createRequest({
      headers: {
        authorization: 'Bearer access-token',
      },
    });
    const next = vi.fn();

    createAuthMiddleware(repository as never, tokenService as never)(request, {} as never, next);
    await flush();

    expect(repository.findById).toHaveBeenCalledWith('session-1');
    expect(request.auth).toEqual({
      userId: 'user-1',
      sessionId: 'session-1',
      email: 'player@example.com',
      nickname: 'player.one',
    });
    expect(next).toHaveBeenCalled();
  });

  it('rejects invalid authenticated requests and ignores invalid optional auth', async () => {
    const tokenService = {
      verifyAccessToken: vi.fn(() => ({
        sub: 'user-1',
        sid: 'session-1',
        email: 'player@example.com',
        nickname: 'player.one',
        type: 'access',
      })),
    };

    const failingRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'session-1',
          userId: 'other-user',
          refreshTokenHash: 'hash',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          revokedAt: null,
          rememberDevice: true,
          deviceName: null,
          appAgent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          revokedAt: new Date(),
          rememberDevice: true,
          deviceName: null,
          appAgent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 'session-1',
          userId: 'user-1',
          refreshTokenHash: 'hash',
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
          revokedAt: null,
          rememberDevice: true,
          deviceName: null,
          appAgent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
    };
    const next = vi.fn();

    const noTokenRequest = createRequest();
    createAuthMiddleware(failingRepository as never, tokenService as never)(
      noTokenRequest,
      {} as never,
      next,
    );
    await flush();
    expect(next.mock.calls[0]?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });

    const invalidHeaderRequest = createRequest({
      headers: { authorization: 'Basic x' },
    });
    createOptionalAuthMiddleware(failingRepository as never, tokenService as never)(
      invalidHeaderRequest,
      {} as never,
      next,
    );
    await flush();
    expect(invalidHeaderRequest.auth).toBeUndefined();

    for (const expectedCode of ['UNAUTHORIZED', 'UNAUTHORIZED', 'SESSION_REVOKED', 'SESSION_EXPIRED']) {
      const request = createRequest({
        headers: { authorization: 'Bearer access-token' },
      });
      createAuthMiddleware(failingRepository as never, tokenService as never)(
        request,
        {} as never,
        next,
      );
      await flush();
      expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: expectedCode });
    }

    const optionalRequest = createRequest({
      headers: { authorization: 'Bearer access-token' },
      auth: {
        userId: 'stale',
        sessionId: 'stale',
        email: 'stale@example.com',
        nickname: 'stale',
      },
    });
    createOptionalAuthMiddleware(failingRepository as never, tokenService as never)(
      optionalRequest,
      {} as never,
      next,
    );
    await flush();
    expect(optionalRequest.auth).toBeUndefined();
  });
});

describe('backend controllers, routes, and app', () => {
  it('handles auth controller flows', async () => {
    const authService = {
      getCurrentUser: vi.fn(async () => ({ nickname: 'player.one' })),
      login: vi.fn(async () => ({ accessToken: 'token' })),
      logout: vi.fn(async () => undefined),
      refresh: vi.fn(async () => ({ accessToken: 'next-token' })),
      register: vi.fn(async () => ({ user: { nickname: 'player.one' } })),
    };
    const controller = createAuthController(authService as never);
    const response = createResponse();

    controller.register(
      createRequest({
        body: {
          email: 'player@example.com',
          nickname: 'player.one',
          password: '12345678',
        },
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(response.status).toHaveBeenCalledWith(201);

    controller.login(
      createRequest({
        body: {
          identifier: 'player@example.com',
          password: '12345678',
          deviceId: 'device-1234',
          osName: 'macOS',
        },
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(response.status).toHaveBeenCalledWith(200);

    controller.refresh(
      createRequest({
        body: {
          refreshToken: 'x'.repeat(32),
          deviceId: 'device-1234',
          osName: 'macOS',
        },
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(authService.refresh).toHaveBeenCalled();

    controller.logout(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
        body: {},
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: undefined,
      sessionId: 'session-1',
      userId: 'user-1',
    });
    expect(response.status).toHaveBeenCalledWith(204);

    controller.logout(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: undefined,
      sessionId: 'session-1',
      userId: 'user-1',
    });

    controller.me(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
      }),
      response,
      vi.fn(),
    );
    await flush();
    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(response.status.mock.calls.at(-1)?.[0]).toBe(200);

    const next = vi.fn();
    controller.me(createRequest(), response, next);
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('handles profile controller flows and auth requirements', async () => {
    const profileService = {
      getCurrentProfile: vi.fn(async () => ({ nickname: 'player.one' })),
      getProfileDevices: vi.fn(async () => ({ devices: [] })),
      updateProfileAvatar: vi.fn(async () => ({ nickname: 'player.one' })),
      updateProfileName: vi.fn(async () => ({ nickname: 'player.one' })),
    };
    const controller = createProfileController(profileService as never);
    const response = createResponse();
    const next = vi.fn();

    controller.me(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
      }),
      response,
      next,
    );
    await flush();
    expect(response.status).toHaveBeenCalledWith(200);

    controller.updateMe(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
        body: {
          name: 'Player One',
        },
      }),
      response,
      next,
    );
    await flush();
    expect(profileService.updateProfileName).toHaveBeenCalledWith('user-1', 'Player One');

    controller.uploadAvatar(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
        file: {
          buffer: Buffer.from('avatar'),
          mimetype: 'image/png',
          originalname: 'avatar.png',
        } as never,
      }),
      response,
      next,
    );
    await flush();
    expect(profileService.updateProfileAvatar).toHaveBeenCalled();

    controller.devices(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
        header: () => ' device-1 ',
      }),
      response,
      next,
    );
    await flush();
    expect(profileService.getProfileDevices).toHaveBeenCalledWith('user-1', 'device-1');

    controller.devices(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
        header: () => '   ',
      }),
      response,
      next,
    );
    await flush();
    expect(profileService.getProfileDevices).toHaveBeenCalledWith('user-1', undefined);

    controller.uploadAvatar(
      createRequest({
        auth: {
          userId: 'user-1',
          sessionId: 'session-1',
          email: 'player@example.com',
          nickname: 'player.one',
        },
      }),
      response,
      next,
    );
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'AVATAR_REQUIRED' });

    controller.me(createRequest(), response, next);
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });

    controller.updateMe(createRequest(), response, next);
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });

    controller.uploadAvatar(createRequest(), response, next);
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });

    controller.devices(createRequest(), response, next);
    await flush();
    expect(next.mock.calls.at(-1)?.[0]).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('routes auth and profile requests and validates uploads', async () => {
    const authHandler = vi.fn((_req, res) => res.status(200).json({ ok: true }));
    const authRouter = createAuthRouter({
      authController: {
        login: authHandler,
        logout: authHandler,
        me: authHandler,
        refresh: authHandler,
        register: authHandler,
      },
      authMiddleware: ((_req, _res, next) => next()) as never,
      optionalAuthMiddleware: ((_req, _res, next) => next()) as never,
    });
    const profileHandler = vi.fn((_req, res) => res.status(200).json({ ok: true }));
    const profileRouter = createProfileRouter({
      authMiddleware: ((_req, _res, next) => next()) as never,
      profileController: {
        devices: profileHandler,
        me: profileHandler,
        updateMe: profileHandler,
        uploadAvatar: profileHandler,
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/profile', profileRouter);
    app.use(errorMiddleware);

    await request(app).post('/auth/register').send({}).expect(200);
    await request(app).post('/auth/login').send({}).expect(200);
    await request(app).post('/auth/refresh').send({}).expect(200);
    await request(app).post('/auth/logout').send({ sessionId: 'not-a-uuid' }).expect(200);
    await request(app).get('/auth/me').expect(200);

    await request(app).get('/profile/me').expect(200);
    await request(app).patch('/profile/me').send({ name: 'Player One' }).expect(200);
    await request(app)
      .post('/profile/me/avatar')
      .attach('avatar', Buffer.from('avatar'), {
        filename: 'avatar.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    await request(app)
      .post('/profile/me/avatar')
      .attach('avatar', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app)
      .post('/profile/me/avatar')
      .attach('avatar', Buffer.from('avatar'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200);
    await request(app).get('/profile/me/devices').expect(200);

    expect(authHandler).toHaveBeenCalled();
    expect(profileHandler).toHaveBeenCalled();
  });

  it('builds the express app with CORS, health, static uploads, 404s, and error handling', async () => {
    const authRouter = express.Router();
    authRouter.get('/explode', () => {
      throw new AppError(418, 'TEAPOT', 'short and stout');
    });

    const profileRouter = express.Router();
    profileRouter.get('/db', () => {
      throw Object.assign(new Error('db down'), {
        code: '57P01',
      });
    });

    const app = createApp({
      authRouter,
      profileRouter,
    });

    await request(app).get('/health').expect(200, {
      status: 'ok',
    });
    await request(app).get('/auth/explode').expect(418);
    await request(app).get('/profile/db').expect(503);
    await request(app).get('/missing').expect(404, {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
    await request(app)
      .get('/health')
      .set('Origin', 'file://launcher')
      .expect('access-control-allow-origin', 'file://launcher')
      .expect(200);
    await request(app)
      .options('/health')
      .set('Origin', 'https://forbidden.example.com')
      .expect(403);

    const previousAllowedOrigins = [...env.allowedOrigins];
    env.allowedOrigins.length = 0;
    try {
      await request(app)
        .get('/health')
        .set('Origin', 'https://forbidden.example.com')
        .expect('access-control-allow-origin', 'https://forbidden.example.com')
        .expect(200);
    } finally {
      env.allowedOrigins.splice(0, env.allowedOrigins.length, ...previousAllowedOrigins);
    }
  });
});
