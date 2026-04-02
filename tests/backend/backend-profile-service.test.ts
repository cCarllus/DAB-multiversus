import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fsMocks = vi.hoisted(() => ({
  mkdirMock: vi.fn(async () => undefined),
  unlinkMock: vi.fn(async () => undefined),
  writeFileMock: vi.fn(async () => undefined),
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');

  return {
    ...actual,
    randomUUID: vi.fn(() => 'static-uuid'),
  };
});

vi.mock('node:fs/promises', () => ({
  mkdir: fsMocks.mkdirMock,
  unlink: fsMocks.unlinkMock,
  writeFile: fsMocks.writeFileMock,
}));

import { ProfileService } from '../../app/backend/services/profile.service';
import { PROFILE_AVATAR_ROUTE_PREFIX, PROFILE_AVATARS_ROOT, MAX_AVATAR_FILE_BYTES } from '../../app/backend/lib/profile-storage';
import { AppError } from '../../app/backend/lib/app-error';
import type { PublicUser } from '../../app/backend/types/users.types';

async function expectRejectedAppError(
  promise: Promise<unknown>,
  expected: { code: string; statusCode: number },
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject(expected);
  }
}

describe('profile service', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let profileRepository: {
    listUserDevices: ReturnType<typeof vi.fn>;
    upsertUserDevice: ReturnType<typeof vi.fn>;
  };
  let usersService: {
    requireUserById: ReturnType<typeof vi.fn>;
    toPublicUser: ReturnType<typeof vi.fn>;
    updateName: ReturnType<typeof vi.fn>;
    updateProfileImage: ReturnType<typeof vi.fn>;
  };
  let service: ProfileService;
  let publicUser: PublicUser;
  let userRecord: {
    id: string;
    email: string;
    name: string;
    nickname: string;
    passwordHash: string;
    profileImageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_717_171_717_171);
    publicUser = {
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      profileImageUrl: `${PROFILE_AVATAR_ROUTE_PREFIX}old.png`,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    userRecord = {
      id: 'user-1',
      email: 'player@example.com',
      name: 'Player One',
      nickname: 'player.one',
      passwordHash: 'hash',
      profileImageUrl: `${PROFILE_AVATAR_ROUTE_PREFIX}old.png`,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    };
    profileRepository = {
      listUserDevices: vi.fn(async () => []),
      upsertUserDevice: vi.fn(async () => undefined),
    };
    usersService = {
      requireUserById: vi.fn(async () => userRecord),
      toPublicUser: vi.fn((input) => ({
        email: input.email,
        name: input.name,
        nickname: input.nickname,
        profileImageUrl: input.profileImageUrl,
        createdAt: input.createdAt.toISOString(),
      })),
      updateName: vi.fn(async () => userRecord),
      updateProfileImage: vi.fn(async () => ({
        ...userRecord,
        profileImageUrl: `${PROFILE_AVATAR_ROUTE_PREFIX}new.png`,
      })),
    };
    service = new ProfileService(profileRepository as never, usersService as never);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('ensures storage and returns current profile data', async () => {
    await service.ensureStorage();
    expect(fsMocks.mkdirMock).toHaveBeenCalledWith(PROFILE_AVATARS_ROOT, { recursive: true });

    await expect(service.getCurrentProfile('user-1')).resolves.toEqual(publicUser);
    expect(usersService.requireUserById).toHaveBeenCalledWith('user-1', undefined);
  });

  it('updates profile name and records device access', async () => {
    await expect(service.updateProfileName('user-1', 'New Name')).resolves.toEqual(publicUser);
    expect(usersService.updateName).toHaveBeenCalledWith('user-1', 'New Name', undefined);

    await service.recordDeviceAccess('user-1', {
      appVersion: '0.1.0',
      deviceId: 'device-1',
      osName: 'macOS',
      osVersion: '14.0',
    });
    expect(profileRepository.upsertUserDevice).toHaveBeenCalledWith(
      'user-1',
      {
        appVersion: '0.1.0',
        deviceId: 'device-1',
        osName: 'macOS',
        osVersion: '14.0',
      },
      undefined,
    );
  });

  it('uploads avatars using mime types, extensions, and old-file cleanup', async () => {
    const updated = await service.updateProfileAvatar('user-1', {
      buffer: Buffer.from('avatar'),
      mimetype: 'image/png',
      originalName: 'avatar.bin',
    });

    expect(fsMocks.mkdirMock).toHaveBeenCalled();
    expect(fsMocks.writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('/storage/uploads/avatars/user-1-1717171717171-static-uuid.png'),
      Buffer.from('avatar'),
    );
    expect(usersService.updateProfileImage).toHaveBeenCalledWith(
      'user-1',
      `${PROFILE_AVATAR_ROUTE_PREFIX}user-1-1717171717171-static-uuid.png`,
      undefined,
    );
    expect(fsMocks.unlinkMock).toHaveBeenCalledWith(
      expect.stringContaining('/storage/uploads/avatars/old.png'),
    );
    expect(updated.profileImageUrl).toBe(`${PROFILE_AVATAR_ROUTE_PREFIX}new.png`);

    fsMocks.unlinkMock.mockClear();
    usersService.requireUserById.mockResolvedValueOnce({
      ...userRecord,
      profileImageUrl: 'https://example.com/avatar.png',
    });

    await service.updateProfileAvatar('user-1', {
      buffer: Buffer.from('avatar'),
      mimetype: 'application/octet-stream',
      originalName: 'avatar.webp',
    });

    expect(fsMocks.writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('.webp'),
      Buffer.from('avatar'),
    );
    expect(fsMocks.unlinkMock).not.toHaveBeenCalled();
  });

  it('rejects missing, too-large, and unsupported avatar files', async () => {
    await expectRejectedAppError(
      service.updateProfileAvatar('user-1', {
        buffer: Buffer.alloc(0),
        mimetype: 'image/png',
        originalName: 'avatar.png',
      }),
      {
      code: 'AVATAR_REQUIRED',
      statusCode: 400,
      },
    );

    await expectRejectedAppError(
      service.updateProfileAvatar('user-1', {
        buffer: Buffer.alloc(MAX_AVATAR_FILE_BYTES + 1),
        mimetype: 'image/png',
        originalName: 'avatar.png',
      }),
      {
      code: 'AVATAR_TOO_LARGE',
      statusCode: 400,
      },
    );

    await expectRejectedAppError(
      service.updateProfileAvatar('user-1', {
        buffer: Buffer.from('avatar'),
        mimetype: 'application/octet-stream',
        originalName: 'avatar.txt',
      }),
      {
      code: 'INVALID_AVATAR_TYPE',
      statusCode: 400,
      },
    );
  });

  it('cleans up the new avatar file when persistence fails', async () => {
    usersService.updateProfileImage.mockRejectedValueOnce(new Error('db down'));

    await expect(
      service.updateProfileAvatar('user-1', {
        buffer: Buffer.from('avatar'),
        mimetype: 'image/png',
        originalName: 'avatar.png',
      }),
    ).rejects.toThrow('db down');

    expect(fsMocks.unlinkMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/storage/uploads/avatars/user-1-1717171717171-static-uuid.png',
      ),
    );
  });

  it('maps device snapshots with current and fallback resolution', async () => {
    profileRepository.listUserDevices.mockResolvedValueOnce([
      {
        appVersion: '0.2.0',
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        deviceId: 'device-1',
        firstSeenAt: new Date('2024-01-01T00:00:00.000Z'),
        id: 'row-1',
        lastLoginAt: new Date('2024-01-04T00:00:00.000Z'),
        osName: 'macOS',
        osVersion: '14.0',
        updatedAt: new Date('2024-01-04T00:00:00.000Z'),
        userId: 'user-1',
      },
      {
        appVersion: null,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        deviceId: 'device-2',
        firstSeenAt: new Date('2024-01-01T00:00:00.000Z'),
        id: 'row-2',
        lastLoginAt: new Date('2024-01-03T00:00:00.000Z'),
        osName: 'Windows',
        osVersion: null,
        updatedAt: new Date('2024-01-03T00:00:00.000Z'),
        userId: 'user-1',
      },
    ]);

    await expect(service.getProfileDevices('user-1', 'device-1')).resolves.toEqual({
      currentDevice: {
        appVersion: '0.2.0',
        firstSeenAt: '2024-01-01T00:00:00.000Z',
        isCurrent: true,
        label: 'macOS 14.0',
        lastLoginAt: '2024-01-04T00:00:00.000Z',
        osName: 'macOS',
        osVersion: '14.0',
      },
      devices: [
        {
          appVersion: '0.2.0',
          firstSeenAt: '2024-01-01T00:00:00.000Z',
          isCurrent: true,
          label: 'macOS 14.0',
          lastLoginAt: '2024-01-04T00:00:00.000Z',
          osName: 'macOS',
          osVersion: '14.0',
        },
        {
          appVersion: null,
          firstSeenAt: '2024-01-01T00:00:00.000Z',
          isCurrent: false,
          label: 'Windows',
          lastLoginAt: '2024-01-03T00:00:00.000Z',
          osName: 'Windows',
          osVersion: null,
        },
      ],
      lastActiveDevice: {
        appVersion: null,
        firstSeenAt: '2024-01-01T00:00:00.000Z',
        isCurrent: false,
        label: 'Windows',
        lastLoginAt: '2024-01-03T00:00:00.000Z',
        osName: 'Windows',
        osVersion: null,
      },
    });

    profileRepository.listUserDevices.mockResolvedValueOnce([
      {
        appVersion: '0.2.0',
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        deviceId: 'device-1',
        firstSeenAt: new Date('2024-01-01T00:00:00.000Z'),
        id: 'row-1',
        lastLoginAt: new Date('2024-01-04T00:00:00.000Z'),
        osName: 'macOS',
        osVersion: '14.0',
        updatedAt: new Date('2024-01-04T00:00:00.000Z'),
        userId: 'user-1',
      },
    ]);

    await expect(service.getProfileDevices('user-1')).resolves.toEqual({
      currentDevice: {
        appVersion: '0.2.0',
        firstSeenAt: '2024-01-01T00:00:00.000Z',
        isCurrent: false,
        label: 'macOS 14.0',
        lastLoginAt: '2024-01-04T00:00:00.000Z',
        osName: 'macOS',
        osVersion: '14.0',
      },
      devices: [
        {
          appVersion: '0.2.0',
          firstSeenAt: '2024-01-01T00:00:00.000Z',
          isCurrent: false,
          label: 'macOS 14.0',
          lastLoginAt: '2024-01-04T00:00:00.000Z',
          osName: 'macOS',
          osVersion: '14.0',
        },
      ],
      lastActiveDevice: {
        appVersion: '0.2.0',
        firstSeenAt: '2024-01-01T00:00:00.000Z',
        isCurrent: false,
        label: 'macOS 14.0',
        lastLoginAt: '2024-01-04T00:00:00.000Z',
        osName: 'macOS',
        osVersion: '14.0',
      },
    });

    profileRepository.listUserDevices.mockResolvedValueOnce([]);
    await expect(service.getProfileDevices('user-1', 'missing')).resolves.toEqual({
      currentDevice: null,
      devices: [],
      lastActiveDevice: null,
    });
  });
});
