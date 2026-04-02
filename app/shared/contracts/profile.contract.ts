export interface ProfileDevice {
  appVersion: string | null;
  firstSeenAt: string;
  isCurrent: boolean;
  label: string;
  lastLoginAt: string;
  osName: string;
  osVersion: string | null;
}

export interface ProfileDevicesResponse {
  currentDevice: ProfileDevice | null;
  devices: ProfileDevice[];
  lastActiveDevice: ProfileDevice | null;
}
