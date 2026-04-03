import { z } from 'zod';

export const walletTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const notificationIdParamsSchema = z.object({
  notificationId: z.string().uuid(),
});

export const chatHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
