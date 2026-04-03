import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postgresState = vi.hoisted(() => ({
  client: {},
  withTransaction: vi.fn(async (handler: (client: object) => Promise<unknown>) =>
    handler(postgresState.client),
  ),
}));

vi.mock('../../app/backend/lib/postgres', () => ({
  withTransaction: postgresState.withTransaction,
}));

import { AppError } from '../../app/backend/lib/app-error';
import { createSocialController } from '../../app/backend/controllers/social.controller';
import { createFriendsRouter } from '../../app/backend/routes/friends.routes';
import { createUsersRouter } from '../../app/backend/routes/users.routes';
import { SocialService } from '../../app/backend/services/social.service';
import type { FriendshipRecord, SocialUserRecord } from '../../app/backend/types/social.types';
import {
  friendRequestSchema,
  publicProfileParamsSchema,
  socialDirectoryQuerySchema,
  updatePresenceSchema,
} from '../../app/backend/validators/social.validator';

function createSocialUserRecord(overrides: Partial<SocialUserRecord> = {}): SocialUserRecord {
  return {
    createdAt: new Date('2026-03-31T00:00:00.000Z'),
    currentActivity: 'In launcher',
    id: 'user-2',
    lastSeenAt: new Date('2026-04-02T00:00:00.000Z'),
    name: 'Kael',
    nickname: 'kael',
    presenceStatus: 'in_launcher',
    profileImageUrl: null,
    relationshipAddresseeUserId: null,
    relationshipId: null,
    relationshipRequesterUserId: null,
    relationshipStatus: null,
    ...overrides,
  };
}

function createFriendshipRecord(overrides: Partial<FriendshipRecord> = {}): FriendshipRecord {
  return {
    addresseeUserId: 'user-2',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    id: '6ed6c420-1d64-4f1b-afad-a1310f734111',
    requesterUserId: 'user-1',
    status: 'pending',
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    ...overrides,
  };
}

async function flushAsyncHandler(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('backend social validators', () => {
  it('parses valid social payloads with defaults', () => {
    expect(socialDirectoryQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 18,
      presence: 'all',
      q: '',
      relationship: 'all',
    });

    expect(
      socialDirectoryQuerySchema.parse({
        page: '2',
        pageSize: '12',
        presence: 'offline',
        q: ' kael ',
        relationship: 'friends',
      }),
    ).toEqual({
      page: 2,
      pageSize: 12,
      presence: 'offline',
      q: 'kael',
      relationship: 'friends',
    });

    expect(friendRequestSchema.parse({ nickname: ' Kael_01 ' })).toEqual({
      nickname: 'Kael_01',
    });

    expect(publicProfileParamsSchema.parse({ nickname: 'Kael-01' })).toEqual({
      nickname: 'Kael-01',
    });

    expect(
      updatePresenceSchema.parse({
        currentActivity: ' Queueing ',
        status: 'in_launcher',
      }),
    ).toEqual({
      currentActivity: 'Queueing',
      status: 'in_launcher',
    });
  });

  it('rejects invalid social payloads', () => {
    expect(() => friendRequestSchema.parse({ nickname: 'a' })).toThrow();
    expect(() =>
      socialDirectoryQuerySchema.parse({
        page: 0,
      }),
    ).toThrow();
    expect(() =>
      updatePresenceSchema.parse({
        currentActivity: 'x'.repeat(61),
        status: 'online',
      }),
    ).toThrow();
  });
});

