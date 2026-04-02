import { AppApiError } from '@frontend/services/api/api-error';
import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';

import type { AuthResponse, AuthUser } from './auth-types';

interface DeviceMetadata {
  appAgent: string;
  appVersion: string;
  deviceId: string;
  deviceName: string;
  osName: string;
  osVersion: string;
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

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export class AuthApiClient {
  constructor(private readonly baseUrl = resolveApiBaseUrl()) {}

  async register(payload: {
    email: string;
    name?: string;
    nickname: string;
    password: string;
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
        throw new AppApiError(
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
      if (error instanceof AppApiError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new AppApiError(
          'BACKEND_UNAVAILABLE',
          'The launcher could not reach the authentication service.',
        );
      }

      throw new AppApiError('UNKNOWN_AUTH_ERROR', 'Authentication request failed.');
    }
  }
}
