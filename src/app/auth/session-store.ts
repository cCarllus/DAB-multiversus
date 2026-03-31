import { STORAGE_KEYS } from '@shared/constants/storageKeys';
import type { DesktopBridge, DesktopRememberedAuthSession } from '@shared/types/desktop';

import { AuthFlowError, type AuthResponse, type StoredAuthSession } from './auth-types';

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.sessionExpiresAt === 'string' &&
    typeof candidate.rememberDevice === 'boolean' &&
    ('accessToken' in candidate || 'user' in candidate)
  );
}

export class SessionStore {
  private persistentSessionSupport: boolean | null = null;

  constructor(private readonly desktop: DesktopBridge) {}

  async supportsRememberedSessions(): Promise<boolean> {
    if (this.persistentSessionSupport !== null) {
      return this.persistentSessionSupport;
    }

    const isAvailable =
      (await this.desktop.authStorage?.isPersistentStorageAvailable?.()) ?? false;

    this.persistentSessionSupport = isAvailable;
    return isAvailable;
  }

  async loadSession(): Promise<StoredAuthSession | null> {
    const runtimeSession = this.readRuntimeSession();

    if (runtimeSession) {
      if (new Date(runtimeSession.sessionExpiresAt).getTime() <= Date.now()) {
        await this.clear();
        return null;
      }

      return runtimeSession;
    }

    const rememberedSession = await this.desktop.authStorage?.getRememberedSession();

    if (!rememberedSession) {
      return null;
    }

    if (new Date(rememberedSession.sessionExpiresAt).getTime() <= Date.now()) {
      await this.clearRememberedSession();
      return null;
    }

    return {
      user: null,
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: rememberedSession.refreshToken,
      sessionExpiresAt: rememberedSession.sessionExpiresAt,
      rememberDevice: true,
    };
  }

  async saveSession(session: AuthResponse): Promise<void> {
    const storedSession: StoredAuthSession = {
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      refreshToken: session.refreshToken,
      sessionExpiresAt: session.sessionExpiresAt,
      rememberDevice: session.rememberDevice,
    };

    window.sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(storedSession));

    if (!session.rememberDevice) {
      await this.clearRememberedSession();
      return;
    }

    if (!(await this.supportsRememberedSessions()) || !this.desktop.authStorage) {
      throw new AuthFlowError(
        'REMEMBER_DEVICE_UNAVAILABLE',
        'Secure remembered sessions are unavailable on this system.',
      );
    }

    const rememberedSession: DesktopRememberedAuthSession = {
      refreshToken: session.refreshToken,
      sessionExpiresAt: session.sessionExpiresAt,
      savedAt: new Date().toISOString(),
    };

    await this.desktop.authStorage.setRememberedSession(rememberedSession);
  }

  clearRuntimeSession(): void {
    window.sessionStorage.removeItem(STORAGE_KEYS.authSession);
  }

  async clear(): Promise<void> {
    this.clearRuntimeSession();
    await this.clearRememberedSession();
  }

  private readRuntimeSession(): StoredAuthSession | null {
    try {
      const rawValue = window.sessionStorage.getItem(STORAGE_KEYS.authSession);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!isStoredAuthSession(parsedValue)) {
        this.clearRuntimeSession();
        return null;
      }

      return parsedValue;
    } catch {
      this.clearRuntimeSession();
      return null;
    }
  }

  private async clearRememberedSession(): Promise<void> {
    await this.desktop.authStorage?.clearRememberedSession?.();
  }
}
