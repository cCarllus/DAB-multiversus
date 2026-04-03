import { createI18n, type AppI18n } from '@shared/i18n';
import type {
  DesktopBridge,
  DesktopRememberedAuthSession,
  DesktopWindowState,
} from '@shared/contracts/desktop.contract';
import type {
  AuthSessionSnapshot,
  AuthUser,
  StoredAuthSession,
} from '@frontend/services/auth/auth-types';
import type {
  ProfileDevicesPayload,
  ProfileSnapshot,
} from '@frontend/services/profile/profile.types';

export function createTestI18n(locale: 'pt-BR' | 'en' = 'en'): AppI18n {
  return createI18n(locale);
}

export function createTestUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    email: 'player@example.com',
    name: 'Player One',
    nickname: 'player.one',
    profileImageUrl: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function createTestSession(
  overrides: Partial<StoredAuthSession> = {},
): StoredAuthSession {
  return {
    user: createTestUser(),
    accessToken: 'access-token',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    refreshToken: 'refresh-token',
    sessionExpiresAt: '2099-01-02T00:00:00.000Z',
    rememberDevice: true,
    ...overrides,
  };
}

export function createTestSessionSnapshot(
  overrides: Partial<AuthSessionSnapshot> = {},
): AuthSessionSnapshot {
  return {
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    sessionExpiresAt: '2099-01-02T00:00:00.000Z',
    rememberDevice: true,
    ...overrides,
  };
}

export function createTestDevicesPayload(
  overrides: Partial<ProfileDevicesPayload> = {},
): ProfileDevicesPayload {
  const currentDevice = {
    appVersion: '0.1.0',
    firstSeenAt: '2024-01-01T00:00:00.000Z',
    isCurrent: true,
    label: 'macOS 14.0',
    lastLoginAt: '2024-01-03T00:00:00.000Z',
    osName: 'macOS',
    osVersion: '14.0',
  };
  const lastActiveDevice = {
    appVersion: '0.0.9',
    firstSeenAt: '2023-12-31T00:00:00.000Z',
    isCurrent: false,
    label: 'Windows 11',
    lastLoginAt: '2024-01-02T00:00:00.000Z',
    osName: 'Windows',
    osVersion: '11',
  };

  return {
    currentDevice,
    devices: [currentDevice, lastActiveDevice],
    lastActiveDevice,
    ...overrides,
  };
}

export function createTestProfileSnapshot(
  overrides: Partial<ProfileSnapshot> = {},
): ProfileSnapshot {
  return {
    devices: createTestDevicesPayload(),
    profile: createTestUser(),
    ...overrides,
  };
}

export function createDesktopBridgeMock(
  overrides: Partial<DesktopBridge> = {},
): DesktopBridge {
  return {
    authStorage: {
      clearRememberedSession: async () => undefined,
      getRememberedSession: async () => null as DesktopRememberedAuthSession | null,
      isPersistentStorageAvailable: async () => true,
      setRememberedSession: async () => undefined,
      ...(overrides.authStorage ?? {}),
    },
    environment: 'development',
    isPackaged: false,
    osVersion: '14.0',
    platform: 'darwin',
    versions: {
      chrome: '124',
      electron: '31',
      node: '20',
    },
    windowControls: {
      close: async () => undefined,
      getState: async () =>
        ({
          height: 900,
          isFullScreen: false,
          isMaximized: false,
          width: 1600,
        }) as DesktopWindowState,
      minimize: async () => undefined,
      onStateChange: () => () => undefined,
      setFullscreen: async () =>
        ({
          height: 900,
          isFullScreen: false,
          isMaximized: false,
          width: 1600,
        }) as DesktopWindowState,
      setResolution: async (width: number, height: number) =>
        ({
          height,
          isFullScreen: false,
          isMaximized: false,
          width,
        }) as DesktopWindowState,
      toggleMaximize: async () =>
        ({
          height: 900,
          isFullScreen: false,
          isMaximized: false,
          width: 1600,
        }) as DesktopWindowState,
      ...(overrides.windowControls ?? {}),
    },
    ...overrides,
  };
}

export async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export function resetDom(markup = '<div id="app"></div>'): HTMLElement {
  document.body.innerHTML = markup;
  return document.querySelector<HTMLElement>('#app') ?? document.body;
}
