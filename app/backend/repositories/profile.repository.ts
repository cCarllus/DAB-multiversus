import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type { RecordUserDeviceInput, UserDeviceRecord } from '../types/profile.types';

interface UserDeviceRow {
  id: string;
  user_id: string;
  device_id: string;
  os_name: string;
  os_version: string | null;
  app_version: string | null;
  first_seen_at: Date;
  last_login_at: Date;
  created_at: Date;
  updated_at: Date;
}

function mapUserDeviceRow(row: UserDeviceRow): UserDeviceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    osName: row.os_name,
    osVersion: row.os_version,
    appVersion: row.app_version,
    firstSeenAt: row.first_seen_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProfileRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async upsertUserDevice(
    userId: string,
    input: RecordUserDeviceInput,
    client?: DatabaseClient,
  ): Promise<UserDeviceRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<UserDeviceRow>(
      `INSERT INTO user_devices (
         id,
         user_id,
         device_id,
         os_name,
         os_version,
         app_version,
         first_seen_at,
         last_login_at,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW(), NOW())
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET
         os_name = EXCLUDED.os_name,
         os_version = EXCLUDED.os_version,
         app_version = EXCLUDED.app_version,
         last_login_at = NOW(),
         updated_at = NOW()
       RETURNING
         id,
         user_id,
         device_id,
         os_name,
         os_version,
         app_version,
         first_seen_at,
         last_login_at,
         created_at,
         updated_at`,
      [
        randomUUID(),
        userId,
        input.deviceId,
        input.osName,
        input.osVersion ?? null,
        input.appVersion ?? null,
      ],
    );

    const savedDevice = result.rows[0];

    if (!savedDevice) {
      throw new Error('Device tracking did not return a database row.');
    }

    return mapUserDeviceRow(savedDevice);
  }

  async listUserDevices(userId: string, client?: DatabaseClient): Promise<UserDeviceRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<UserDeviceRow>(
      `SELECT
         id,
         user_id,
         device_id,
         os_name,
         os_version,
         app_version,
         first_seen_at,
         last_login_at,
         created_at,
         updated_at
       FROM user_devices
       WHERE user_id = $1
       ORDER BY last_login_at DESC, created_at DESC`,
      [userId],
    );

    return result.rows.map(mapUserDeviceRow);
  }
}
