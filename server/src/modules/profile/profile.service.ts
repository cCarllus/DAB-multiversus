import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { DatabaseClient } from '../../db/postgres';
import { AppError } from '../../shared/errors/AppError';
import { UsersService } from '../users/users.service';
import type { PublicUser } from '../users/users.types';
import { type ProfileRepository } from './profile.repository';
import {
  ALLOWED_AVATAR_MIME_TYPES,
  ensureProfileStorage,
  isLocalAvatarPath,
  MAX_AVATAR_FILE_BYTES,
  resolveAvatarAbsolutePath,
  resolveAvatarPublicPath,
} from './profile.storage';
import type {
  AvatarUploadInput,
  ProfileDevice,
  ProfileDevicesResponse,
  RecordUserDeviceInput,
  UserDeviceRecord,
} from './profile.types';

function buildDeviceLabel(device: UserDeviceRecord): string {
  return device.osVersion ? `${device.osName} ${device.osVersion}` : device.osName;
}

async function deleteLocalAvatar(avatarUrl: string | null | undefined): Promise<void> {
  if (!avatarUrl || !isLocalAvatarPath(avatarUrl)) {
    return;
  }

  const fileName = avatarUrl.slice(avatarUrl.lastIndexOf('/') + 1);

  if (!fileName) {
    return;
  }

  try {
    await unlink(resolveAvatarAbsolutePath(fileName));
  } catch {
    // Ignore avatar cleanup failures so profile updates never fail after the new file is saved.
  }
}

function resolveAvatarFileExtension(upload: AvatarUploadInput): string {
  const mimeTypeExtension = ALLOWED_AVATAR_MIME_TYPES.get(upload.mimetype);

  if (mimeTypeExtension) {
    return mimeTypeExtension;
  }

  const originalExtension = path.extname(upload.originalName).replace('.', '').toLowerCase();

  if (originalExtension && [...ALLOWED_AVATAR_MIME_TYPES.values()].includes(originalExtension)) {
    return originalExtension;
  }

  throw new AppError(
    400,
    'INVALID_AVATAR_TYPE',
    'Profile photo must be a PNG, JPG, or WEBP image.',
  );
}

function toProfileDevice(device: UserDeviceRecord, currentDeviceId?: string): ProfileDevice {
  return {
    appVersion: device.appVersion,
    firstSeenAt: device.firstSeenAt.toISOString(),
    isCurrent: currentDeviceId === device.deviceId,
    label: buildDeviceLabel(device),
    lastLoginAt: device.lastLoginAt.toISOString(),
    osName: device.osName,
    osVersion: device.osVersion,
  };
}

export class ProfileService {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly usersService: UsersService,
  ) {}

  async ensureStorage(): Promise<void> {
    await ensureProfileStorage();
  }

  async getCurrentProfile(userId: string, client?: DatabaseClient): Promise<PublicUser> {
    const user = await this.usersService.requireUserById(userId, client);
    return this.usersService.toPublicUser(user);
  }

  async updateProfileName(
    userId: string,
    name: string,
    client?: DatabaseClient,
  ): Promise<PublicUser> {
    const user = await this.usersService.updateName(userId, name, client);
    return this.usersService.toPublicUser(user);
  }

  async updateProfileAvatar(
    userId: string,
    upload: AvatarUploadInput,
    client?: DatabaseClient,
  ): Promise<PublicUser> {
    if (!upload.buffer.byteLength) {
      throw new AppError(400, 'AVATAR_REQUIRED', 'Choose an image before updating your photo.');
    }

    if (upload.buffer.byteLength > MAX_AVATAR_FILE_BYTES) {
      throw new AppError(400, 'AVATAR_TOO_LARGE', 'Profile photo must be 5 MB or smaller.');
    }

    const user = await this.usersService.requireUserById(userId, client);
    const extension = resolveAvatarFileExtension(upload);
    const fileName = `${user.id}-${Date.now()}-${randomUUID()}.${extension}`;
    const avatarPublicPath = resolveAvatarPublicPath(fileName);
    const avatarAbsolutePath = resolveAvatarAbsolutePath(fileName);

    await ensureProfileStorage();
    await writeFile(avatarAbsolutePath, upload.buffer);

    try {
      const updatedUser = await this.usersService.updateProfileImage(
        userId,
        avatarPublicPath,
        client,
      );
      await deleteLocalAvatar(user.profileImageUrl);
      return this.usersService.toPublicUser(updatedUser);
    } catch (error) {
      await deleteLocalAvatar(avatarPublicPath);
      throw error;
    }
  }

  async recordDeviceAccess(
    userId: string,
    input: RecordUserDeviceInput,
    client?: DatabaseClient,
  ): Promise<void> {
    await this.profileRepository.upsertUserDevice(userId, input, client);
  }

  async getProfileDevices(
    userId: string,
    currentDeviceId?: string,
    client?: DatabaseClient,
  ): Promise<ProfileDevicesResponse> {
    await this.usersService.requireUserById(userId, client);
    const devices = await this.profileRepository.listUserDevices(userId, client);
    const mappedDevices = devices.map((device) => toProfileDevice(device, currentDeviceId));
    const currentDevice =
      mappedDevices.find((device) => device.isCurrent) ??
      (currentDeviceId ? null : mappedDevices[0] ?? null);
    const lastActiveDevice =
      mappedDevices.find((device) => !device.isCurrent) ??
      mappedDevices[0] ??
      null;

    return {
      currentDevice,
      devices: mappedDevices,
      lastActiveDevice,
    };
  }
}
