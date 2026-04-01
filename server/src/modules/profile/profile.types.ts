import { z } from 'zod';

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

export const updateProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(40),
});
