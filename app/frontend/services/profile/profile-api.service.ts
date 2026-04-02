import { AppApiError } from '@frontend/services/api/api-error';
import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';
import type { AuthUser } from '@frontend/services/auth/auth-types';
import type { ProfileDevicesPayload } from '@frontend/services/profile/profile.types';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export class ProfileApiClient {
  constructor(private readonly baseUrl = resolveApiBaseUrl()) {}

  resolveAssetUrl(assetPath: string | null): string | null {
    if (!assetPath) {
      return null;
    }

    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath;
    }

    return `${this.baseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
  }

  async getProfile(accessToken: string): Promise<AuthUser> {
    const response = await this.request<{ profile: AuthUser }>('/profile/me', {
      accessToken,
      method: 'GET',
    });

    return response.profile;
  }

  async updateProfile(accessToken: string, payload: { name: string }): Promise<AuthUser> {
    const response = await this.request<{ profile: AuthUser }>('/profile/me', {
      accessToken,
      body: JSON.stringify(payload),
      method: 'PATCH',
    });

    return response.profile;
  }

  async uploadAvatar(accessToken: string, file: File): Promise<AuthUser> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this.request<{ profile: AuthUser }>('/profile/me/avatar', {
      accessToken,
      body: formData,
      method: 'POST',
    });

    return response.profile;
  }

  async getDevices(accessToken: string, deviceId: string): Promise<ProfileDevicesPayload> {
    return this.request<ProfileDevicesPayload>('/profile/me/devices', {
      accessToken,
      headers: {
        'X-Launcher-Device-Id': deviceId,
      },
      method: 'GET',
    });
  }

  private async request<T>(
    path: string,
    options: {
      accessToken: string;
      body?: BodyInit;
      headers?: HeadersInit;
      method: 'GET' | 'PATCH' | 'POST';
    },
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        body: options.body,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${options.accessToken}`,
          ...(options.body && !(options.body instanceof FormData)
            ? {
                'Content-Type': 'application/json',
              }
            : {}),
          ...(options.headers ?? {}),
        },
        method: options.method,
      });

      const payload = isJsonResponse(response)
        ? ((await response.json()) as unknown)
        : undefined;

      if (!response.ok) {
        const errorEnvelope = (payload ?? {}) as ErrorEnvelope;
        throw new AppApiError(
          errorEnvelope.error?.code ?? 'UNKNOWN_PROFILE_ERROR',
          errorEnvelope.error?.message ?? 'Profile request failed.',
          response.status,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AppApiError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new AppApiError(
          'BACKEND_UNAVAILABLE',
          'The launcher could not reach the profile service.',
        );
      }

      throw new AppApiError('UNKNOWN_PROFILE_ERROR', 'Profile request failed.');
    }
  }
}
