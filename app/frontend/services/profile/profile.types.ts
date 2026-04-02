import type { AuthUser } from '@shared/contracts/auth.contract';
import type {
  ProfileDevice,
  ProfileDevicesResponse,
} from '@shared/contracts/profile.contract';

export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';

export type { ProfileDevice };
export type ProfileDevicesPayload = ProfileDevicesResponse;

export interface ProfileSnapshot {
  devices: ProfileDevicesPayload;
  profile: AuthUser;
}

export interface ProfileFeedback {
  message: string;
  tone: 'error' | 'success';
}
