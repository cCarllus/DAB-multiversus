import { AuthFlowError, type AuthResponse, type AuthUser } from './auth-types';

interface DeviceMetadata {
  appAgent: string;
  deviceName: string;
}

interface LoginPayload extends DeviceMetadata {
  identifier: string;
  password: string;
  rememberDevice: boolean;
}

interface RefreshPayload extends DeviceMetadata {
  refreshToken: string;
}

interface LogoutPayload {
  refreshToken?: string;
  sessionId?: string;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

function getBaseUrl(): string {
  return (import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '');
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export class AuthApiClient {
  constructor(private readonly baseUrl = getBaseUrl()) {}

  async register(payload: {
    email: string;
    password: string;
    username?: string;
  }): Promise<{ user: AuthUser }> {
    return this.request<{ user: AuthUser }>('/auth/register', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  }

  async refresh(payload: RefreshPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', {
      body: JSON.stringify(payload),
      method: 'POST',
    });
  }

  async getCurrentUser(accessToken: string): Promise<AuthUser> {
    const response = await this.request<{ user: AuthUser }>('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
    });

    return response.user;
  }

  async logout(payload: LogoutPayload, accessToken?: string): Promise<void> {
    await this.request<void>('/auth/logout', {
      body: JSON.stringify(payload),
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
      method: 'POST',
    });
  }

  logoutKeepAlive(payload: LogoutPayload, accessToken?: string): void {
    void fetch(`${this.baseUrl}/auth/logout`, {
      body: JSON.stringify(payload),
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        'Content-Type': 'application/json',
      },
      keepalive: true,
      method: 'POST',
    }).catch(() => undefined);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {}),
        },
      });

      const payload = isJsonResponse(response)
        ? ((await response.json()) as unknown)
        : undefined;

      if (!response.ok) {
        const errorEnvelope = (payload ?? {}) as ErrorEnvelope;
        throw new AuthFlowError(
          errorEnvelope.error?.code ?? 'UNKNOWN_AUTH_ERROR',
          errorEnvelope.error?.message ?? 'Authentication request failed.',
          response.status,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AuthFlowError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new AuthFlowError(
          'BACKEND_UNAVAILABLE',
          'The launcher could not reach the authentication service.',
        );
      }

      throw new AuthFlowError('UNKNOWN_AUTH_ERROR', 'Authentication request failed.');
    }
  }
}
