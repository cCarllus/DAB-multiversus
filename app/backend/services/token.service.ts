import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../../../config/env/backend-env';
import { AppError } from '../lib/app-error';
import type { AccessTokenPayload } from '../types/auth.types';

const TOKEN_ISSUER = 'dead-as-battle-auth';
const TOKEN_AUDIENCE = 'dead-as-battle-launcher';

interface AccessTokenInput {
  userId: string;
  sessionId: string;
  email: string;
  nickname: string;
}

export class TokenService {
  private readonly accessTokenTtlSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;

  generateAccessToken(input: AccessTokenInput): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + this.accessTokenTtlSeconds * 1000);
    const token = jwt.sign(
      {
        sub: input.userId,
        sid: input.sessionId,
        email: input.email,
        nickname: input.nickname,
        type: 'access',
      },
      env.ACCESS_TOKEN_SECRET,
      {
        algorithm: 'HS256',
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );

    return {
      token,
      expiresAt,
    };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
        algorithms: ['HS256'],
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      }) as jwt.JwtPayload & {
        sid?: string;
        email?: string;
        nickname?: string;
        type?: string;
        sub?: string;
      };

      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.sid ||
        !payload.email ||
        !payload.nickname
      ) {
        throw new AppError(401, 'UNAUTHORIZED', 'Access token is invalid.');
      }

      return {
        sub: payload.sub,
        sid: payload.sid,
        email: payload.email,
        nickname: payload.nickname,
        type: 'access',
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'ACCESS_TOKEN_EXPIRED', 'Access token expired.');
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(401, 'UNAUTHORIZED', 'Access token is invalid.');
    }
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
