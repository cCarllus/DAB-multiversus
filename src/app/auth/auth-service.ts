import type { DesktopBridge } from '@shared/types/desktop';
import type { AppI18n } from '@shared/i18n';

import { AuthApiClient } from './auth-api-client';
import { createLauncherDeviceContext } from './device-context';
import {
  AuthFlowError,
  type LoginFormValues,
  type AuthUser,
  type StoredAuthSession,
} from './auth-types';
import { SessionStore } from './session-store';

const DEV_TEST_ACCOUNT = {
  email: 'teste@dab.local',
  name: 'Teste',
  nickname: 'teste',
  password: 'SenhaForte123!',
} as const;

function isSessionInvalidatingError(error: unknown): boolean {
  return (
    error instanceof AuthFlowError &&
    ['REFRESH_TOKEN_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'UNAUTHORIZED'].includes(
      error.code,
    )
  );
}

export function resolveAuthErrorMessage(error: unknown, i18n: AppI18n): string {
  if (error instanceof AuthFlowError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return i18n.t('auth.errors.invalidCredentials');
      case 'BACKEND_UNAVAILABLE':
      case 'DATABASE_UNAVAILABLE':
        return i18n.t('auth.errors.backendUnavailable');
      case 'SESSION_EXPIRED':
      case 'SESSION_REVOKED':
      case 'REFRESH_TOKEN_INVALID':
      case 'ACCESS_TOKEN_EXPIRED':
      case 'UNAUTHORIZED':
        return i18n.t('auth.errors.sessionExpired');
      case 'REMEMBER_DEVICE_UNAVAILABLE':
        return i18n.t('auth.errors.rememberDeviceUnavailable');
      case 'SESSION_PERSISTENCE_FAILED':
        return i18n.t('auth.errors.sessionPersistenceFailed');
      case 'REQUEST_INVALID':
        return i18n.t('auth.errors.requestInvalid');
      case 'INVALID_NAME':
        return i18n.t('menu.profile.feedback.invalidName');
      case 'INVALID_AVATAR_TYPE':
        return i18n.t('menu.profile.feedback.invalidAvatarType');
      case 'AVATAR_TOO_LARGE':
        return i18n.t('menu.profile.feedback.avatarTooLarge');
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return i18n.t('auth.errors.default');
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
      throw new AuthFlowError(
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

      if (error instanceof AuthFlowError) {
        throw error;
      }

      throw new AuthFlowError(
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
      if (!(error instanceof AuthFlowError) || error.code !== 'INVALID_CREDENTIALS') {
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
            registerError instanceof AuthFlowError &&
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

  handleBeforeUnload(): void {
    if (!this.currentSession || this.currentSession.rememberDevice) {
      return;
    }

    this.apiClient.logoutKeepAlive(
      {
        refreshToken: this.currentSession.refreshToken,
      },
      this.currentSession.accessToken ?? undefined,
    );

    this.sessionStore.clearRuntimeSession();
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
      throw new AuthFlowError('UNAUTHENTICATED', 'No active session is available.');
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
