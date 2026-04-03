import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type {
  PlayerWalletResponse,
  WalletTransactionsResponse,
} from '@shared/contracts/wallet.contract';

const WALLET_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_WALLET_ERROR',
  failureMessage: 'Wallet request failed.',
  networkMessage: 'The launcher could not reach the wallet service.',
} as const;

export class WalletApiClient extends BackendApiClient {
  async getMyWallet(accessToken: string) {
    const response = await this.request<PlayerWalletResponse>(
      '/me/wallet',
      {
        accessToken,
        method: 'GET',
      },
      WALLET_REQUEST_MESSAGES,
    );

    return response.wallet;
  }

  async getWalletTransactions(accessToken: string, limit = 50) {
    const search = new URLSearchParams({
      limit: String(limit),
    });
    return this.request<WalletTransactionsResponse>(
      `/me/wallet/transactions?${search.toString()}`,
      {
        accessToken,
        method: 'GET',
      },
      WALLET_REQUEST_MESSAGES,
    );
  }
}
