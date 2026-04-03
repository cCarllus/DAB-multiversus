import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type { AuthUser } from '@frontend/services/auth/auth-types';
import type { ProfileDevicesPayload } from '@frontend/services/profile/profile.types';

const PROFILE_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_PROFILE_ERROR',
  failureMessage: 'Profile request failed.',
  networkMessage: 'The launcher could not reach the profile service.',
} as const;

export class ProfileApiClient extends BackendApiClient {

  async getProfile(accessToken: string): Promise<AuthUser> {
    const response = await this.request<{ profile: AuthUser }>('/profile/me', {
      accessToken,
      method: 'GET',
    }, PROFILE_REQUEST_MESSAGES);

    return response.profile;
  }

  async updateProfile(accessToken: string, payload: { name: string }): Promise<AuthUser> {
    const response = await this.request<{ profile: AuthUser }>('/profile/me', {
      accessToken,
      body: JSON.stringify(payload),
      method: 'PATCH',
    }, PROFILE_REQUEST_MESSAGES);

    return response.profile;
  }

  async uploadAvatar(accessToken: string, file: File): Promise<AuthUser> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await this.request<{ profile: AuthUser }>('/profile/me/avatar', {
      accessToken,
      body: formData,
      method: 'POST',
    }, PROFILE_REQUEST_MESSAGES);

    return response.profile;
  }

  async getDevices(accessToken: string, deviceId: string): Promise<ProfileDevicesPayload> {
    return this.request<ProfileDevicesPayload>('/profile/me/devices', {
      accessToken,
      headers: {
        'X-Launcher-Device-Id': deviceId,
      },
      method: 'GET',
    }, PROFILE_REQUEST_MESSAGES);
  }
}
