// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createElementFromTemplate } from '../../app/frontend/lib/html';
import { AppApiError, resolveApiErrorMessage } from '../../app/frontend/services/api/api-error';
import { resolveAuthDisplayName } from '../../app/frontend/services/auth/auth-types';
import { createLauncherDeviceContext } from '../../app/frontend/services/auth/device-context';
import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_AVATAR_ACCEPT,
} from '../../app/frontend/services/profile/profile.types';
import { STORAGE_KEYS } from '../../app/shared/constants/storage-keys';
import {
  SUPPORTED_LOCALES,
  createI18n,
  getInitialLocale,
  getLocaleOptionCopy,
  isSupportedLocale,
  resolveAppLocale,
} from '../../app/shared/i18n';
import { createDesktopBridgeMock, createTestI18n } from '../helpers/frontend';

const originalCrypto = globalThis.crypto;
const originalLocalStorage = globalThis.localStorage;
const originalNavigator = globalThis.navigator;

describe('frontend shared and core utilities', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    localStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('hydrates HTML templates and throws on invalid roots', () => {
    const element = createElementFromTemplate('<section>__TITLE__</section>', {
      TITLE: 'Dead As Battle',
    });
    expect(element.tagName).toBe('SECTION');
    expect(element.textContent).toBe('Dead As Battle');

    expect(() => createElementFromTemplate('plain text')).toThrow(
      'HTML template did not produce a valid root element.',
    );
  });

  it('resolves locale support, persistence, translation fallback, and formatting', () => {
    localStorage.setItem(STORAGE_KEYS.locale, 'en');
    expect(SUPPORTED_LOCALES).toEqual(['pt-BR', 'en']);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('pt-BR')).toBe(true);
    expect(isSupportedLocale('es')).toBe(false);
    expect(resolveAppLocale('pt-PT')).toBe('pt-BR');
    expect(resolveAppLocale('en-US')).toBe('en');
    expect(resolveAppLocale('  ')).toBe('pt-BR');
    expect(getInitialLocale()).toBe('en');

    localStorage.removeItem(STORAGE_KEYS.locale);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        language: 'pt-BR',
      },
    });
    expect(getInitialLocale()).toBe('pt-BR');

    const i18n = createI18n('en');
    expect(getLocaleOptionCopy(i18n.getMessages(), 'en')).toEqual(
      i18n.getMessages().login.locale.options.en,
    );
    expect(i18n.formatNumber(145800)).toBe('145,800');
    expect(i18n.t('menu.exitModal.body', { userLabel: 'Player' })).toContain('Player');
    expect(i18n.t('menu.exitModal.body')).toContain('');
    expect(i18n.t('missing.translation.key')).toBe('missing.translation.key');

    i18n.setLocale('pt-BR');
    expect(localStorage.getItem(STORAGE_KEYS.locale)).toBe('pt-BR');
    expect(i18n.getLocale()).toBe('pt-BR');

    const ptMessages = i18n.getMessages() as Record<string, unknown>;
    const originalTitle = ((ptMessages.menu as Record<string, unknown>).exitModal as Record<string, unknown>)
      .title;
    ((ptMessages.menu as Record<string, unknown>).exitModal as Record<string, unknown>).title =
      undefined;
    expect(i18n.t('menu.exitModal.title')).toBe(
      (createTestI18n('en').getMessages().menu.exitModal.title),
    );
    ((ptMessages.menu as Record<string, unknown>).exitModal as Record<string, unknown>).title =
      originalTitle;
  });

  it('swallows locale storage failures and falls back to defaults', () => {
    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error('no storage');
      }),
      setItem: vi.fn(() => {
        throw new Error('no storage');
      }),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: failingStorage,
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });

    expect(getInitialLocale()).toBe('pt-BR');
    const i18n = createI18n('en');
    expect(() => i18n.setLocale('en')).not.toThrow();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: undefined,
    });
    expect(getInitialLocale()).toBe('pt-BR');
    expect(resolveAppLocale('fr-FR')).toBe('pt-BR');
    expect(() => createI18n('en').setLocale('pt-BR')).not.toThrow();
  });

  it('resolves api errors and launcher base url', async () => {
    const i18n = createTestI18n('en');

    vi.stubEnv('VITE_AUTH_API_BASE_URL', '');
    vi.resetModules();
    const { resolveApiBaseUrl: resolveDefaultApiBaseUrl } = await import(
      '../../app/frontend/services/api/api-base-url'
    );
    expect(resolveDefaultApiBaseUrl()).toBe('http://127.0.0.1:4000');

    vi.stubEnv('VITE_AUTH_API_BASE_URL', 'https://api.example.com///');
    vi.resetModules();
    const { resolveApiBaseUrl: resolveConfiguredApiBaseUrl } = await import(
      '../../app/frontend/services/api/api-base-url'
    );
    expect(resolveConfiguredApiBaseUrl()).toBe('https://api.example.com');
    expect(
      resolveApiErrorMessage(new AppApiError('INVALID_CREDENTIALS', 'invalid'), i18n),
    ).toBe(i18n.t('auth.errors.invalidCredentials'));
    expect(
      resolveApiErrorMessage(new AppApiError('BACKEND_UNAVAILABLE', 'down'), i18n),
    ).toBe(i18n.t('auth.errors.backendUnavailable'));
    expect(
      resolveApiErrorMessage(new AppApiError('DATABASE_UNAVAILABLE', 'db down'), i18n),
    ).toBe(i18n.t('auth.errors.backendUnavailable'));
    expect(
      resolveApiErrorMessage(new AppApiError('SESSION_REVOKED', 'expired'), i18n),
    ).toBe(i18n.t('auth.errors.sessionExpired'));
    expect(
      resolveApiErrorMessage(new AppApiError('ACCESS_TOKEN_EXPIRED', 'expired'), i18n),
    ).toBe(i18n.t('auth.errors.sessionExpired'));
    expect(
      resolveApiErrorMessage(new AppApiError('REMEMBER_DEVICE_UNAVAILABLE', 'nope'), i18n),
    ).toBe(i18n.t('auth.errors.rememberDeviceUnavailable'));
    expect(
      resolveApiErrorMessage(new AppApiError('SESSION_PERSISTENCE_FAILED', 'persist'), i18n),
    ).toBe(i18n.t('auth.errors.sessionPersistenceFailed'));
    expect(
      resolveApiErrorMessage(new AppApiError('REQUEST_INVALID', 'bad request'), i18n),
    ).toBe(i18n.t('auth.errors.requestInvalid'));
    expect(
      resolveApiErrorMessage(new AppApiError('INVALID_NAME', 'bad name'), i18n),
    ).toBe(i18n.t('menu.profile.feedback.invalidName'));
    expect(
      resolveApiErrorMessage(new AppApiError('INVALID_AVATAR_TYPE', 'bad avatar'), i18n),
    ).toBe(i18n.t('menu.profile.feedback.invalidAvatarType'));
    expect(
      resolveApiErrorMessage(new AppApiError('AVATAR_TOO_LARGE', 'too large'), i18n),
    ).toBe(i18n.t('menu.profile.feedback.avatarTooLarge'));
    expect(resolveApiErrorMessage(new AppApiError('OTHER', 'custom'), i18n)).toBe('custom');
    expect(resolveApiErrorMessage(new Error('plain error'), i18n)).toBe('plain error');
    expect(resolveApiErrorMessage('unknown', i18n)).toBe(i18n.t('auth.errors.default'));
  });

  it('resolves display names, profile constants, and desktop device context', () => {
    expect(resolveAuthDisplayName({
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      profileImageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    })).toBe('Player One');
    expect(resolveAuthDisplayName({
      email: 'player@example.com',
      name: '',
      nickname: 'player.one',
      profileImageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    })).toBe('player.one');
    expect(resolveAuthDisplayName({
      email: 'player@example.com',
      name: '',
      nickname: '',
      profileImageUrl: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    })).toBe('player');

    expect(MAX_PROFILE_AVATAR_BYTES).toBe(5 * 1024 * 1024);
    expect(PROFILE_AVATAR_ACCEPT).toBe('image/png,image/jpeg,image/jpg,image/webp');
    expect(STORAGE_KEYS.locale).toBe('dab-multiversus.locale');

    const uuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('device-uuid');
    const desktop = createDesktopBridgeMock();
    const context = createLauncherDeviceContext(desktop, '0.1.0');

    expect(context).toEqual({
      appAgent: 'Dead As Battle/0.1.0 Electron/31 macOS/14.0',
      appVersion: '0.1.0',
      deviceId: 'device-uuid',
      deviceName: 'Dead As Battle Launcher on macOS',
      osName: 'macOS',
      osVersion: '14.0',
    });
    expect(localStorage.getItem(STORAGE_KEYS.deviceId)).toBe('device-uuid');

    localStorage.setItem(STORAGE_KEYS.deviceId, 'stored-device');
    expect(createLauncherDeviceContext(createDesktopBridgeMock(), '0.1.0').deviceId).toBe(
      'stored-device',
    );

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('no storage');
        },
        setItem: () => {
          throw new Error('no storage');
        },
      },
    });
    expect(
      createLauncherDeviceContext(
        createDesktopBridgeMock({
          platform: 'linux',
          osVersion: '',
          versions: {
            chrome: '1',
            electron: '2',
            node: '3',
          },
        }),
        '0.1.0',
      ),
    ).toMatchObject({
      appAgent: 'Dead As Battle/0.1.0 Electron/2 Linux/Unknown',
      deviceId: 'device-1234-4fzzzxjy',
      deviceName: 'Dead As Battle Launcher on Linux',
      osName: 'Linux',
      osVersion: 'Unknown',
    });

    expect(
      createLauncherDeviceContext(
        createDesktopBridgeMock({
          platform: 'win32',
        }),
        '0.1.0',
      ).osName,
    ).toBe('Windows');

    expect(
      createLauncherDeviceContext(
        createDesktopBridgeMock({
          platform: 'browser',
        }),
        '0.1.0',
      ).osName,
    ).toBe('Browser');

    expect(
      createLauncherDeviceContext(
        createDesktopBridgeMock({
          platform: 'plan9',
        }),
        '0.1.0',
      ).osName,
    ).toBe('plan9');
    expect(
      createLauncherDeviceContext(
        createDesktopBridgeMock({
          platform: '',
        }),
        '0.1.0',
      ).osName,
    ).toBe('Unknown OS');

    uuidSpy.mockRestore();
    nowSpy.mockRestore();
    randomSpy.mockRestore();
  });
});
