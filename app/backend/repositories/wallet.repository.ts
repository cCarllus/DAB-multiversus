import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type {
  WalletRecord,
  WalletTransactionRecord,
} from '../types/wallet.types';
import type {
  WalletCurrencyType,
  WalletTransactionDirection,
  WalletTransactionReason,
} from '../../shared/contracts/wallet.contract';

interface WalletRow {
  id: string;
  user_id: string;
  shards: number;
  created_at: Date;
  updated_at: Date;
}

interface WalletTransactionRow {
  id: string;
  user_id: string;
  currency_type: WalletCurrencyType;
  amount: number;
  direction: WalletTransactionDirection;
  reason: WalletTransactionReason;
  metadata_json: Record<string, unknown> | null;
  created_at: Date;
}

interface CountRow {
  count: string;
}

function mapWalletRow(row: WalletRow): WalletRecord {
  return {
    id: row.id,
    userId: row.user_id,
    shards: row.shards,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWalletTransactionRow(row: WalletTransactionRow): WalletTransactionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    currencyType: row.currency_type,
    amount: row.amount,
    direction: row.direction,
    reason: row.reason,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
  };
}

export class WalletRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async findByUserId(
    userId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<WalletRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<WalletRow>(
      `SELECT id, user_id, shards, created_at, updated_at
       FROM player_wallet
       WHERE user_id = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [userId],
    );

    return result.rows[0] ? mapWalletRow(result.rows[0]) : null;
  }

  async createDefault(
    userId: string,
    client?: DatabaseClient,
  ): Promise<{ created: boolean; wallet: WalletRecord }> {
    const executor = client ?? this.database;
    const result = await executor.query<WalletRow>(
      `INSERT INTO player_wallet (id, user_id, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, user_id, shards, created_at, updated_at`,
      [randomUUID(), userId],
    );

    if (result.rows[0]) {
      return {
        created: true,
        wallet: mapWalletRow(result.rows[0]),
      };
    }

    const existing = await this.findByUserId(userId, client);

    if (!existing) {
      throw new Error('Wallet creation did not return a database row.');
    }

    return {
      created: false,
      wallet: existing,
    };
  }

  async updateShards(userId: string, shards: number, client?: DatabaseClient): Promise<WalletRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<WalletRow>(
      `UPDATE player_wallet
       SET shards = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING id, user_id, shards, created_at, updated_at`,
      [userId, shards],
    );

    if (!result.rows[0]) {
      throw new Error('Wallet update did not return a database row.');
    }

    return mapWalletRow(result.rows[0]);
  }

  async createTransaction(
    input: {
      userId: string;
      currencyType: WalletCurrencyType;
      amount: number;
      direction: WalletTransactionDirection;
      reason: WalletTransactionReason;
      metadataJson?: Record<string, unknown> | null;
    },
    client?: DatabaseClient,
  ): Promise<WalletTransactionRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<WalletTransactionRow>(
      `INSERT INTO wallet_transactions (
         id,
         user_id,
         currency_type,
         amount,
         direction,
         reason,
         metadata_json,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, user_id, currency_type, amount, direction, reason, metadata_json, created_at`,
      [
        randomUUID(),
        input.userId,
        input.currencyType,
        input.amount,
        input.direction,
        input.reason,
        input.metadataJson ?? null,
      ],
    );

    if (!result.rows[0]) {
      throw new Error('Wallet transaction creation did not return a database row.');
    }

    return mapWalletTransactionRow(result.rows[0]);
  }

  async listTransactions(
    userId: string,
    limit: number,
    client?: DatabaseClient,
  ): Promise<WalletTransactionRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<WalletTransactionRow>(
      `SELECT id, user_id, currency_type, amount, direction, reason, metadata_json, created_at
       FROM wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows.map(mapWalletTransactionRow);
  }

  async countTransactions(userId: string, client?: DatabaseClient): Promise<number> {
    const executor = client ?? this.database;
    const result = await executor.query<CountRow>(
      `SELECT COUNT(*) AS count
       FROM wallet_transactions
       WHERE user_id = $1`,
      [userId],
    );

    return Number(result.rows[0]?.count ?? '0');
  }
}
