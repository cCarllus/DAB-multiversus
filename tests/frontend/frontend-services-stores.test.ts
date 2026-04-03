// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppApiError } from '../../app/frontend/services/api/api-error';
import { AuthApiClient } from '../../app/frontend/services/auth/auth-api-client';
import { AuthService } from '../../app/frontend/services/auth/auth-service';
import { ProfileApiClient } from '../../app/frontend/services/profile/profile-api-client';
import { ProfileStore } from '../../app/frontend/stores/profile.store';
import { SessionStore } from '../../app/frontend/stores/session.store';
import { STORAGE_KEYS } from '../../app/shared/constants/storage-keys';
import {
  createDesktopBridgeMock,
  createTestDevicesPayload,
  createTestProfileSnapshot,
  createTestSession,
  createTestUser,
} from '../helpers/frontend';

async function expectRejectedAppApiError(
  promise: Promise<unknown>,
  expected: { code: string; message?: string; status?: number },
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(AppApiError);
    expect(error).toMatchObject(expected);
  }
}

describe('frontend api clients', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles auth api client success and error states', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = new AuthApiClient('http://localhost:4000');
    const user = createTestUser();
    const authResponse = createTestSession({
      user,
    });

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(authResponse), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new Error('other'));

    await expect(
      client.register({
        email: 'player@example.com',
        nickname: 'player.one',
        password: '12345678',
      }),
    ).resolves.toEqual({ user });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://localhost:4000/auth/register');
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    });

    await expect(
      client.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
        deviceId: 'device-1',
        deviceName: 'Mac',
        osName: 'macOS',
        osVersion: '14.0',
        appAgent: 'DAB',
        appVersion: '0.1.0',
      }),
    ).resolves.toEqual(authResponse);

    await expect(
      client.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        osName: 'macOS',
        appVersion: '0.1.0',
        appAgent: 'DAB',
        deviceName: 'Mac',
        osVersion: '14.0',
      }),
    ).resolves.toEqual(authResponse);

    await expect(client.getCurrentUser('access-token')).resolves.toEqual(user);
    expect(fetchSpy.mock.calls[3]?.[1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
      }),
    });

    await expect(
      client.logout(
        {
          refreshToken: 'refresh-token',
        },
        'access-token',
      ),
    ).resolves.toBeUndefined();

    await expectRejectedAppApiError(
      client.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
        code: 'INVALID_CREDENTIALS',
        message: 'bad',
        status: 401,
      },
    );

    await expectRejectedAppApiError(
      client.refresh({
        refreshToken: 'refresh-token',
        deviceId: 'device-1',
        osName: 'macOS',
      }),
      {
        code: 'BACKEND_UNAVAILABLE',
        message: 'The launcher could not reach the authentication service.',
      },
    );

    await expectRejectedAppApiError(
      client.logout({
        refreshToken: 'refresh-token',
      }),
      {
        code: 'UNKNOWN_AUTH_ERROR',
        message: 'Authentication request failed.',
      },
    );
  });

  it('handles profile api client success and error states', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = new ProfileApiClient('http://localhost:4000');
    const user = createTestUser();
    const devices = createTestDevicesPayload();

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ profile: user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(devices), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'INVALID_NAME', message: 'bad name' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockRejectedValueOnce(new TypeError('network'))
      .mockRejectedValueOnce(new Error('other'));

    expect(client.resolveAssetUrl(null)).toBeNull();
    expect(client.resolveAssetUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(client.resolveAssetUrl('uploads/a.png')).toBe('http://localhost:4000/uploads/a.png');
    expect(client.resolveAssetUrl('/uploads/b.png')).toBe('http://localhost:4000/uploads/b.png');

    await expect(client.getProfile('access-token')).resolves.toEqual(user);
    await expect(client.updateProfile('access-token', { name: 'Player One' })).resolves.toEqual(
      user,
    );

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await expect(client.uploadAvatar('access-token', file)).resolves.toEqual(user);
    expect(fetchSpy.mock.calls[2]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer access-token',
      }),
    });
    expect(fetchSpy.mock.calls[2]?.[1]?.body).toBeInstanceOf(FormData);

    await expect(client.getDevices('access-token', 'device-1')).resolves.toEqual(devices);
    expect(fetchSpy.mock.calls[3]?.[1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        'X-Launcher-Device-Id': 'device-1',
      }),
    });

    await expectRejectedAppApiError(client.updateProfile('access-token', { name: 'x' }), {
      code: 'INVALID_NAME',
      message: 'bad name',
      status: 400,
    });

    await expectRejectedAppApiError(client.getProfile('access-token'), {
      code: 'BACKEND_UNAVAILABLE',
      message: 'The launcher could not reach the profile service.',
    });

    await expectRejectedAppApiError(client.getDevices('access-token', 'device-1'), {
      code: 'UNKNOWN_PROFILE_ERROR',
      message: 'Profile request failed.',
    });

    fetchSpy.mockResolvedValueOnce(
      new Response(null, {
        status: 418,
      }),
    );
    await expectRejectedAppApiError(client.getProfile('access-token'), {
      code: 'UNKNOWN_PROFILE_ERROR',
      message: 'Profile request failed.',
      status: 418,
    });
  });
});

