// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SocialApiClient } from '../../app/frontend/services/social/social-api-client';
import { createProfileScreen } from '../../app/frontend/screens/profile/profile-screen';
import { createSocialScreen } from '../../app/frontend/screens/social/social-screen';
import { SocialStore } from '../../app/frontend/stores/social.store';
import {
  createTestI18n,
  createTestSessionSnapshot,
  createTestUser,
  flushPromises,
  resetDom,
} from '../helpers/frontend';
import type {
  PresencePayload,
  SocialDirectoryResponse,
  SocialFriendRequestsResponse,
  SocialFriendsResponse,
  SocialSnapshot,
  SocialUserSummary,
} from '../../app/frontend/services/social/social-types';
import type { SocialLivePresenceEntry } from '../../app/shared/contracts/social.contract';

type FakeRealtimeEvent =
  | {
      type: 'connected';
    }
  | {
      type: 'disconnected';
    }
  | {
      entry: SocialLivePresenceEntry;
      type: 'presence';
    }
  | {
      entries: SocialLivePresenceEntry[];
      type: 'snapshot';
    };

function createSocialUser(overrides: Partial<SocialUserSummary> = {}): SocialUserSummary {
  return {
    createdAt: '2026-03-31T00:00:00.000Z',
    name: 'Kael',
    nickname: 'kael',
    presence: {
      currentActivity: 'In launcher',
      lastSeenAt: '2026-04-02T00:00:00.000Z',
      status: 'in_launcher',
    },
    profileImageUrl: null,
    relationship: {
      friendshipId: null,
      requestId: null,
      state: 'none',
    },
    ...overrides,
  };
}

function createDirectoryResponse(
  users: SocialUserSummary[] = [createSocialUser()],
  overrides: Partial<SocialDirectoryResponse> = {},
): SocialDirectoryResponse {
  return {
    filters: {
      presence: 'all',
      relationship: 'all',
    },
    hasMore: false,
    page: 1,
    pageSize: 18,
    query: '',
    total: users.length,
    users,
    ...overrides,
  };
}

function createFriendsResponse(friends: SocialUserSummary[] = []): SocialFriendsResponse {
  return {
    friends,
    total: friends.length,
  };
}

function createRequestsResponse(
  requests: SocialFriendRequestsResponse['requests'] = [],
): SocialFriendRequestsResponse {
  return {
    requests,
    total: requests.length,
  };
}

function createSocialSnapshot(overrides: Partial<SocialSnapshot> = {}): SocialSnapshot {
  const users = [createSocialUser()];

  return {
    directory: createDirectoryResponse(users),
    friends: createFriendsResponse(),
    incomingRequests: createRequestsResponse(),
    outgoingRequests: createRequestsResponse(),
    profile: users[0] ?? null,
    ...overrides,
  };
}

class FakeRealtimeService {
  connectResult = true;

  readonly connect = vi.fn(async () => this.connectResult);

  readonly disconnect = vi.fn(async () => undefined);

  readonly updatePresence: (payload: PresencePayload) => Promise<void> = vi.fn(
    async () => undefined,
  );

  private listeners = new Set<(event: FakeRealtimeEvent) => void>();

  subscribe(listener: (event: FakeRealtimeEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: FakeRealtimeEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}

describe('frontend social api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles social directory, profile, friendship, and presence requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const directory = createDirectoryResponse();
    const profile = {
      profile: createSocialUser({
        nickname: 'luna',
        name: 'Luna',
      }),
    };

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify(directory), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(profile), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'ALREADY_FRIENDS',
              message: 'already friends',
            },
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new Error('other'));

    const client = new SocialApiClient('http://localhost:4000');

    await expect(
      client.getDirectory('access-token', {
        page: 2,
        pageSize: 12,
        presence: 'offline',
        q: 'kael',
        relationship: 'friends',
      }),
    ).resolves.toEqual(directory);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/users/global?page=2&pageSize=12&presence=offline&q=kael&relationship=friends',
    );

    await expect(client.getPublicProfile('access-token', 'luna')).resolves.toEqual(profile);
    await expect(client.sendFriendRequest('access-token', 'luna')).resolves.toBeUndefined();
    await expect(client.removeFriend('access-token', 'friendship-1')).resolves.toBeUndefined();
    await expect(
      client.updatePresence('access-token', {
        currentActivity: 'Queueing',
        status: 'online',
      }),
    ).resolves.toBeUndefined();

    await expect(client.acceptFriendRequest('access-token', 'request-1')).rejects.toMatchObject({
      code: 'ALREADY_FRIENDS',
      message: 'already friends',
      status: 409,
    });

    await expect(client.getFriends('access-token')).rejects.toMatchObject({
      code: 'BACKEND_UNAVAILABLE',
      message: 'The launcher could not reach the social service.',
    });

    await expect(client.getIncomingRequests('access-token')).rejects.toMatchObject({
      code: 'UNKNOWN_SOCIAL_ERROR',
      message: 'Social request failed.',
    });
  });
});

