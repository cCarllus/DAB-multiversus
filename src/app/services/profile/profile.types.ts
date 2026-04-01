import type { AuthUser } from '@app/services/auth/auth-types';

export interface DeviceListItem {
  label: string;
  meta: string;
  state: string;
}

export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

export interface ProfileDevice {
  appVersion: string | null;
  firstSeenAt: string;
  isCurrent: boolean;
  label: string;
  lastLoginAt: string;
  osName: string;
  osVersion: string | null;
}

export interface ProfileDevicesPayload {
  currentDevice: ProfileDevice | null;
  devices: ProfileDevice[];
  lastActiveDevice: ProfileDevice | null;
}

export interface ProfileSnapshot {
  devices: ProfileDevicesPayload;
  profile: AuthUser;
}

export interface ProfileFeedback {
  message: string;
  tone: 'error' | 'success';
}
