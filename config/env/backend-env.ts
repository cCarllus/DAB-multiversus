import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters long.'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(15),
  REMEMBER_SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  SESSION_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  ALLOWED_ORIGINS: z.string().optional(),
});

const parsedEnvironment = envSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

export const env = {
  ...parsedEnvironment.data,
  allowedOrigins: parsedEnvironment.data.ALLOWED_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [],
};