describe('frontend social store', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads social snapshot data, selects profiles, and applies live presence updates', async () => {
    const realtime = new FakeRealtimeService();
    const directoryUser = createSocialUser({
      nickname: 'kael',
      name: 'Kael',
      presence: {
        currentActivity: 'In launcher',
        lastSeenAt: '2026-04-02T00:00:00.000Z',
        status: 'in_launcher',
      },
      profileImageUrl: '/uploads/avatars/kael.png',
    });
    const apiClient = {
      acceptFriendRequest: vi.fn(),
      cancelOutgoingRequest: vi.fn(),
      getDirectory: vi.fn(async () =>
        createDirectoryResponse([directoryUser], {
          hasMore: true,
          total: 24,
        }),
      ),
      getFriends: vi.fn(async () => createFriendsResponse([directoryUser])),
      getIncomingRequests: vi.fn(async () => createRequestsResponse()),
      getOutgoingRequests: vi.fn(async () => createRequestsResponse()),
      getPublicProfile: vi.fn(async (_token: string, nickname: string) => ({
        profile: createSocialUser({
          nickname,
          name: nickname === 'luna' ? 'Luna' : 'Kael',
          profileImageUrl: '/uploads/avatars/target.png',
        }),
      })),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
      resolveAssetUrl: vi.fn((value: string | null) =>
        value ? `http://localhost:4000${value}` : null,
      ),
      sendFriendRequest: vi.fn(async () => undefined),
      updatePresence: vi.fn(async () => undefined),
    };
    const authService = {
      ensureAccessToken: vi.fn(async () => 'access-token'),
    };
    const store = new SocialStore({
      apiClient: apiClient as never,
      authService: authService as never,
      realtimeService: realtime as never,
    });

    const snapshot = await store.load();

    expect(authService.ensureAccessToken).toHaveBeenCalled();
    expect(realtime.connect).toHaveBeenCalledWith('access-token');
    expect(apiClient.getDirectory).toHaveBeenCalled();
    expect(snapshot.directory.users[0]?.profileImageUrl).toBe(
      'http://localhost:4000/uploads/avatars/kael.png',
    );
    expect(snapshot.profile?.nickname).toBe('kael');

    await store.selectProfile('luna');
    expect(apiClient.getPublicProfile).toHaveBeenCalledWith('access-token', 'luna');
    expect(store.getSnapshot()?.profile?.nickname).toBe('luna');

    realtime.emit({
      entries: [
        {
          nickname: 'kael',
          presence: {
            currentActivity: 'Playing Ranked Match',
            lastSeenAt: '2026-04-02T01:00:00.000Z',
            status: 'online',
          },
        },
      ],
      type: 'snapshot',
    });

    expect(store.getSnapshot()?.directory.users[0]?.presence.status).toBe('online');
    expect(store.getSnapshot()?.directory.users[0]?.presence.currentActivity).toBe(
      'Playing Ranked Match',
    );

    realtime.emit({
      type: 'disconnected',
    });

    expect(store.getSnapshot()?.directory.users[0]?.presence.status).toBe('in_launcher');
  });

  it('forwards friendship mutations and deduplicates presence updates', async () => {
    const realtime = new FakeRealtimeService();
    const apiClient = {
      acceptFriendRequest: vi.fn(async () => undefined),
      cancelOutgoingRequest: vi.fn(async () => undefined),
      getDirectory: vi.fn(async () => createDirectoryResponse()),
      getFriends: vi.fn(async () => createFriendsResponse()),
      getIncomingRequests: vi.fn(async () => createRequestsResponse()),
      getOutgoingRequests: vi.fn(async () => createRequestsResponse()),
      getPublicProfile: vi.fn(async () => ({
        profile: createSocialUser(),
      })),
      rejectFriendRequest: vi.fn(async () => undefined),
      removeFriend: vi.fn(async () => undefined),
      resolveAssetUrl: vi.fn((value: string | null) => value),
      sendFriendRequest: vi.fn(async () => undefined),
      updatePresence: vi.fn(async () => undefined),
    };
    const authService = {
      ensureAccessToken: vi.fn(async () => 'access-token'),
    };
    const store = new SocialStore({
      apiClient: apiClient as never,
      authService: authService as never,
      realtimeService: realtime as never,
    });
    const nowSpy = vi.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1_000);
    await store.load();
    await store.sendFriendRequest('luna');
    await store.acceptFriendRequest('request-1');
    await store.rejectFriendRequest('request-2');
    await store.cancelOutgoingRequest('request-3');
    await store.removeFriend('friendship-1');

    expect(apiClient.sendFriendRequest).toHaveBeenCalledWith('access-token', 'luna');
    expect(apiClient.acceptFriendRequest).toHaveBeenCalledWith('access-token', 'request-1');
    expect(apiClient.rejectFriendRequest).toHaveBeenCalledWith('access-token', 'request-2');
    expect(apiClient.cancelOutgoingRequest).toHaveBeenCalledWith('access-token', 'request-3');
    expect(apiClient.removeFriend).toHaveBeenCalledWith('access-token', 'friendship-1');
    expect(apiClient.getDirectory).toHaveBeenCalledTimes(6);

    await store.updatePresence({
      currentActivity: 'Browsing players',
      status: 'in_launcher',
    });

    nowSpy.mockReturnValue(10_000);
    await store.updatePresence({
      currentActivity: 'Browsing players',
      status: 'in_launcher',
    });

    nowSpy.mockReturnValue(20_000);
    await store.updatePresence({
      currentActivity: 'Reviewing profile',
      status: 'in_launcher',
    });

    expect(realtime.updatePresence).toHaveBeenCalledTimes(2);
    expect(apiClient.updatePresence).not.toHaveBeenCalled();
  });
});

