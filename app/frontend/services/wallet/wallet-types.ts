import type {
  PlayerWallet,
  WalletTransaction,
} from '@shared/contracts/wallet.contract';

export type { PlayerWallet, WalletTransaction };

export interface WalletSnapshot {
  transactions: WalletTransaction[];
  transactionsTotal: number;
  wallet: PlayerWallet | null;
}