describe('frontend stores and auth service', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads, saves, and clears sessions across runtime and persistent stores', async () => {
    const desktop = createDesktopBridgeMock();
    const store = new SessionStore(desktop);
    const session = createTestSession();

    expect(await store.supportsRememberedSessions()).toBe(true);
    expect(await store.supportsRememberedSessions()).toBe(true);

    await store.saveSession(session);
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.authSession) ?? '{}')).toMatchObject({
      refreshToken: 'refresh-token',
    });

    const loadedSession = await store.loadSession();
    expect(loadedSession).toMatchObject({
      refreshToken: 'refresh-token',
    });

    store.updateRuntimeUser(createTestUser({ name: 'Updated Player' }));
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEYS.authSession) ?? '{}')).toMatchObject({
      user: expect.objectContaining({
        name: 'Updated Player',
      }),
    });

    store.clearRuntimeSession();
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();

    await store.clear();
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();
  });

  it('handles invalid, expired, and local fallback sessions', async () => {
    const desktop = createDesktopBridgeMock({
      authStorage: {
        clearRememberedSession: vi.fn(async () => undefined),
        getRememberedSession: vi.fn(async () => null),
        isPersistentStorageAvailable: vi.fn(async () => false),
        setRememberedSession: vi.fn(async () => undefined),
      },
    });
    const store = new SessionStore(desktop);

    sessionStorage.setItem(STORAGE_KEYS.authSession, '{bad json');
    expect(await store.loadSession()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();

    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        refreshToken: 'refresh-token',
        sessionExpiresAt: '2020-01-01T00:00:00.000Z',
        rememberDevice: true,
        accessToken: null,
        user: null,
      }),
    );
    expect(await store.loadSession()).toBeNull();

    localStorage.setItem(
      STORAGE_KEYS.rememberedAuthSession,
      JSON.stringify({
        refreshToken: 'refresh-token',
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
        savedAt: '2024-01-01T00:00:00.000Z',
        rememberDevice: true,
      }),
    );
    expect(await store.loadSession()).toEqual({
      user: null,
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: 'refresh-token',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      rememberDevice: true,
    });

    localStorage.setItem(STORAGE_KEYS.rememberedAuthSession, '{bad json');
    expect(await store.loadSession()).toBeNull();

    localStorage.setItem(
      STORAGE_KEYS.rememberedAuthSession,
      JSON.stringify({
        refreshToken: 'refresh-token',
        sessionExpiresAt: '2020-01-01T00:00:00.000Z',
        savedAt: '2024-01-01T00:00:00.000Z',
        rememberDevice: true,
      }),
    );
    expect(await store.loadSession()).toBeNull();

    await store.saveSession(createTestSession());
    expect(localStorage.getItem(STORAGE_KEYS.rememberedAuthSession)).toContain('refresh-token');

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('no storage');
        },
        removeItem: () => undefined,
        setItem: () => {
          throw new Error('no storage');
        },
      },
    });
    const unsupportedStore = new SessionStore(
      createDesktopBridgeMock({
        authStorage: {
          clearRememberedSession: vi.fn(async () => undefined),
          getRememberedSession: vi.fn(async () => null),
          isPersistentStorageAvailable: vi.fn(async () => false),
          setRememberedSession: vi.fn(async () => undefined),
        },
      }),
    );
    await expectRejectedAppApiError(unsupportedStore.saveSession(createTestSession()), {
      code: 'REMEMBER_DEVICE_UNAVAILABLE',
    });
  });

  it('covers session-store guard rails for malformed objects, desktop precedence, and failed persistence probes', async () => {
    const desktopRememberedSession = {
      refreshToken: 'desktop-refresh-token',
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      savedAt: '2024-01-01T00:00:00.000Z',
      rememberDevice: true,
    };
    const desktop = createDesktopBridgeMock({
      authStorage: {
        clearRememberedSession: vi.fn(async () => undefined),
        getRememberedSession: vi.fn(async () => null),
        isPersistentStorageAvailable: vi.fn(async () => false),
        setRememberedSession: vi.fn(async () => undefined),
      },
    });
    const store = new SessionStore(desktop);

    sessionStorage.setItem(STORAGE_KEYS.authSession, 'null');
    expect(await store.loadSession()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();

    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        refreshToken: 123,
        sessionExpiresAt: '2099-01-01T00:00:00.000Z',
        rememberDevice: true,
        accessToken: null,
        user: null,
      }),
    );
    expect(await store.loadSession()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();

    store.updateRuntimeUser(createTestUser({ name: 'No Runtime Session' }));
    expect(sessionStorage.getItem(STORAGE_KEYS.authSession)).toBeNull();

    localStorage.setItem(
      STORAGE_KEYS.rememberedAuthSession,
      JSON.stringify({
        refreshToken: 'local-refresh-token',
        sessionExpiresAt: '2099-01-02T00:00:00.000Z',
        savedAt: '2024-01-02T00:00:00.000Z',
        rememberDevice: true,
      }),
    );
    desktop.authStorage.getRememberedSession = vi.fn(async () => desktopRememberedSession);

    await expect(store.loadSession()).resolves.toEqual({
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: 'desktop-refresh-token',
      rememberDevice: true,
      sessionExpiresAt: '2099-01-01T00:00:00.000Z',
      user: null,
    });
    expect(localStorage.getItem(STORAGE_KEYS.rememberedAuthSession)).toBeNull();

    localStorage.setItem(STORAGE_KEYS.rememberedAuthSession, 'null');
    desktop.authStorage.getRememberedSession = vi.fn(async () => null);
    expect(await store.loadSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.rememberedAuthSession)).toBeNull();

    const noStorageDesktop = createDesktopBridgeMock({
      authStorage: {
        clearRememberedSession: vi.fn(async () => undefined),
        getRememberedSession: vi.fn(async () => null),
        isPersistentStorageAvailable: vi.fn(async () => false),
        setRememberedSession: vi.fn(async () => undefined),
      },
    });
    const noStorageStore = new SessionStore(noStorageDesktop);
    (noStorageStore as unknown as { persistentSessionSupport: boolean }).persistentSessionSupport = true;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        removeItem: () => {
          throw new Error('remove failed');
        },
        setItem: () => {
          throw new Error('set failed');
        },
      },
    });

    await expectRejectedAppApiError(noStorageStore.saveSession(createTestSession()), {
      code: 'REMEMBER_DEVICE_UNAVAILABLE',
    });

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });

    const browserOnlyStore = new SessionStore(
      createDesktopBridgeMock({
        authStorage: undefined,
      }) as never,
    );
    expect(await browserOnlyStore.supportsRememberedSessions()).toBe(true);
  });

  it('runs auth service session flows and login fallbacks', async () => {
    const desktop = createDesktopBridgeMock();
    const session = createTestSession();
    const apiClient = {
      getCurrentUser: vi.fn(),
      login: vi.fn(async () => session),
      logout: vi.fn(async () => undefined),
      refresh: vi.fn(async () => session),
      register: vi.fn(async () => ({ user: session.user })),
    };
    const service = new AuthService(desktop, '0.1.0', apiClient as never);

    expect(await service.supportsRememberedSessions()).toBe(true);
    expect(await service.initialize()).toBeNull();

    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        ...session,
        accessToken: null,
        accessTokenExpiresAt: null,
        user: null,
      }),
    );
    await expect(service.initialize()).resolves.toEqual(session);
    expect(service.getCurrentSession()).toEqual(session);

    await expect(
      service.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
      }),
    ).resolves.toEqual(session);

    expect(await service.ensureAccessToken()).toBe('access-token');
    service.syncCurrentUser(createTestUser({ name: 'Updated Player' }));
    expect(service.getCurrentSession()?.user?.name).toBe('Updated Player');

    await service.logout();
    expect(apiClient.logout).toHaveBeenCalled();
    expect(service.getCurrentSession()).toBeNull();

    const unsupportedDesktop = createDesktopBridgeMock({
      authStorage: {
        clearRememberedSession: vi.fn(async () => undefined),
        getRememberedSession: vi.fn(async () => null),
        isPersistentStorageAvailable: vi.fn(async () => false),
        setRememberedSession: vi.fn(async () => undefined),
      },
    });
    const unsupportedService = new AuthService(unsupportedDesktop, '0.1.0', apiClient as never);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('no storage');
        },
        removeItem: () => undefined,
        setItem: () => {
          throw new Error('no storage');
        },
      },
    });
    await expectRejectedAppApiError(
      unsupportedService.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
      }),
      {
        code: 'REMEMBER_DEVICE_UNAVAILABLE',
      },
    );

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    sessionStorage.clear();
    const devService = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi
        .fn()
        .mockRejectedValueOnce(new AppApiError('INVALID_CREDENTIALS', 'bad'))
        .mockResolvedValueOnce(session),
      register: vi
        .fn()
        .mockRejectedValueOnce(new AppApiError('EMAIL_ALREADY_IN_USE', 'exists'))
        .mockResolvedValueOnce({ user: session.user }),
    } as never);
    await expect(devService.loginWithDevAccount()).resolves.toEqual(session);

    const devServiceRegisterFailure = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi.fn().mockRejectedValueOnce(new AppApiError('INVALID_CREDENTIALS', 'bad')),
      register: vi.fn().mockRejectedValueOnce(new AppApiError('REQUEST_INVALID', 'bad')),
    } as never);
    await expectRejectedAppApiError(devServiceRegisterFailure.loginWithDevAccount(), {
      code: 'REQUEST_INVALID',
    });

    const devServiceLoginFailure = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi.fn().mockRejectedValueOnce(new AppApiError('BACKEND_UNAVAILABLE', 'down')),
    } as never);
    await expectRejectedAppApiError(devServiceLoginFailure.loginWithDevAccount(), {
      code: 'BACKEND_UNAVAILABLE',
    });
  });

  it('handles auth service refresh and persistence failures', async () => {
    const desktop = createDesktopBridgeMock();
    const session = createTestSession({
      accessTokenExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    const apiClient = {
      login: vi.fn(async () => session),
      logout: vi.fn(async () => undefined),
      refresh: vi.fn(async () => ({
        ...session,
        accessToken: 'new-access-token',
        accessTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      })),
      register: vi.fn(async () => ({ user: session.user })),
    };
    const service = new AuthService(desktop, '0.1.0', apiClient as never);
    (service as unknown as { currentSession: typeof session }).currentSession = session;

    await expect(service.ensureAccessToken()).resolves.toBe('new-access-token');

    const invalidatingService = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      refresh: vi.fn(async () => {
        throw new AppApiError('SESSION_REVOKED', 'expired');
      }),
    } as never);
    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        ...session,
        accessToken: null,
        accessTokenExpiresAt: null,
        user: null,
      }),
    );
    await expect(invalidatingService.initialize()).resolves.toBeNull();

    const unknownInitService = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      refresh: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as never);
    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        ...session,
        accessToken: null,
        accessTokenExpiresAt: null,
        user: null,
      }),
    );
    await expect(unknownInitService.initialize()).rejects.toThrow('boom');

    const persistenceError = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi.fn(async () => session),
    } as never);
    desktop.authStorage.isPersistentStorageAvailable = vi.fn(async () => true);
    desktop.authStorage.setRememberedSession = vi.fn(async () => {
      throw new Error('persist failed');
    });
    await expectRejectedAppApiError(
      persistenceError.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
      }),
      {
        code: 'SESSION_PERSISTENCE_FAILED',
      },
    );
    expect(apiClient.logout).toHaveBeenCalled();

    const logoutOnPersistenceFailure = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi.fn(async () => session),
      logout: vi.fn(async () => {
        throw new Error('logout failed');
      }),
    } as never);
    desktop.authStorage.isPersistentStorageAvailable = vi.fn(async () => true);
    desktop.authStorage.setRememberedSession = vi.fn(async () => {
      throw new Error('persist failed again');
    });
    await expectRejectedAppApiError(
      logoutOnPersistenceFailure.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
      }),
      {
        code: 'SESSION_PERSISTENCE_FAILED',
      },
    );

    const directPersistenceError = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      login: vi.fn(async () => session),
    } as never);
    const desktopError = new AppApiError('REMEMBER_DEVICE_UNAVAILABLE', 'no storage');
    desktop.authStorage.setRememberedSession = vi.fn(async () => {
      throw desktopError;
    });
    desktop.authStorage.isPersistentStorageAvailable = vi.fn(async () => true);
    await expectRejectedAppApiError(
      directPersistenceError.login({
        identifier: 'player@example.com',
        password: '12345678',
        rememberDevice: true,
      }),
      {
        code: 'REMEMBER_DEVICE_UNAVAILABLE',
      },
    );

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    desktop.authStorage.isPersistentStorageAvailable = vi.fn(async () => true);
    desktop.authStorage.setRememberedSession = vi.fn(async () => undefined);

    const unauthenticatedService = new AuthService(desktop, '0.1.0', apiClient as never);
    await expect(unauthenticatedService.ensureAccessToken()).resolves.toBeNull();
    await expect(unauthenticatedService.logout()).resolves.toBeUndefined();
    await expectRejectedAppApiError(
      (unauthenticatedService as unknown as { refreshCurrentSession: () => Promise<string> }).refreshCurrentSession(),
      {
        code: 'UNAUTHENTICATED',
      },
    );
    unauthenticatedService.syncCurrentUser(createTestUser());

    const logoutFailureService = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      logout: vi.fn(async () => {
        throw new Error('logout failed');
      }),
    } as never);
    (logoutFailureService as unknown as { currentSession: typeof session }).currentSession = {
      ...session,
      accessTokenExpiresAt: null,
    };
    await expect(logoutFailureService.ensureAccessToken()).resolves.toBe('new-access-token');
    await expect(logoutFailureService.logout()).resolves.toBeUndefined();

    sessionStorage.setItem(
      STORAGE_KEYS.authSession,
      JSON.stringify({
        ...session,
        accessToken: null,
      }),
    );
    const storedLogoutService = new AuthService(desktop, '0.1.0', {
      ...apiClient,
      logout: vi.fn(async () => undefined),
    } as never);
    await expect(storedLogoutService.logout()).resolves.toBeUndefined();
  });

  it('loads and updates the profile store with auth-aware access tokens', async () => {
    const snapshot = createTestProfileSnapshot();
    const authService = {
      ensureAccessToken: vi.fn(async () => 'access-token'),
      getCurrentSession: vi.fn(() => null),
      syncCurrentUser: vi.fn(),
    };
    const apiClient = {
      getDevices: vi.fn(async () => snapshot.devices),
      getProfile: vi.fn(async () => snapshot.profile),
      resolveAssetUrl: vi.fn((url: string | null) => (url ? `https://cdn.example.com${url}` : null)),
      updateProfile: vi.fn(async () => snapshot.profile),
      uploadAvatar: vi.fn(async () => snapshot.profile),
    };
    const store = new ProfileStore({
      apiClient: apiClient as never,
      appVersion: '0.1.0',
      authService: authService as never,
      desktop: createDesktopBridgeMock(),
    });

    expect(store.getSnapshot()).toBeNull();
    await expect(store.load()).resolves.toEqual({
      devices: snapshot.devices,
      profile: {
        ...snapshot.profile,
        profileImageUrl: null,
      },
    });
    expect(authService.syncCurrentUser).toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({
      devices: snapshot.devices,
      profile: {
        ...snapshot.profile,
        profileImageUrl: null,
      },
    });

    await expect(store.load()).resolves.toEqual(store.getSnapshot());
    expect(apiClient.getProfile).toHaveBeenCalledTimes(1);
    expect(apiClient.getDevices).toHaveBeenCalledTimes(1);

    await expect(store.load(true)).resolves.toEqual(store.getSnapshot());
    expect(apiClient.getProfile).toHaveBeenCalledTimes(2);
    expect(apiClient.getDevices).toHaveBeenCalledTimes(2);

    await expect(store.updateName('Updated Player')).resolves.toEqual({
      devices: snapshot.devices,
      profile: {
        ...snapshot.profile,
        profileImageUrl: null,
      },
    });
    await expect(store.uploadAvatar(new File(['avatar'], 'avatar.png', { type: 'image/png' }))).resolves.toEqual({
      devices: snapshot.devices,
      profile: {
        ...snapshot.profile,
        profileImageUrl: null,
      },
    });

    store.reset();
    expect(store.getSnapshot()).toBeNull();

    const unauthenticatedStore = new ProfileStore({
      apiClient: apiClient as never,
      appVersion: '0.1.0',
      authService: {
        ensureAccessToken: vi.fn(async () => null),
        getCurrentSession: vi.fn(() => null),
        syncCurrentUser: vi.fn(),
      } as never,
      desktop: createDesktopBridgeMock(),
    });
    await expectRejectedAppApiError(unauthenticatedStore.load(), {
      code: 'UNAUTHENTICATED',
    });
  });

  it('hydrates missing profile devices during profile updates and supports the default api client path', async () => {
    const snapshot = createTestProfileSnapshot();
    const authService = {
      ensureAccessToken: vi.fn(async () => 'access-token'),
      getCurrentSession: vi.fn(() => ({
        user: snapshot.profile,
      })),
      syncCurrentUser: vi.fn(),
    };
    const apiClient = {
      getDevices: vi.fn(async () => snapshot.devices),
      getProfile: vi.fn(async () => snapshot.profile),
      resolveAssetUrl: vi.fn((url: string | null) => url),
      updateProfile: vi.fn(async () => snapshot.profile),
      uploadAvatar: vi.fn(async () => snapshot.profile),
    };

    const updateNameStore = new ProfileStore({
      apiClient: apiClient as never,
      appVersion: '0.1.0',
      authService: authService as never,
      desktop: createDesktopBridgeMock(),
    });
    await expect(updateNameStore.updateName('Updated Player')).resolves.toEqual(snapshot);
    expect(apiClient.getDevices).toHaveBeenCalledTimes(1);

    const uploadStore = new ProfileStore({
      apiClient: apiClient as never,
      appVersion: '0.1.0',
      authService: authService as never,
      desktop: createDesktopBridgeMock(),
    });
    await expect(
      uploadStore.uploadAvatar(new File(['avatar'], 'avatar.png', { type: 'image/png' })),
    ).resolves.toEqual(snapshot);
    expect(apiClient.getDevices).toHaveBeenCalledTimes(2);

    const getProfileSpy = vi
      .spyOn(ProfileApiClient.prototype, 'getProfile')
      .mockResolvedValue(snapshot.profile);
    const getDevicesSpy = vi
      .spyOn(ProfileApiClient.prototype, 'getDevices')
      .mockResolvedValue(snapshot.devices);
    const resolveAssetUrlSpy = vi
      .spyOn(ProfileApiClient.prototype, 'resolveAssetUrl')
      .mockImplementation((url) => url);

    const defaultClientStore = new ProfileStore({
      appVersion: '0.1.0',
      authService: authService as never,
      desktop: createDesktopBridgeMock(),
    });
    (
      defaultClientStore as unknown as {
        cachedProfile: null;
      }
    ).cachedProfile = null;
    await expect(defaultClientStore.load()).resolves.toEqual(snapshot);
    expect(getProfileSpy).toHaveBeenCalled();
    expect(getDevicesSpy).toHaveBeenCalled();
    expect(resolveAssetUrlSpy).toHaveBeenCalled();
  });
});
