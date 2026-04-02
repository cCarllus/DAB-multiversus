import { env } from '../../../config/env/backend-env';
import { withTransaction } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { AuthRepository } from '../repositories/auth.repository';
import type { UserRecord } from '../types/users.types';
import type {
  AuthResponse,
  AuthSessionRecord,
  DeviceMetadataInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from '../types/auth.types';
import { PasswordService } from './password.service';
import { ProfileService } from './profile.service';
import { SocialService } from './social.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

interface AuthServiceDependencies {
  authRepository: AuthRepository;
  passwordService: PasswordService;
  profileService: ProfileService;
  socialService: SocialService;
  tokenService: TokenService;
  usersService: UsersService;
}

interface SessionMetadata extends DeviceMetadataInput {
  rememberDevice: boolean;
}

function invalidCredentialsError(): AppError {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Email, nickname, or password is incorrect.');
}

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async register(input: RegisterInput): Promise<{ user: AuthResponse['user'] }> {
    const passwordHash = await this.dependencies.passwordService.hashPassword(input.password);
    const user = await this.dependencies.usersService.createUser({
      email: input.email,
      name: input.name,
      nickname: input.nickname,
      passwordHash,
    });

    return {
      user: this.dependencies.usersService.toPublicUser(user),
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.dependencies.usersService.findByIdentifier(input.identifier);

    if (!user) {
      throw invalidCredentialsError();
    }

    const passwordMatches = await this.dependencies.passwordService.verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw invalidCredentialsError();
    }

    return this.issueSession(user, {
      appAgent: input.appAgent,
      appVersion: input.appVersion,
      deviceId: input.deviceId,
      deviceName: input.deviceName,
      osName: input.osName,
      osVersion: input.osVersion,
      rememberDevice: input.rememberDevice,
    });
  }

  async refresh(input: RefreshInput): Promise<AuthResponse> {
    return withTransaction(async (client) => {
      const refreshTokenHash = this.dependencies.tokenService.hashRefreshToken(input.refreshToken);
      const session = await this.dependencies.authRepository.findByRefreshTokenHash(
        refreshTokenHash,
        client,
        {
          forUpdate: true,
        },
      );

      if (!session) {
        throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid.');
      }

      this.assertSessionIsActive(session);

      const user = await this.dependencies.usersService.requireUserById(session.userId, client);
      const nextRefreshToken = this.dependencies.tokenService.generateRefreshToken();
      const nextRefreshTokenHash = this.dependencies.tokenService.hashRefreshToken(nextRefreshToken);
      const rotatedSession = await this.dependencies.authRepository.rotateSession(
        session.id,
        {
          refreshTokenHash: nextRefreshTokenHash,
          deviceName: input.deviceName ?? session.deviceName ?? undefined,
          appAgent: input.appAgent ?? session.appAgent ?? undefined,
        },
        client,
      );
      await this.dependencies.profileService.recordDeviceAccess(
        user.id,
        {
          appVersion: input.appVersion,
          deviceId: input.deviceId,
          osName: input.osName,
          osVersion: input.osVersion,
        },
        client,
      );
      await this.dependencies.socialService.updatePresence(
        user.id,
        {
          currentActivity: 'In launcher',
          status: 'in_launcher',
        },
        client,
      );

      return this.buildAuthResponse(user, rotatedSession, nextRefreshToken);
    });
  }

  async logout(input: LogoutInput): Promise<void> {
    if (input.refreshToken) {
      const refreshToken = input.refreshToken;

      await withTransaction(async (client) => {
        const session = await this.dependencies.authRepository.findByRefreshTokenHash(
          this.dependencies.tokenService.hashRefreshToken(refreshToken),
          client,
          {
            forUpdate: true,
          },
        );

        if (!session) {
          throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid.');
        }

        if (input.userId && session.userId !== input.userId) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Session does not belong to the authenticated user.',
          );
        }

        if (!session.revokedAt) {
          await this.dependencies.authRepository.revokeSessionById(session.id, client);
        }

        const hasOtherActiveSessions = await this.dependencies.authRepository.hasActiveSessionForUser(
          session.userId,
          client,
        );

        if (!hasOtherActiveSessions) {
          await this.dependencies.socialService.updatePresence(
            session.userId,
            {
              status: 'offline',
            },
            client,
          );
        }
      });
      return;
    }

    if (!input.sessionId || !input.userId) {
      throw new AppError(
        400,
        'LOGOUT_TARGET_REQUIRED',
        'A refresh token or authenticated session is required to log out.',
      );
    }

    const sessionId = input.sessionId;
    await withTransaction(async (client) => {
      const session = await this.dependencies.authRepository.findById(sessionId, client, {
        forUpdate: true,
      });

      if (!session) {
        return;
      }

      if (session.userId !== input.userId) {
        throw new AppError(403, 'FORBIDDEN', 'Session does not belong to the authenticated user.');
      }

      if (!session.revokedAt) {
        await this.dependencies.authRepository.revokeSessionById(session.id, client);
      }

      const hasOtherActiveSessions = await this.dependencies.authRepository.hasActiveSessionForUser(
        session.userId,
        client,
      );

      if (!hasOtherActiveSessions) {
        await this.dependencies.socialService.updatePresence(
          session.userId,
          {
            status: 'offline',
          },
          client,
        );
      }
    });
  }

  async getCurrentUser(userId: string): Promise<AuthResponse['user']> {
    const user = await this.dependencies.usersService.requireUserById(userId);
    return this.dependencies.usersService.toPublicUser(user);
  }

  private async issueSession(user: UserRecord, metadata: SessionMetadata): Promise<AuthResponse> {
    return withTransaction(async (client) => {
      const refreshToken = this.dependencies.tokenService.generateRefreshToken();
      const session = await this.dependencies.authRepository.createSession(
        {
          userId: user.id,
          refreshTokenHash: this.dependencies.tokenService.hashRefreshToken(refreshToken),
          expiresAt: this.resolveSessionExpiry(metadata.rememberDevice),
          rememberDevice: metadata.rememberDevice,
          deviceName: metadata.deviceName ?? null,
          appAgent: metadata.appAgent ?? null,
        },
        client,
      );

      await this.dependencies.profileService.recordDeviceAccess(
        user.id,
        {
          appVersion: metadata.appVersion,
          deviceId: metadata.deviceId,
          osName: metadata.osName,
          osVersion: metadata.osVersion,
        },
        client,
      );
      await this.dependencies.socialService.updatePresence(
        user.id,
        {
          currentActivity: 'In launcher',
          status: 'in_launcher',
        },
        client,
      );

      return this.buildAuthResponse(user, session, refreshToken);
    });
  }

  private buildAuthResponse(
    user: UserRecord,
    session: AuthSessionRecord,
    refreshToken: string,
  ): AuthResponse {
    const accessToken = this.dependencies.tokenService.generateAccessToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      nickname: user.nickname,
    });

    return {
      user: this.dependencies.usersService.toPublicUser(user),
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      refreshToken,
      sessionExpiresAt: session.expiresAt.toISOString(),
      rememberDevice: session.rememberDevice,
    };
  }

  private assertSessionIsActive(session: AuthSessionRecord): void {
    if (session.revokedAt) {
      throw new AppError(401, 'SESSION_REVOKED', 'This session has been revoked.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'SESSION_EXPIRED', 'This session has expired.');
    }
  }

  private resolveSessionExpiry(rememberDevice: boolean): Date {
    const expiresAt = new Date();

    if (rememberDevice) {
      expiresAt.setUTCDate(expiresAt.getUTCDate() + env.REMEMBER_SESSION_DAYS);
      return expiresAt;
    }

    expiresAt.setUTCHours(expiresAt.getUTCHours() + env.SESSION_TOKEN_TTL_HOURS);
    return expiresAt;
  }
}
