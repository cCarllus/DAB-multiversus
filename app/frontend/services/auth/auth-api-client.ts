import { BackendApiClient } from '@frontend/services/api/backend-api-client';

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

const AUTH_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_AUTH_ERROR',
  failureMessage: 'Authentication request failed.',
  networkMessage: 'The launcher could not reach the authentication service.',
} as const;

export class AuthApiClient extends BackendApiClient {

  async register(payload: {
    email: string;
    name?: string;
    nickname: string;
    password: string;
  }): Promise<{ user: AuthUser }> {
    return this.request<{ user: AuthUser }>('/auth/register', {
      body: JSON.stringify(payload),
      method: 'POST',
    }, AUTH_REQUEST_MESSAGES);
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      body: JSON.stringify(payload),
      method: 'POST',
    }, AUTH_REQUEST_MESSAGES);
  }

  async refresh(payload: RefreshPayload): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', {
      body: JSON.stringify(payload),
      method: 'POST',
    }, AUTH_REQUEST_MESSAGES);
  }

  async getCurrentUser(accessToken: string): Promise<AuthUser> {
    const response = await this.request<{ user: AuthUser }>('/auth/me', {
      accessToken,
      method: 'GET',
    }, AUTH_REQUEST_MESSAGES);

    return response.user;
  }

  async logout(payload: LogoutPayload, accessToken?: string): Promise<void> {
    await this.request<void>('/auth/logout', {
      accessToken,
      body: JSON.stringify(payload),
      method: 'POST',
    }, AUTH_REQUEST_MESSAGES);
  }
}
