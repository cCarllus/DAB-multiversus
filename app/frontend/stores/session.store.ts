import { STORAGE_KEYS } from '@shared/constants/storage-keys';
import type { DesktopBridge, DesktopRememberedAuthSession } from '@shared/contracts/desktop.contract';
import { AppApiError } from '@frontend/services/api/api-error';

import {
  type AuthResponse,
  type AuthUser,
  type StoredAuthSession,
} from '@frontend/services/auth/auth-types';

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

function isRememberedAuthSession(value: unknown): value is DesktopRememberedAuthSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.refreshToken === 'string' &&
    typeof candidate.sessionExpiresAt === 'string' &&
    typeof candidate.savedAt === 'string' &&
    typeof candidate.rememberDevice === 'boolean'
  );
}

export class SessionStore {
  private persistentSessionSupport: boolean | null = null;

  constructor(private readonly desktop: DesktopBridge) {}

  async supportsRememberedSessions(): Promise<boolean> {
    if (this.persistentSessionSupport !== null) {
      return this.persistentSessionSupport;
    }

    const electronStorageAvailable =
      (await this.desktop.authStorage?.isPersistentStorageAvailable?.()) ?? false;
    const isAvailable = electronStorageAvailable || this.supportsLocalPersistentStorage();

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

    const rememberedSession = await this.readRememberedSession();

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
      rememberDevice: rememberedSession.rememberDevice,
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

    if (!(await this.supportsRememberedSessions())) {
      throw new AppApiError(
        'REMEMBER_DEVICE_UNAVAILABLE',
        'Persistent launcher sessions are unavailable on this system.',
      );
    }

    const rememberedSession: DesktopRememberedAuthSession = {
      refreshToken: session.refreshToken,
      rememberDevice: session.rememberDevice,
      sessionExpiresAt: session.sessionExpiresAt,
      savedAt: new Date().toISOString(),
    };

    await this.writeRememberedSession(rememberedSession);
  }

  updateRuntimeUser(user: AuthUser): void {
    const session = this.readRuntimeSession();

    if (!session) {
      return;
    }

    const nextSession: StoredAuthSession = {
      ...session,
      user,
    };

    window.sessionStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(nextSession));
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
    await Promise.allSettled([
      this.desktop.authStorage?.clearRememberedSession?.(),
      Promise.resolve(this.clearLocalRememberedSession()),
    ]);
  }

  private async readRememberedSession(): Promise<DesktopRememberedAuthSession | null> {
    const desktopRememberedSession =
      (await this.desktop.authStorage?.getRememberedSession?.()) ?? null;

    if (desktopRememberedSession) {
      this.clearLocalRememberedSession();
      return desktopRememberedSession;
    }

    return this.readLocalRememberedSession();
  }

  private async writeRememberedSession(
    session: DesktopRememberedAuthSession,
  ): Promise<void> {
    if (this.desktop.authStorage && (await this.desktop.authStorage.isPersistentStorageAvailable())) {
      await this.desktop.authStorage.setRememberedSession(session);
      this.clearLocalRememberedSession();
      return;
    }

    if (!this.supportsLocalPersistentStorage()) {
      throw new AppApiError(
        'REMEMBER_DEVICE_UNAVAILABLE',
        'Persistent launcher sessions are unavailable on this system.',
      );
    }

    window.localStorage.setItem(
      STORAGE_KEYS.rememberedAuthSession,
      JSON.stringify(session),
    );
  }

  private readLocalRememberedSession(): DesktopRememberedAuthSession | null {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEYS.rememberedAuthSession);

      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue) as unknown;

      if (!isRememberedAuthSession(parsedValue)) {
        this.clearLocalRememberedSession();
        return null;
      }

      return parsedValue;
    } catch {
      this.clearLocalRememberedSession();
      return null;
    }
  }

  private clearLocalRememberedSession(): void {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.rememberedAuthSession);
    } catch {
      // Ignore storage unavailability during cleanup.
    }
  }

  private supportsLocalPersistentStorage(): boolean {
    try {
      const probeKey = `${STORAGE_KEYS.rememberedAuthSession}.probe`;
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }
}
