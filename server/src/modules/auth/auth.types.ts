import { z } from 'zod';

import type { PublicUser } from '../users/users.types';

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

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  sessionExpiresAt: string;
  rememberDevice: boolean;
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

export const registerRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(2).max(40).optional(),
  nickname: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(8).max(128),
});

const deviceMetadataSchema = z.object({
  appAgent: z.string().trim().min(2).max(255).optional(),
  appVersion: z.string().trim().min(1).max(64).optional(),
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().min(2).max(120).optional(),
  osName: z.string().trim().min(2).max(60),
  osVersion: z.string().trim().min(1).max(120).optional(),
});

export const loginRequestSchema = deviceMetadataSchema.extend({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(8).max(128),
  rememberDevice: z.boolean().default(false),
});

export const refreshRequestSchema = deviceMetadataSchema.extend({
  refreshToken: z.string().trim().min(32).max(512),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().trim().min(32).max(512).optional(),
  sessionId: z.string().uuid().optional(),
});
