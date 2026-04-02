import { z } from 'zod';

const nicknameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[a-zA-Z0-9_.-]+$/);

export const socialDirectoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(9999).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(18),
  presence: z.enum(['all', 'online', 'offline']).default('all'),
  q: z.string().trim().max(80).default(''),
  relationship: z.enum(['all', 'friends', 'requests']).default('all'),
});

export const publicProfileParamsSchema = z.object({
  nickname: nicknameSchema,
});

export const friendRequestSchema = z.object({
  nickname: nicknameSchema,
});

export const requestIdParamsSchema = z.object({
  requestId: z.string().uuid(),
});

export const friendshipIdParamsSchema = z.object({
  friendshipId: z.string().uuid(),
});

export const updatePresenceSchema = z.object({
  currentActivity: z.string().trim().max(60).optional(),
  status: z.enum(['online', 'offline', 'in_launcher']),
});
