import type { DatabaseClient } from '../lib/postgres';
import { DeckService } from './deck.service';
import { CharactersService } from './characters.service';
import { ProgressionService } from './progression.service';
import { NotificationsService } from './notifications.service';
import { WalletService } from './wallet.service';

export class PlayerAccountBootstrapService {
  constructor(
    private readonly progressionService: ProgressionService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly charactersService?: CharactersService,
    private readonly deckService?: DeckService,
  ) {}

  async initializeNewAccount(userId: string, client: DatabaseClient): Promise<void> {
    await this.progressionService.ensureProgression(userId, client);
    await this.walletService.ensureWallet(userId, client);
    await this.charactersService?.ensureCatalogSeeded(client);
    await this.charactersService?.ensureDefaultUnlockedCharacters(userId, client);
    await this.deckService?.ensureActiveDeck(userId, client);
    await this.notificationsService.createNotification(
      userId,
      {
        category: 'account',
        message: 'Your account is ready. Global chat, shards, progression, and loadouts are now live.',
        metadataJson: {
          shardsGranted: 500,
          defaultDeckReady: true,
          welcome: true,
        },
        title: 'Welcome to Dead As Battle',
        type: 'success',
      },
      client,
    );
  }
}
