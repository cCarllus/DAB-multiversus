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

export function resolveAuthDisplayName(user: AuthUser): string {
  const fallbackName = user.email.split('@')[0] ?? user.email;
  return user.name || user.nickname || fallbackName;
}
