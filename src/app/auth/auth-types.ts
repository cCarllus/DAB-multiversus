export interface AuthUser {
  email: string;
  name: string;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  sessionExpiresAt: string;
  rememberDevice: boolean;
}

export interface StoredAuthSession {
  user: AuthUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  refreshToken: string;
  sessionExpiresAt: string;
  rememberDevice: boolean;
}

export interface AuthSessionSnapshot {
  accessTokenExpiresAt: string | null;
  rememberDevice: boolean;
  sessionExpiresAt: string;
}

export interface LoginFormValues {
  identifier: string;
  password: string;
  rememberDevice: boolean;
}

type KnownAuthErrorCode =
  | 'ACCESS_TOKEN_EXPIRED'
  | 'AVATAR_REQUIRED'
  | 'AVATAR_TOO_LARGE'
  | 'BACKEND_UNAVAILABLE'
  | 'DATABASE_UNAVAILABLE'
  | 'EMAIL_ALREADY_IN_USE'
  | 'INVALID_AVATAR_TYPE'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_NAME'
  | 'LOGOUT_TARGET_REQUIRED'
  | 'NICKNAME_ALREADY_IN_USE'
  | 'REFRESH_TOKEN_INVALID'
  | 'REMEMBER_DEVICE_UNAVAILABLE'
  | 'REQUEST_INVALID'
  | 'SESSION_EXPIRED'
  | 'SESSION_PERSISTENCE_FAILED'
  | 'SESSION_REVOKED'
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED';

export type AuthErrorCode = KnownAuthErrorCode | (string & {});

export class AuthFlowError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthFlowError';
  }
}

export function resolveAuthDisplayName(user: AuthUser): string {
  const fallbackName = user.email.split('@')[0] ?? user.email;
  return user.name || user.nickname || fallbackName;
}
