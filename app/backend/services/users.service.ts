import type { DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { UsersRepository } from '../repositories/users.repository';
import type { PublicUser, UserRecord } from '../types/users.types';

export interface RegisterUserInput {
  email: string;
  name?: string;
  nickname: string;
  passwordHash: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeName(name: string | undefined, nickname: string): string {
  const normalizedName = name ? normalizeWhitespace(name) : '';
  return normalizedName || nickname;
}

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(input: RegisterUserInput, client?: DatabaseClient): Promise<UserRecord> {
    const email = normalizeEmail(input.email);
    const nickname = normalizeNickname(input.nickname);
    const name = normalizeName(input.name, nickname);

    if (await this.usersRepository.findByEmail(email, client)) {
      throw new AppError(409, 'EMAIL_ALREADY_IN_USE', 'An account with this email already exists.');
    }

    if (await this.usersRepository.findByNickname(nickname, client)) {
      throw new AppError(409, 'NICKNAME_ALREADY_IN_USE', 'This nickname is already in use.');
    }

    return this.usersRepository.create(
      {
        email,
        name,
        nickname,
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
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateName(userId: string, name: string, client?: DatabaseClient): Promise<UserRecord> {
    const normalizedName = normalizeWhitespace(name);

    if (!normalizedName) {
      throw new AppError(400, 'INVALID_NAME', 'Display name is required.');
    }

    await this.requireUserById(userId, client);
    return this.usersRepository.updateProfile(
      userId,
      {
        name: normalizedName,
      },
      client,
    );
  }

  async updateProfileImage(
    userId: string,
    profileImageUrl: string,
    client?: DatabaseClient,
  ): Promise<UserRecord> {
    await this.requireUserById(userId, client);
    return this.usersRepository.updateProfile(
      userId,
      {
        profileImageUrl,
      },
      client,
    );
  }
}
