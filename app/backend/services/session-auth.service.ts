import { AppError } from '../lib/app-error';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';

export interface AuthenticatedSessionIdentity {
  email: string;
  nickname: string;
  sessionId: string;
  userId: string;
}

export class SessionAuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  async authenticateAccessToken(accessToken: string): Promise<AuthenticatedSessionIdentity> {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    const session = await this.authRepository.findById(payload.sid);

    if (!session) {
      throw new AppError(401, 'UNAUTHORIZED', 'Session is invalid.');
    }

    if (session.userId !== payload.sub) {
      throw new AppError(401, 'UNAUTHORIZED', 'Access token does not match the current session.');
    }

    if (session.revokedAt) {
      throw new AppError(401, 'SESSION_REVOKED', 'This session has been revoked.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(401, 'SESSION_EXPIRED', 'This session has expired.');
    }

    return {
      email: payload.email,
      nickname: payload.nickname,
      sessionId: payload.sid,
      userId: payload.sub,
    };
  }
}
