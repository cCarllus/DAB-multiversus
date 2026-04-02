import type { AuthResponse } from '../../shared/contracts/auth.contract';

export type { AuthResponse };

export interface AuthSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rememberDevice: boolean;
  deviceName: string | null;
  appAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  nickname: string;
  type: 'access';
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  nickname: string;
}

export interface DeviceMetadataInput {
  appAgent?: string;
  appVersion?: string;
  deviceId: string;
  deviceName?: string;
  osName: string;
  osVersion?: string;
}

export interface LoginInput {
  appAgent?: string;
  appVersion?: string;
  deviceId: string;
  deviceName?: string;
  identifier: string;
  osName: string;
  osVersion?: string;
  password: string;
  rememberDevice: boolean;
}

export interface RefreshInput {
  appAgent?: string;
  appVersion?: string;
  deviceId: string;
  deviceName?: string;
  osName: string;
  osVersion?: string;
  refreshToken: string;
}

export interface LogoutInput {
  refreshToken?: string;
  sessionId?: string;
  userId?: string;
}
