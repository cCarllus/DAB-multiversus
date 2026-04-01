import type { DesktopBridge } from '@shared/types/desktop';
import { AppApiError } from '@app/services/api/api-error';
import { SessionStore } from '@app/stores/session.store';

import { AuthApiClient } from './auth-api-client';
import { createLauncherDeviceContext } from './device-context';
import {
  type LoginFormValues,
  type AuthUser,
  type StoredAuthSession,
} from './auth-types';

const DEV_TEST_ACCOUNT = {
  email: 'teste@dab.local',
  name: 'Teste',
  nickname: 'teste',
  password: 'SenhaForte123!',
} as const;

function isSessionInvalidatingError(error: unknown): boolean {
  return (
    error instanceof AppApiError &&
    ['REFRESH_TOKEN_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'UNAUTHORIZED'].includes(
      error.code,
    )
  );
}

export class AuthService {
  private currentSession: StoredAuthSession | null = null;

  private readonly sessionStore: SessionStore;

  constructor(
    private readonly desktop: DesktopBridge,
    private readonly appVersion: string,
    private readonly apiClient = new AuthApiClient(),
  ) {
    this.sessionStore = new SessionStore(desktop);
  }

  async supportsRememberedSessions(): Promise<boolean> {
    return this.sessionStore.supportsRememberedSessions();
  }

  getCurrentSession(): StoredAuthSession | null {
    return this.currentSession;
  }

  async initialize(): Promise<StoredAuthSession | null> {
    const storedSession = await this.sessionStore.loadSession();

    if (!storedSession?.refreshToken) {
      this.currentSession = null;
      return null;
    }

    try {
      const refreshedSession = await this.apiClient.refresh({
        refreshToken: storedSession.refreshToken,
        ...this.getDeviceMetadata(),
      });

      await this.sessionStore.saveSession(refreshedSession);
      this.currentSession = refreshedSession;
      return refreshedSession;
    } catch (error) {
      if (isSessionInvalidatingError(error)) {
        await this.sessionStore.clear();
        this.currentSession = null;
        return null;
      }

      throw error;
    }
  }

  async login(values: LoginFormValues): Promise<StoredAuthSession> {
    if (values.rememberDevice && !(await this.supportsRememberedSessions())) {
      throw new AppApiError(
        'REMEMBER_DEVICE_UNAVAILABLE',
        'Secure remembered sessions are unavailable on this system.',
      );
    }

    const session = await this.apiClient.login({
      identifier: values.identifier,
      password: values.password,
      rememberDevice: values.rememberDevice,
      ...this.getDeviceMetadata(),
    });

    try {
      await this.sessionStore.saveSession(session);
      this.currentSession = session;
      return session;
    } catch (error) {
      await this.sessionStore.clear();
      await this.apiClient.logout(
        {
          refreshToken: session.refreshToken,
        },
        session.accessToken,
      ).catch(() => undefined);

      if (error instanceof AppApiError) {
        throw error;
      }

      throw new AppApiError(
        'SESSION_PERSISTENCE_FAILED',
        'The launcher could not secure the session locally.',
      );
    }
  }

  async loginWithDevAccount(): Promise<StoredAuthSession> {
    const rememberDevice = await this.supportsRememberedSessions();
    const values: LoginFormValues = {
      identifier: DEV_TEST_ACCOUNT.email,
      password: DEV_TEST_ACCOUNT.password,
      rememberDevice,
    };

    try {
      return await this.login(values);
    } catch (error) {
      if (!(error instanceof AppApiError) || error.code !== 'INVALID_CREDENTIALS') {
        throw error;
      }

      try {
        await this.apiClient.register({
          email: DEV_TEST_ACCOUNT.email,
          name: DEV_TEST_ACCOUNT.name,
          nickname: DEV_TEST_ACCOUNT.nickname,
          password: DEV_TEST_ACCOUNT.password,
        });
      } catch (registerError) {
        if (
          !(
            registerError instanceof AppApiError &&
            ['EMAIL_ALREADY_IN_USE', 'NICKNAME_ALREADY_IN_USE'].includes(registerError.code)
          )
        ) {
          throw registerError;
        }
      }

      return this.login(values);
    }
  }

  async ensureAccessToken(): Promise<string | null> {
    if (!this.currentSession) {
      return null;
    }

    if (
      !this.currentSession.accessToken ||
      this.isAccessTokenExpiringSoon(this.currentSession.accessTokenExpiresAt)
    ) {
      const refreshedSession = await this.refreshCurrentSession();
      return refreshedSession.accessToken;
    }

    return this.currentSession.accessToken;
  }

  async logout(): Promise<void> {
    const session = this.currentSession ?? (await this.sessionStore.loadSession());

    if (session?.refreshToken) {
      await this.apiClient
        .logout(
          {
            refreshToken: session.refreshToken,
          },
          session.accessToken ?? undefined,
        )
        .catch(() => undefined);
    }

    await this.sessionStore.clear();
    this.currentSession = null;
  }

  syncCurrentUser(user: AuthUser): void {
    if (!this.currentSession) {
      return;
    }

    this.currentSession = {
      ...this.currentSession,
      user,
    };

    this.sessionStore.updateRuntimeUser(user);
  }

  private async refreshCurrentSession(): Promise<StoredAuthSession> {
    const refreshToken = this.currentSession?.refreshToken;

    if (!refreshToken) {
      throw new AppApiError('UNAUTHENTICATED', 'No active session is available.');
    }

    const refreshedSession = await this.apiClient.refresh({
      refreshToken,
      ...this.getDeviceMetadata(),
    });

    await this.sessionStore.saveSession(refreshedSession);
    this.currentSession = refreshedSession;
    return refreshedSession;
  }

  private getDeviceMetadata() {
    return createLauncherDeviceContext(this.desktop, this.appVersion);
  }

  private isAccessTokenExpiringSoon(expiresAt: string | null): boolean {
    if (!expiresAt) {
      return true;
    }

    return new Date(expiresAt).getTime() - Date.now() <= 60_000;
  }
}