describe('frontend social ui', () => {
  beforeEach(() => {
    resetDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the dynamic profile screen when clicking a player card', async () => {
    const snapshot = createSocialSnapshot({
      directory: createDirectoryResponse([
        createSocialUser({
          nickname: 'kael',
          name: 'Kael',
        }),
      ]),
      profile: createSocialUser({
        nickname: 'kael',
        name: 'Kael',
      }),
    });
    const onOpenProfile = vi.fn();
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile,
      socialStore: {
        acceptFriendRequest: vi.fn(),
        cancelOutgoingRequest: vi.fn(),
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory: vi.fn(async () => snapshot),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchDirectory: vi.fn(async () => snapshot),
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest: vi.fn(async () => snapshot),
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    socialScreen.querySelector<HTMLButtonElement>('.social-board__card-hitbox')?.click();

    expect(onOpenProfile).toHaveBeenCalledWith('kael');
  });

  it('uses the players card action to open profile instead of sending friendship actions', async () => {
    const snapshot = createSocialSnapshot({
      directory: createDirectoryResponse([
        createSocialUser({
          nickname: 'iris',
          name: 'Iris',
          relationship: {
            friendshipId: null,
            requestId: null,
            state: 'none',
          },
        }),
      ]),
      profile: createSocialUser({
        nickname: 'iris',
        name: 'Iris',
      }),
    });
    const onOpenProfile = vi.fn();
    const sendFriendRequest = vi.fn(async () => snapshot);
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile,
      socialStore: {
        acceptFriendRequest: vi.fn(),
        cancelOutgoingRequest: vi.fn(),
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory: vi.fn(async () => snapshot),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchDirectory: vi.fn(async () => snapshot),
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest,
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    const actionButton = socialScreen.querySelector<HTMLButtonElement>('.social-board__action');
    expect(actionButton?.textContent).toContain('View Profile');

    actionButton?.click();
    await flushPromises();

    expect(onOpenProfile).toHaveBeenCalledWith('iris');
    expect(sendFriendRequest).not.toHaveBeenCalled();
  });

  it('removes a friend from the social card action', async () => {
    const snapshot = createSocialSnapshot({
      directory: createDirectoryResponse([
        createSocialUser({
          nickname: 'kael',
          name: 'Kael',
          relationship: {
            friendshipId: 'friendship-1',
            requestId: null,
            state: 'friends',
          },
        }),
      ]),
      friends: createFriendsResponse([
        createSocialUser({
          nickname: 'kael',
          name: 'Kael',
          relationship: {
            friendshipId: 'friendship-1',
            requestId: null,
            state: 'friends',
          },
        }),
      ]),
      profile: createSocialUser({
        nickname: 'kael',
        name: 'Kael',
        relationship: {
          friendshipId: 'friendship-1',
          requestId: null,
          state: 'friends',
        },
      }),
    });
    const removeFriend = vi.fn(async () => snapshot);
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile: vi.fn(),
      socialStore: {
        acceptFriendRequest: vi.fn(),
        cancelOutgoingRequest: vi.fn(),
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory: vi.fn(async () => snapshot),
        rejectFriendRequest: vi.fn(),
        removeFriend,
        searchDirectory: vi.fn(async () => snapshot),
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest: vi.fn(async () => snapshot),
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    socialScreen.querySelector<HTMLButtonElement>('[data-social-section="friends"]')?.click();
    await flushPromises();

    socialScreen.querySelector<HTMLButtonElement>('.social-board__action')?.click();
    await flushPromises();

    expect(removeFriend).toHaveBeenCalledWith('friendship-1');
    expect(socialScreen.textContent).toContain('Friend removed.');
  });

  it('accepts an incoming friend request from the pending section', async () => {
    const snapshot = createSocialSnapshot({
      incomingRequests: createRequestsResponse([
        {
          createdAt: '2026-04-02T00:00:00.000Z',
          id: 'request-incoming-1',
          user: createSocialUser({
            nickname: 'luna',
            name: 'Luna',
            relationship: {
              friendshipId: null,
              requestId: 'request-incoming-1',
              state: 'pending_received',
            },
          }),
        },
      ]),
      profile: createSocialUser({
        nickname: 'luna',
        name: 'Luna',
        relationship: {
          friendshipId: null,
          requestId: 'request-incoming-1',
          state: 'pending_received',
        },
      }),
    });
    const acceptFriendRequest = vi.fn(async () => snapshot);
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile: vi.fn(),
      socialStore: {
        acceptFriendRequest,
        cancelOutgoingRequest: vi.fn(),
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory: vi.fn(async () => snapshot),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchDirectory: vi.fn(async () => snapshot),
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest: vi.fn(async () => snapshot),
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    socialScreen.querySelector<HTMLButtonElement>('[data-social-section="pending"]')?.click();
    await flushPromises();

    const actionButton = socialScreen.querySelector<HTMLButtonElement>('.social-board__action');
    expect(actionButton?.textContent).toContain('Accept');

    actionButton?.click();
    await flushPromises();

    expect(acceptFriendRequest).toHaveBeenCalledWith('request-incoming-1');
    expect(socialScreen.textContent).toContain('Friend request accepted.');
  });

  it('cancels an outgoing friend request from the pending section', async () => {
    const snapshot = createSocialSnapshot({
      outgoingRequests: createRequestsResponse([
        {
          createdAt: '2026-04-02T00:00:00.000Z',
          id: 'request-outgoing-1',
          user: createSocialUser({
            nickname: 'orca',
            name: 'Orca',
            relationship: {
              friendshipId: null,
              requestId: 'request-outgoing-1',
              state: 'pending_sent',
            },
          }),
        },
      ]),
      profile: createSocialUser({
        nickname: 'orca',
        name: 'Orca',
        relationship: {
          friendshipId: null,
          requestId: 'request-outgoing-1',
          state: 'pending_sent',
        },
      }),
    });
    const cancelOutgoingRequest = vi.fn(async () => snapshot);
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile: vi.fn(),
      socialStore: {
        acceptFriendRequest: vi.fn(),
        cancelOutgoingRequest,
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory: vi.fn(async () => snapshot),
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchDirectory: vi.fn(async () => snapshot),
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest: vi.fn(async () => snapshot),
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    socialScreen.querySelector<HTMLButtonElement>('[data-social-section="pending"]')?.click();
    await flushPromises();

    const actionButton = socialScreen.querySelector<HTMLButtonElement>('.social-board__action');
    expect(actionButton?.textContent).toContain('Cancel');

    actionButton?.click();
    await flushPromises();

    expect(cancelOutgoingRequest).toHaveBeenCalledWith('request-outgoing-1');
    expect(socialScreen.textContent).toContain('Outgoing request cancelled.');
  });

  it('uses the toolbar for presence filtering and load more actions', async () => {
    const snapshot = createSocialSnapshot({
      directory: createDirectoryResponse([
        createSocialUser({
          nickname: 'zeph',
          name: 'Zeph',
        }),
      ], {
        hasMore: true,
        total: 24,
      }),
    });
    const searchDirectory = vi.fn(async () => snapshot);
    const loadMoreDirectory = vi.fn(async () => snapshot);
    const socialScreen = createSocialScreen({
      i18n: createTestI18n('en'),
      onOpenProfile: vi.fn(),
      socialStore: {
        acceptFriendRequest: vi.fn(),
        cancelOutgoingRequest: vi.fn(),
        getSnapshot: vi.fn(() => snapshot),
        load: vi.fn(async () => snapshot),
        loadMoreDirectory,
        rejectFriendRequest: vi.fn(),
        removeFriend: vi.fn(),
        searchDirectory,
        selectProfile: vi.fn(async () => snapshot),
        sendFriendRequest: vi.fn(async () => snapshot),
        subscribe: vi.fn(() => () => undefined),
      } as never,
    });
    document.body.append(socialScreen);
    await flushPromises();

    expect(socialScreen.querySelector('.social-board__footer')).toBeNull();
    expect(
      socialScreen.querySelector('.social-board__toolbar-actions .social-board__more'),
    ).not.toBeNull();

    const presenceSelect = socialScreen.querySelector<HTMLSelectElement>('[data-social-presence]');
    presenceSelect!.value = 'offline';
    presenceSelect?.dispatchEvent(new Event('change'));
    await flushPromises();

    expect(searchDirectory).toHaveBeenCalledWith({
      presence: 'offline',
      q: '',
      relationship: 'all',
    });

    socialScreen.querySelector<HTMLButtonElement>('.social-board__more')?.click();
    await flushPromises();

    expect(loadMoreDirectory).toHaveBeenCalledTimes(1);
  });

  it('renders the shared dynamic profile layout for another player', async () => {
    const targetProfile = createSocialUser({
      nickname: 'kael',
      name: 'Kael',
      presence: {
        currentActivity: 'Playing Ranked Match',
        lastSeenAt: '2026-04-02T00:00:00.000Z',
        status: 'online',
      },
      relationship: {
        friendshipId: null,
        requestId: null,
        state: 'none',
      },
    });
    const socialSnapshot = createSocialSnapshot({
      profile: targetProfile,
    });
    const selectProfile = vi.fn(async () => socialSnapshot);
    const screen = createProfileScreen({
      currentUser: createTestUser({
        nickname: 'self.player',
        name: 'Self Player',
      }),
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => createTestUser()),
        load: vi.fn(),
      } as never,
      profileTargetNickname: 'kael',
      session: createTestSessionSnapshot(),
      socialStore: {
        getSnapshot: vi.fn(() => socialSnapshot),
        selectProfile,
        subscribe: vi.fn(() => () => undefined),
        sendFriendRequest: vi.fn(async () => socialSnapshot),
        acceptFriendRequest: vi.fn(async () => socialSnapshot),
      } as never,
    });
    document.body.append(screen);
    await flushPromises();

    expect(selectProfile).toHaveBeenCalledWith('kael');
    expect(screen.textContent).toContain('Display Name');
    expect(screen.textContent).toContain('Kael');
    expect(screen.textContent).toContain('@kael');
    expect(screen.textContent).toContain('In Match');
    expect(screen.textContent).toContain('Playing Ranked Match');
    expect(screen.textContent).toContain('Add Friend');
  });

  it('removes a friend from the shared profile screen', async () => {
    const targetProfile = createSocialUser({
      nickname: 'kael',
      name: 'Kael',
      relationship: {
        friendshipId: 'friendship-1',
        requestId: null,
        state: 'friends',
      },
    });
    const socialSnapshot = createSocialSnapshot({
      profile: targetProfile,
    });
    const removeFriend = vi.fn(async () => socialSnapshot);
    const screen = createProfileScreen({
      currentUser: createTestUser({
        nickname: 'self.player',
        name: 'Self Player',
      }),
      i18n: createTestI18n('en'),
      profileStore: {
        getSnapshot: vi.fn(() => createTestUser()),
        load: vi.fn(),
      } as never,
      profileTargetNickname: 'kael',
      session: createTestSessionSnapshot(),
      socialStore: {
        getSnapshot: vi.fn(() => socialSnapshot),
        selectProfile: vi.fn(async () => socialSnapshot),
        subscribe: vi.fn(() => () => undefined),
        sendFriendRequest: vi.fn(async () => socialSnapshot),
        acceptFriendRequest: vi.fn(async () => socialSnapshot),
        removeFriend,
      } as never,
    });
    document.body.append(screen);
    await flushPromises();

    const actionButton = screen.querySelector<HTMLButtonElement>('[data-public-action]');
    expect(actionButton?.textContent).toContain('Remove Friend');

    actionButton?.click();
    await flushPromises();

    expect(removeFriend).toHaveBeenCalledWith('friendship-1');
  });
});
