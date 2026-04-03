import { AppApiError } from '@frontend/services/api/api-error';
import type { AuthService } from '@frontend/services/auth/auth-service';
import { ProgressionApiClient } from '@frontend/services/progression/progression-api-client';
import type { PlayerProgression } from '@frontend/services/progression/progression-types';

interface ProgressionStoreOptions {
  apiClient?: ProgressionApiClient;
  authService: AuthService;
}

export class ProgressionStore {
  private readonly apiClient: ProgressionApiClient;

  private readonly listeners = new Set<() => void>();

  private snapshot: PlayerProgression | null = null;

  constructor(private readonly options: ProgressionStoreOptions) {
    this.apiClient = options.apiClient ?? new ProgressionApiClient();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): PlayerProgression | null {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = null;
    this.notify();
  }

  async load(force = false): Promise<PlayerProgression> {
    if (!force && this.snapshot) {
      return this.snapshot;
    }

    const accessToken = await this.requireAccessToken();
    this.snapshot = await this.apiClient.getMyProgression(accessToken);
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
