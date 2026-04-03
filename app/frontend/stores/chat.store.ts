import { AppApiError } from '@frontend/services/api/api-error';
import type { AuthService } from '@frontend/services/auth/auth-service';
import { ChatApiClient } from '@frontend/services/chat/chat-api-client';
import { ChatRealtimeService } from '@frontend/services/chat/chat-realtime.service';
import type {
  ChatSnapshot,
  GlobalChatMessage,
} from '@frontend/services/chat/chat-types';

interface ChatStoreOptions {
  apiClient?: ChatApiClient;
  authService: AuthService;
  realtimeService?: ChatRealtimeService;
}

const MAX_CHAT_MESSAGES = 80;

export class ChatStore {
  private readonly apiClient: ChatApiClient;

  private readonly listeners = new Set<() => void>();

  private readonly realtimeService: ChatRealtimeService;

  private snapshot: ChatSnapshot = {
    connectedUsers: 0,
    isConnected: false,
    isLoading: false,
    lastError: null,
    messages: [],
  };

  constructor(private readonly options: ChatStoreOptions) {
    this.apiClient = options.apiClient ?? new ChatApiClient();
    this.realtimeService = options.realtimeService ?? new ChatRealtimeService();
    this.realtimeService.subscribe((event) => {
      if (event.type === 'connected') {
        this.snapshot = {
          ...this.snapshot,
          isConnected: true,
          lastError: null,
        };
        this.notify();
        return;
      }

      if (event.type === 'disconnected') {
        this.snapshot = {
          ...this.snapshot,
          isConnected: false,
        };
        this.notify();
        return;
      }

      if (event.type === 'presence') {
        this.snapshot = {
          ...this.snapshot,
          connectedUsers: event.presence.connectedUsers,
        };
        this.notify();
        return;
      }

      if (event.type === 'error') {
        this.snapshot = {
          ...this.snapshot,
          lastError: event.message,
        };
        this.notify();
        return;
      }

      if (event.type === 'message') {
        this.snapshot = {
          ...this.snapshot,
          lastError: null,
          messages: this.upsertMessage(event.message),
        };
        this.notify();
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): ChatSnapshot {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = {
      connectedUsers: 0,
      isConnected: false,
      isLoading: false,
      lastError: null,
      messages: [],
    };
    this.notify();
  }

  async load(force = false): Promise<ChatSnapshot> {
    const accessToken = await this.requireAccessToken();
    void this.realtimeService.connect(accessToken);

    if (!force && this.snapshot.messages.length > 0) {
      return this.snapshot;
    }

    this.snapshot = {
      ...this.snapshot,
      isLoading: true,
      lastError: null,
    };
    this.notify();

    try {
      const response = await this.apiClient.getGlobalHistory(accessToken);

      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
        messages: response.messages.map((message) => this.normalizeMessage(message)),
      };
      this.notify();

      return this.snapshot;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
        lastError: error instanceof Error ? error.message : 'Global chat is unavailable.',
      };
      this.notify();
      throw error;
    }
  }

  async connectRealtime(): Promise<boolean> {
    const accessToken = await this.requireAccessToken();
    return this.realtimeService.connect(accessToken);
  }

  async sendMessage(content: string): Promise<void> {
    const accessToken = await this.requireAccessToken();
    const isConnected = await this.realtimeService.connect(accessToken);

    if (!isConnected) {
      throw new AppApiError('BACKEND_UNAVAILABLE', 'Global chat is unavailable right now.');
    }

    this.realtimeService.sendMessage(content);
  }

  async disconnectRealtime(): Promise<void> {
    await this.realtimeService.disconnect();
    this.snapshot = {
      ...this.snapshot,
      isConnected: false,
    };
    this.notify();
  }

  private normalizeMessage(message: GlobalChatMessage): GlobalChatMessage {
    return {
      ...message,
      sender: {
        ...message.sender,
        avatarUrl: this.apiClient.resolveAssetUrl(message.sender.avatarUrl),
      },
    };
  }

  private upsertMessage(message: GlobalChatMessage): GlobalChatMessage[] {
    const normalizedMessage = this.normalizeMessage(message);
    const nextMessages = [
      ...this.snapshot.messages.filter((entry) => entry.id !== normalizedMessage.id),
      normalizedMessage,
    ];

    return nextMessages.slice(Math.max(0, nextMessages.length - MAX_CHAT_MESSAGES));
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
