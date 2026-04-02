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
