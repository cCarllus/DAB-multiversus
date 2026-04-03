import { AppApiError } from '@frontend/services/api/api-error';
import type { AuthService } from '@frontend/services/auth/auth-service';
import { WalletApiClient } from '@frontend/services/wallet/wallet-api-client';
import type { WalletSnapshot } from '@frontend/services/wallet/wallet-types';

interface WalletStoreOptions {
  apiClient?: WalletApiClient;
  authService: AuthService;
}

export class WalletStore {
  private readonly apiClient: WalletApiClient;

  private readonly listeners = new Set<() => void>();

  private snapshot: WalletSnapshot = {
    transactions: [],
    transactionsTotal: 0,
    wallet: null,
  };

  constructor(private readonly options: WalletStoreOptions) {
    this.apiClient = options.apiClient ?? new WalletApiClient();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): WalletSnapshot {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = {
      transactions: [],
      transactionsTotal: 0,
      wallet: null,
    };
    this.notify();
  }

  async load(force = false): Promise<WalletSnapshot> {
    if (!force && this.snapshot.wallet) {
      return this.snapshot;
    }

    const accessToken = await this.requireAccessToken();
    const wallet = await this.apiClient.getMyWallet(accessToken);

    this.snapshot = {
      ...this.snapshot,
      wallet,
    };
    this.notify();

    return this.snapshot;
  }

  async loadTransactions(limit = 50, force = false): Promise<WalletSnapshot> {
    if (!force && this.snapshot.transactions.length > 0) {
      return this.snapshot;
    }

    const accessToken = await this.requireAccessToken();
    const response = await this.apiClient.getWalletTransactions(accessToken, limit);

    this.snapshot = {
      ...this.snapshot,
      transactions: response.transactions,
      transactionsTotal: response.total,
    };
    this.notify();

    return this.snapshot;
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private async requireAccessToken(): Promise<string> {
    const accessToken = await this.options.authService.ensureAccessToken();

    if (!accessToken) {
      throw new AppApiError('UNAUTHENTICATED', 'No active session is available.');
    }

    return accessToken;
  }
}
