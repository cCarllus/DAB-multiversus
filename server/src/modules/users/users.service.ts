import type { DatabaseClient } from '../../db/postgres';
import { AppError } from '../../shared/errors/AppError';
import type { UserRecord, PublicUser } from './users.types';
import { UsersRepository } from './users.repository';

export interface RegisterUserInput {
  email: string;
  username?: string;
  passwordHash: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username?: string | null): string | null {
  const normalizedUsername = username?.trim().toLowerCase();
  return normalizedUsername ? normalizedUsername : null;
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(input: RegisterUserInput, client?: DatabaseClient): Promise<UserRecord> {
    const email = normalizeEmail(input.email);
    const username = normalizeUsername(input.username);

    if (await this.usersRepository.findByEmail(email, client)) {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'An account with this email already exists.');
    }

    if (username && (await this.usersRepository.findByUsername(username, client))) {
      throw new AppError(409, 'USERNAME_ALREADY_IN_USE', 'This username is already in use.');
    }

    return this.usersRepository.create(
      {
        email,
        username,
        passwordHash: input.passwordHash,
      },
      client,
    );
  }

  async findByIdentifier(identifier: string, client?: DatabaseClient): Promise<UserRecord | null> {
    return this.usersRepository.findByIdentifier(identifier.trim().toLowerCase(), client);
  }

  async findById(userId: string, client?: DatabaseClient): Promise<UserRecord | null> {
    return this.usersRepository.findById(userId, client);
  }

  async requireUserById(userId: string, client?: DatabaseClient): Promise<UserRecord> {
    const user = await this.findById(userId, client);

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User account could not be found.');
    }

    return user;
  }

  toPublicUser(user: UserRecord): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
