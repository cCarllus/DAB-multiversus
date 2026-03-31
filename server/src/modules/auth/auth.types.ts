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
  username: string | null;
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
  username?: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
  rememberDevice: boolean;
  deviceName?: string;
  appAgent?: string;
}

export interface RefreshInput {
  refreshToken: string;
  deviceName?: string;
  appAgent?: string;
}

export interface LogoutInput {
  refreshToken?: string;
  sessionId?: string;
  userId?: string;
}

export const registerRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/)
    .optional(),
});

export const loginRequestSchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  password: z.string().min(8).max(128),
  rememberDevice: z.boolean().default(false),
  deviceName: z.string().trim().min(2).max(120).optional(),
  appAgent: z.string().trim().min(2).max(255).optional(),
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string().trim().min(32).max(512),
  deviceName: z.string().trim().min(2).max(120).optional(),
  appAgent: z.string().trim().min(2).max(255).optional(),
});

export const logoutRequestSchema = z.object({
  refreshToken: z.string().trim().min(32).max(512).optional(),
  sessionId: z.string().uuid().optional(),
});
