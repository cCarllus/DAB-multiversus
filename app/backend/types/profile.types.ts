import type { ProfileDevice, ProfileDevicesResponse } from '../../shared/contracts/profile.contract';

export type { ProfileDevice, ProfileDevicesResponse };

export interface UserDeviceRecord {
  id: string;
  userId: string;
  deviceId: string;
  osName: string;
  osVersion: string | null;
  appVersion: string | null;
  firstSeenAt: Date;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordUserDeviceInput {
  appVersion?: string;
  deviceId: string;
  osName: string;
  osVersion?: string;
}

export interface AvatarUploadInput {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
}
