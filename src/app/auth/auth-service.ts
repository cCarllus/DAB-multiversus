import type { DesktopBridge } from '@shared/types/desktop';

import { AuthApiClient } from './auth-api-client';
import {
  AuthFlowError,
  type LoginFormValues,
  type StoredAuthSession,
} from './auth-types';
import { SessionStore } from './session-store';

function isSessionInvalidatingError(error: unknown): boolean {
  return (
    error instanceof AuthFlowError &&
    ['REFRESH_TOKEN_INVALID', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'UNAUTHORIZED'].includes(
      error.code,
    )
  );
}

export function resolveAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthFlowError) {
    switch (error.code) {
      case 'INVALID_CREDENTIALS':
        return 'Email, nome de usuário ou senha incorretos.';
      case 'BACKEND_UNAVAILABLE':
      case 'DATABASE_UNAVAILABLE':
        return 'O launcher não conseguiu alcançar o serviço de autenticação.';
      case 'SESSION_EXPIRED':
      case 'SESSION_REVOKED':
      case 'REFRESH_TOKEN_INVALID':
      case 'ACCESS_TOKEN_EXPIRED':
      case 'UNAUTHORIZED':
        return 'Sua sessão expirou. Faça login novamente.';
      case 'REMEMBER_DEVICE_UNAVAILABLE':
        return 'O armazenamento seguro do Electron não está disponível neste dispositivo.';
      case 'SESSION_PERSISTENCE_FAILED':
        return 'A sessão foi criada, mas o launcher não conseguiu protegê-la localmente.';
      case 'REQUEST_INVALID':
        return 'Revise os dados informados e tente novamente.';
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Não foi possível concluir a autenticação agora.';
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

  async handleBeforeUnload(): Promise<void> {
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

  private getDeviceMetadata(): { deviceName: string; appAgent: string } {
    return {
      deviceName: `Dead As Battle Launcher (${this.desktop.platform})`,
      appAgent: `Dead As Battle/${this.appVersion} Electron/${this.desktop.versions.electron} ${this.desktop.platform}`,
    };
  }

  private isAccessTokenExpiringSoon(expiresAt: string | null): boolean {
    if (!expiresAt) {
      return true;
    }

    return new Date(expiresAt).getTime() - Date.now() <= 60_000;
  }
}