describe('backend social service', () => {
  beforeEach(() => {
    postgresState.withTransaction.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists global users and computes pagination metadata', async () => {
    const repository = {
      listGlobalUsers: vi.fn(async () => ({
        total: 25,
        users: [
          createSocialUserRecord({
            relationshipId: 'friendship-1',
            relationshipStatus: 'accepted',
          }),
        ],
      })),
    };
    const usersService = {};
    const service = new SocialService(repository as never, usersService as never);

    const result = await service.listGlobalUsers('viewer-1', {
      page: 1,
      pageSize: 18,
      presence: 'all',
      query: 'kael',
      relationship: 'all',
    });

    expect(repository.listGlobalUsers).toHaveBeenCalledWith('viewer-1', {
      page: 1,
      pageSize: 18,
      presence: 'all',
      query: 'kael',
      relationship: 'all',
    });
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(25);
    expect(result.users[0]).toMatchObject({
      nickname: 'kael',
      relationship: {
        friendshipId: 'friendship-1',
        requestId: null,
        state: 'friends',
      },
    });
  });

  it('creates a friend request when there is no existing relationship', async () => {
    const repository = {
      createFriendRequest: vi.fn(async () => undefined),
      findFriendshipBetweenUsers: vi.fn(async () => null),
    };
    const usersService = {
      findByNickname: vi.fn(async () => ({
        id: 'user-2',
      })),
    };
    const service = new SocialService(repository as never, usersService as never);

    await service.sendFriendRequest('user-1', ' Kael ');

    expect(usersService.findByNickname).toHaveBeenCalledWith('kael');
    expect(postgresState.withTransaction).toHaveBeenCalledTimes(1);
    expect(repository.findFriendshipBetweenUsers).toHaveBeenCalledWith(
      'user-1',
      'user-2',
      postgresState.client,
      {
        forUpdate: true,
      },
    );
    expect(repository.createFriendRequest).toHaveBeenCalledWith(
      'user-1',
      'user-2',
      postgresState.client,
    );
  });

  it('rejects invalid friendship transitions', async () => {
    const repository = {
      findFriendshipBetweenUsers: vi.fn(async () =>
        createFriendshipRecord({
          id: 'friendship-accepted',
          status: 'accepted',
        }),
      ),
    };
    const usersService = {
      findByNickname: vi.fn(async () => ({
        id: 'user-2',
      })),
    };
    const service = new SocialService(repository as never, usersService as never);

    await expect(service.sendFriendRequest('user-1', 'kael')).rejects.toMatchObject({
      code: 'ALREADY_FRIENDS',
      statusCode: 409,
    });

    usersService.findByNickname.mockResolvedValueOnce({
      id: 'user-1',
    });
    await expect(service.sendFriendRequest('user-1', 'self')).rejects.toMatchObject({
      code: 'SELF_FRIEND_REQUEST',
      statusCode: 400,
    });
  });

  it('accepts, rejects, cancels, and removes friendships with ownership checks', async () => {
    const repository = {
      deleteFriendship: vi.fn(async () => undefined),
      findFriendshipById: vi
        .fn()
        .mockResolvedValueOnce(
          createFriendshipRecord({
            addresseeUserId: 'user-1',
          }),
        )
        .mockResolvedValueOnce(
          createFriendshipRecord({
            addresseeUserId: 'user-1',
          }),
        )
        .mockResolvedValueOnce(
          createFriendshipRecord({
            requesterUserId: 'user-1',
          }),
        )
        .mockResolvedValueOnce(
          createFriendshipRecord({
            id: 'friendship-live',
            requesterUserId: 'user-2',
            addresseeUserId: 'user-1',
            status: 'accepted',
          }),
        ),
      updateFriendshipStatus: vi.fn(async () => undefined),
    };
    const service = new SocialService(repository as never, {} as never);

    await service.acceptFriendRequest('user-1', '2d8d367c-f1f3-40aa-9601-11cd2ec8fd56');
    await service.rejectFriendRequest('user-1', 'af01cdae-5388-4832-8df3-76412530494a');
    await service.cancelOutgoingRequest('user-1', '043e2cb7-cd6a-4d77-a9d3-0b9ef4fbe76f');
    await service.removeFriend('user-1', 'c9ec3ecb-2734-4db6-8c57-1b98f5388add');

    expect(repository.updateFriendshipStatus).toHaveBeenCalledWith(
      '2d8d367c-f1f3-40aa-9601-11cd2ec8fd56',
      'accepted',
      postgresState.client,
    );
    expect(repository.deleteFriendship).toHaveBeenCalledTimes(3);
  });

  it('updates and normalizes presence payloads', async () => {
    const repository = {
      updatePresence: vi.fn(async () => undefined),
    };
    const service = new SocialService(repository as never, {} as never);

    await service.updatePresence('user-1', {
      currentActivity: ' Queueing ',
      status: 'online',
    });
    await service.markUserInLauncher('user-1');
    await service.markUserOffline('user-1');

    expect(repository.updatePresence).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'online',
      'Queueing',
      undefined,
    );
    expect(repository.updatePresence).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'in_launcher',
      'In launcher',
      undefined,
    );
    expect(repository.updatePresence).toHaveBeenNthCalledWith(
      3,
      'user-1',
      'offline',
      null,
      undefined,
    );
  });
});

