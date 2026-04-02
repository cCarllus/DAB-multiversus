import { Pool, type PoolClient } from 'pg';

import { env } from '../../../config/env/backend-env';
import { initializeDatabaseSchema } from '../../../db';

export type DatabaseClient = Pool | PoolClient;

export const dbPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

export async function initializeDatabase(): Promise<void> {
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    await initializeDatabaseSchema(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await dbPool.end();
}
