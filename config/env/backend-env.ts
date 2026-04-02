import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_DB: z.string().min(1).optional(),
  POSTGRES_HOST: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),
  POSTGRES_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters long.'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(15),
  REMEMBER_SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  SESSION_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  ALLOWED_ORIGINS: z.string().optional(),
});

function buildDatabaseUrl(environment: z.infer<typeof rawEnvSchema>): string | null {
  if (environment.DATABASE_URL) {
    return environment.DATABASE_URL;
  }

  if (!environment.POSTGRES_DB || !environment.POSTGRES_USER || !environment.POSTGRES_PASSWORD) {
    return null;
  }

  const host = environment.POSTGRES_HOST ?? '127.0.0.1';
  const port = environment.POSTGRES_PORT ?? 5432;
  const user = encodeURIComponent(environment.POSTGRES_USER);
  const password = encodeURIComponent(environment.POSTGRES_PASSWORD);
  const database = encodeURIComponent(environment.POSTGRES_DB);

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

const parsedEnvironment = rawEnvSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid server environment configuration:\n${issues}`);
}

const databaseUrl = buildDatabaseUrl(parsedEnvironment.data);

if (!databaseUrl) {
  throw new Error(
    'Invalid server environment configuration:\nDATABASE_URL: Required\nPOSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD can be used as a fallback in local development.',
  );
}

export const env = {
  ...parsedEnvironment.data,
  DATABASE_URL: databaseUrl,
  allowedOrigins: parsedEnvironment.data.ALLOWED_ORIGINS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [],
};
