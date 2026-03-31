import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../../db/postgres';
import { AppError } from '../../shared/errors/AppError';
import type { AuthSessionRecord } from './auth.types';

interface AuthSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  remember_device: boolean;
  device_name: string | null;
  app_agent: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CreateAuthSessionInput {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  rememberDevice: boolean;
  deviceName: string | null;
  appAgent: string | null;
}

interface RotateSessionInput {
  refreshTokenHash: string;
  deviceName?: string;
  appAgent?: string;
}

function mapAuthSessionRow(row: AuthSessionRow): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    rememberDevice: row.remember_device,
    deviceName: row.device_name,
    appAgent: row.app_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AuthRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async createSession(input: CreateAuthSessionInput, client?: DatabaseClient): Promise<AuthSessionRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<AuthSessionRow>(
      `INSERT INTO auth_sessions (
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, NOW(), NOW())
       RETURNING
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at`,
      [
        randomUUID(),
        input.userId,
        input.refreshTokenHash,
        input.expiresAt,
        input.rememberDevice,
        input.deviceName,
        input.appAgent,
      ],
    );

    const createdSession = result.rows[0];

    if (!createdSession) {
      throw new Error('Session creation did not return a database row.');
    }

    return mapAuthSessionRow(createdSession);
  }

  async findById(
    sessionId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<AuthSessionRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<AuthSessionRow>(
      `SELECT
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at
       FROM auth_sessions
       WHERE id = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [sessionId],
    );

    return result.rows[0] ? mapAuthSessionRow(result.rows[0]) : null;
  }

  async findByRefreshTokenHash(
    refreshTokenHash: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<AuthSessionRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<AuthSessionRow>(
      `SELECT
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at
       FROM auth_sessions
       WHERE refresh_token_hash = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [refreshTokenHash],
    );

    return result.rows[0] ? mapAuthSessionRow(result.rows[0]) : null;
  }

  async rotateSession(
    sessionId: string,
    input: RotateSessionInput,
    client?: DatabaseClient,
  ): Promise<AuthSessionRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<AuthSessionRow>(
      `UPDATE auth_sessions
       SET
         refresh_token_hash = $2,
         device_name = COALESCE($3, device_name),
         app_agent = COALESCE($4, app_agent),
         updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at`,
      [sessionId, input.refreshTokenHash, input.deviceName ?? null, input.appAgent ?? null],
    );

    if (!result.rows[0]) {
      throw new AppError(404, 'SESSION_NOT_FOUND', 'Session could not be found.');
    }

    return mapAuthSessionRow(result.rows[0]);
  }

  async revokeSessionById(sessionId: string, client?: DatabaseClient): Promise<AuthSessionRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<AuthSessionRow>(
      `UPDATE auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         user_id,
         refresh_token_hash,
         expires_at,
         revoked_at,
         remember_device,
         device_name,
         app_agent,
         created_at,
         updated_at`,
      [sessionId],
    );

    return result.rows[0] ? mapAuthSessionRow(result.rows[0]) : null;
  }
}
