export type WalletCurrencyType = 'shards';

export type WalletTransactionDirection = 'credit' | 'debit';

export type WalletTransactionReason =
  | 'starter_bonus'
  | 'admin_grant'
  | 'reward_claim'
  | 'social_reward'
  | 'purchase'
  | 'refund'
  | 'event_reward'
  | 'system_reward';

export interface PlayerWallet {
  shards: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  currencyType: WalletCurrencyType;
  amount: number;
  direction: WalletTransactionDirection;
  reason: WalletTransactionReason;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface PlayerWalletResponse {
  wallet: PlayerWallet;
}

export interface WalletTransactionsResponse {
  total: number;
  transactions: WalletTransaction[];
}
