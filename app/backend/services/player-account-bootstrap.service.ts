import type { DatabaseClient } from '../lib/postgres';
import { ProgressionService } from './progression.service';
import { NotificationsService } from './notifications.service';
import { WalletService } from './wallet.service';

export class PlayerAccountBootstrapService {
  constructor(
    private readonly progressionService: ProgressionService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async initializeNewAccount(userId: string, client: DatabaseClient): Promise<void> {
    await this.progressionService.ensureProgression(userId, client);
    await this.walletService.ensureWallet(userId, client);
    await this.notificationsService.createNotification(
      userId,
      {
        category: 'account',
        message: 'Your account is ready. Global chat, shards, and progression are now live.',
        metadataJson: {
          shardsGranted: 500,
          welcome: true,
        },
        title: 'Welcome to Dead As Battle',
        type: 'success',
      },
      client,
    );
  }
}
