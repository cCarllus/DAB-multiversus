import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../../db/postgres';
import type { CreateUserInput, UserRecord } from './users.types';

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UsersRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async findById(userId: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, username, password_hash, created_at, updated_at
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
      `SELECT id, email, username, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByUsername(username: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, username, password_hash, created_at, updated_at
       FROM users
       WHERE username = $1
       LIMIT 1`,
      [username],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async findByIdentifier(identifier: string, client?: DatabaseClient): Promise<UserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `SELECT id, email, username, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1 OR username = $1
       LIMIT 1`,
      [identifier],
    );

    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  }

  async create(input: CreateUserInput, client?: DatabaseClient): Promise<UserRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<UserRow>(
      `INSERT INTO users (id, email, username, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, username, password_hash, created_at, updated_at`,
      [randomUUID(), input.email, input.username, input.passwordHash],
    );

    const createdUser = result.rows[0];

    if (!createdUser) {
      throw new Error('User creation did not return a database row.');
    }

    return mapUserRow(createdUser);
  }
}
