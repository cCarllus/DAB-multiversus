import { env } from '../../config/env';
import { withTransaction } from '../../db/postgres';
import { AppError } from '../../shared/errors/AppError';
import { UsersService } from '../users/users.service';
import type { UserRecord } from '../users/users.types';
import { AuthRepository } from './auth.repository';
import type {
  AuthResponse,
  AuthSessionRecord,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

interface AuthServiceDependencies {
  authRepository: AuthRepository;
  passwordService: PasswordService;
  tokenService: TokenService;
  usersService: UsersService;
}

interface SessionMetadata {
  rememberDevice: boolean;
  deviceName?: string;
  appAgent?: string;
}

function invalidCredentialsError(): AppError {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Email, username, or password is incorrect.');
}

export class AuthService {
  constructor(private readonly dependencies: AuthServiceDependencies) {}

  async register(input: RegisterInput): Promise<{ user: AuthResponse['user'] }> {
    const passwordHash = await this.dependencies.passwordService.hashPassword(input.password);
    const user = await this.dependencies.usersService.createUser({
      email: input.email,
      username: input.username,
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
      rememberDevice: input.rememberDevice,
      deviceName: input.deviceName,
      appAgent: input.appAgent,
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

      return this.buildAuthResponse(user, rotatedSession, nextRefreshToken);
    });
  }

  async logout(input: LogoutInput): Promise<void> {
    if (input.refreshToken) {
      const session = await this.dependencies.authRepository.findByRefreshTokenHash(
        this.dependencies.tokenService.hashRefreshToken(input.refreshToken),
      );

      if (!session) {
        throw new AppError(401, 'REFRESH_TOKEN_INVALID', 'Refresh token is invalid.');
      }

      if (input.userId && session.userId !== input.userId) {
        throw new AppError(403, 'FORBIDDEN', 'Session does not belong to the authenticated user.');
      }

      if (!session.revokedAt) {
        await this.dependencies.authRepository.revokeSessionById(session.id);
      }

      return;
    }

    if (!input.sessionId || !input.userId) {
      throw new AppError(
        400,
        'LOGOUT_TARGET_REQUIRED',
        'A refresh token or authenticated session is required to log out.',
      );
    }

    const session = await this.dependencies.authRepository.findById(input.sessionId);

    if (!session) {
      return;
    }

    if (session.userId !== input.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Session does not belong to the authenticated user.');
    }

    if (!session.revokedAt) {
      await this.dependencies.authRepository.revokeSessionById(session.id);
    }
  }

  async getCurrentUser(userId: string): Promise<AuthResponse['user']> {
    const user = await this.dependencies.usersService.requireUserById(userId);
    return this.dependencies.usersService.toPublicUser(user);
  }

  private async issueSession(user: UserRecord, metadata: SessionMetadata): Promise<AuthResponse> {
    const refreshToken = this.dependencies.tokenService.generateRefreshToken();
    const session = await this.dependencies.authRepository.createSession({
      userId: user.id,
      refreshTokenHash: this.dependencies.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.resolveSessionExpiry(metadata.rememberDevice),
      rememberDevice: metadata.rememberDevice,
      deviceName: metadata.deviceName ?? null,
      appAgent: metadata.appAgent ?? null,
    });

    return this.buildAuthResponse(user, session, refreshToken);
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
      username: user.username,
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
