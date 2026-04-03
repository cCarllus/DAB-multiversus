import type {
  PlayerWallet,
  PlayerWalletResponse,
  WalletTransaction,
  WalletTransactionsResponse,
} from '../../shared/contracts/wallet.contract';
import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { WalletRepository } from '../repositories/wallet.repository';
import type {
  ApplyWalletTransactionInput,
  WalletRecord,
  WalletTransactionRecord,
} from '../types/wallet.types';

export const STARTER_SHARDS_AMOUNT = 500;

export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async getWallet(userId: string): Promise<PlayerWalletResponse> {
    return withTransaction(async (client) => ({
      wallet: this.toPlayerWallet(await this.ensureWalletRecord(userId, client)),
    }));
  }

  async getTransactions(userId: string, limit: number): Promise<WalletTransactionsResponse> {
    return withTransaction(async (client) => {
      await this.ensureWalletRecord(userId, client);
      const [transactions, total] = await Promise.all([
        this.walletRepository.listTransactions(userId, limit, client),
        this.walletRepository.countTransactions(userId, client),
      ]);

      return {
        total,
        transactions: transactions.map((transaction) => this.toWalletTransaction(transaction)),
      };
    });
  }

  async ensureWallet(userId: string, client: DatabaseClient): Promise<WalletRecord> {
    return this.ensureWalletRecord(userId, client);
  }

  async applyShardTransaction(
    userId: string,
    input: ApplyWalletTransactionInput,
  ): Promise<{ transaction: WalletTransaction; wallet: PlayerWallet }> {
    return withTransaction(async (client) => {
      return this.applyShardTransactionInTransaction(userId, input, client);
    });
  }

  async applyShardTransactionInTransaction(
    userId: string,
    input: ApplyWalletTransactionInput,
    client: DatabaseClient,
  ): Promise<{ transaction: WalletTransaction; wallet: PlayerWallet }> {
    const existingWallet = await this.ensureWalletRecord(userId, client);
    const signedAmount = input.direction === 'credit' ? input.amount : input.amount * -1;
    const nextBalance = existingWallet.shards + signedAmount;

    if (nextBalance < 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_SHARDS',
        'You do not have enough shards for this transaction.',
      );
    }

    const updatedWallet = await this.walletRepository.updateShards(userId, nextBalance, client);
    const transaction = await this.walletRepository.createTransaction(
      {
        amount: input.amount,
        currencyType: 'shards',
        direction: input.direction,
        metadataJson: input.metadataJson,
        reason: input.reason,
        userId,
      },
      client,
    );

    return {
      transaction: this.toWalletTransaction(transaction),
      wallet: this.toPlayerWallet(updatedWallet),
    };
  }

  private async ensureWalletRecord(userId: string, client: DatabaseClient): Promise<WalletRecord> {
    const existing = await this.walletRepository.findByUserId(userId, client, {
      forUpdate: true,
    });

    if (existing) {
      return existing;
    }

    const createdWallet = await this.walletRepository.createDefault(userId, client);

    if (createdWallet.created) {
      await this.walletRepository.createTransaction(
        {
          amount: STARTER_SHARDS_AMOUNT,
          currencyType: 'shards',
          direction: 'credit',
          metadataJson: {
            source: 'account_creation',
          },
          reason: 'starter_bonus',
          userId,
        },
        client,
      );
    }

    return createdWallet.wallet;
  }

  private toPlayerWallet(record: WalletRecord): PlayerWallet {
    return {
      shards: record.shards,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toWalletTransaction(record: WalletTransactionRecord): WalletTransaction {
    return {
      id: record.id,
      currencyType: record.currencyType,
      amount: record.amount,
      direction: record.direction,
      reason: record.reason,
      metadataJson: record.metadataJson,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
