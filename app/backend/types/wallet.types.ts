import type {
  WalletCurrencyType,
  WalletTransactionDirection,
  WalletTransactionReason,
} from '../../shared/contracts/wallet.contract';

export interface WalletRecord {
  id: string;
  userId: string;
  shards: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionRecord {
  id: string;
  userId: string;
  currencyType: WalletCurrencyType;
  amount: number;
  direction: WalletTransactionDirection;
  reason: WalletTransactionReason;
  metadataJson: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ApplyWalletTransactionInput {
  amount: number;
  direction: WalletTransactionDirection;
  reason: WalletTransactionReason;
  metadataJson?: Record<string, unknown> | null;
}
