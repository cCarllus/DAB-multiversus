import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type { CreateUserInput, UpdateUserProfileInput, UserRecord } from '../types/users.types';

interface UserRow {
  id: string;
  email: string;
  name: string;
  nickname: string;
  password_hash: string;
  profile_image_url: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    passwordHash: row.password_hash,
    profileImageUrl: row.profile_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UsersRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async findById(userId: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByEmail(email: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByNickname(nickname: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at
       FROM users
       WHERE nickname = $1
       LIMIT 1`,
      [nickname],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByIdentifier(identifier: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at
       FROM users
       WHERE email = $1 OR nickname = $1
       LIMIT 1`,
      [identifier],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async create(input: CreateUserInput, client?: DatabaseClient): Promise<UserRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `INSERT INTO users (id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at`,
      [
        randomUUID(),
        input.email,
        input.name,
        input.nickname,
        input.passwordHash,
        input.profileImageUrl ?? null,
      ],
    );

    const createdUser = result.rows[0];

    if (!createdUser) {
      throw new Error('User creation did not return a database row.');
    }

    return mapUserRow(createdUser);
  }

  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput,
    client?: DatabaseClient,
  ): Promise<UserRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `UPDATE users
       SET
         name = COALESCE($2, name),
         profile_image_url = COALESCE($3, profile_image_url),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, nickname, password_hash, profile_image_url, created_at, updated_at`,
      [userId, input.name ?? null, input.profileImageUrl ?? null],
    );

    const updatedUser = result.rows[0];

    if (!updatedUser) {
      throw new Error('Profile update did not return a database row.');
    }

    return mapUserRow(updatedUser);
  }
}