describe('backend social controller and routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds controller handlers to the social service and enforces auth', async () => {
    const socialService = {
      getPublicProfile: vi.fn(async () => ({
        profile: {
          nickname: 'kael',
        },
      })),
      listGlobalUsers: vi.fn(async () => ({
        users: [],
      })),
      sendFriendRequest: vi.fn(async () => undefined),
    };
    const controller = createSocialController(socialService as never);
    const response = {
      json: vi.fn(),
      send: vi.fn(),
      status: vi.fn(function status() {
        return response;
      }),
    };
    const next = vi.fn();

    controller.globalUsers(
      {
        authContext: {
          userId: 'viewer-1',
        },
        query: {
          page: '2',
          presence: 'offline',
          q: ' kael ',
          relationship: 'friends',
        },
      } as never,
      response as never,
      next,
    );
    await flushAsyncHandler();

    expect(socialService.listGlobalUsers).toHaveBeenCalledWith('viewer-1', {
      page: 2,
      pageSize: 18,
      presence: 'offline',
      query: 'kael',
      relationship: 'friends',
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      users: [],
    });

    controller.publicProfile(
      {
        authContext: {
          userId: 'viewer-1',
        },
        params: {
          nickname: 'kael',
        },
      } as never,
      response as never,
      next,
    );
    await flushAsyncHandler();

    expect(socialService.getPublicProfile).toHaveBeenCalledWith('viewer-1', 'kael');

    controller.sendFriendRequest(
      {
        authContext: {
          userId: 'viewer-1',
        },
        body: {
          nickname: ' Kael ',
        },
      } as never,
      response as never,
      next,
    );
    await flushAsyncHandler();

    expect(socialService.sendFriendRequest).toHaveBeenCalledWith('viewer-1', 'Kael');

    controller.globalUsers(
      {
        query: {},
      } as never,
      response as never,
      next,
    );
    await flushAsyncHandler();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    );
  });

  it('mounts users and friends social routes', async () => {
    const app = express();
    const authMiddleware = vi.fn((req, _res, next) => {
      req.authContext = {
        email: 'player@example.com',
        nickname: 'player.one',
        sessionId: 'session-1',
        userId: 'user-1',
      };
      next();
    });
    const socialController = {
      acceptFriendRequest: (_req: express.Request, res: express.Response) => res.status(204).send(),
      cancelOutgoingRequest: (_req: express.Request, res: express.Response) =>
        res.status(204).send(),
      friends: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'friends' }),
      globalUsers: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'global' }),
      incomingRequests: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'incoming' }),
      outgoingRequests: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'outgoing' }),
      publicProfile: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'profile' }),
      rejectFriendRequest: (_req: express.Request, res: express.Response) => res.status(204).send(),
      removeFriend: (_req: express.Request, res: express.Response) => res.status(204).send(),
      searchUsers: (_req: express.Request, res: express.Response) =>
        res.status(200).json({ ok: 'search' }),
      sendFriendRequest: (_req: express.Request, res: express.Response) =>
        res.status(201).json({ ok: 'request' }),
    };

    app.use(
      '/users',
      createUsersRouter({
        authMiddleware: authMiddleware as never,
        socialController: socialController as never,
      }),
    );
    app.use(
      '/friends',
      createFriendsRouter({
        authMiddleware: authMiddleware as never,
        socialController: socialController as never,
      }),
    );

    await request(app).get('/users/global').expect(200, { ok: 'global' });
    await request(app).get('/users/search').expect(200, { ok: 'search' });
    await request(app).get('/users/kael/public-profile').expect(200, { ok: 'profile' });
    await request(app).get('/friends').expect(200, { ok: 'friends' });
    await request(app).get('/friends/requests/incoming').expect(200, { ok: 'incoming' });
    await request(app).get('/friends/requests/outgoing').expect(200, { ok: 'outgoing' });
    await request(app).post('/friends/request').expect(201, { ok: 'request' });
    await request(app).post('/friends/6ed6c420-1d64-4f1b-afad-a1310f734111/accept').expect(204);
    await request(app).post('/friends/6ed6c420-1d64-4f1b-afad-a1310f734111/reject').expect(204);
    await request(app).delete('/friends/requests/6ed6c420-1d64-4f1b-afad-a1310f734111').expect(204);
    await request(app).delete('/friends/6ed6c420-1d64-4f1b-afad-a1310f734111').expect(204);

    expect(authMiddleware).toHaveBeenCalled();
  });
});
