import { AppApiError } from '@frontend/services/api/api-error';
import type { AuthService } from '@frontend/services/auth/auth-service';
import { NotificationsApiClient } from '@frontend/services/notifications/notifications-api-client';
import { NotificationsRealtimeService } from '@frontend/services/notifications/notifications-realtime.service';
import type {
  NotificationsSnapshot,
  NotificationsStoreEvent,
} from '@frontend/services/notifications/notifications-types';

interface NotificationsStoreOptions {
  apiClient?: NotificationsApiClient;
  authService: AuthService;
  realtimeService?: NotificationsRealtimeService;
}

const MAX_NOTIFICATION_ITEMS = 50;

export class NotificationsStore {
  private readonly apiClient: NotificationsApiClient;

  private readonly eventListeners = new Set<(event: NotificationsStoreEvent) => void>();

  private readonly listeners = new Set<() => void>();

  private readonly realtimeService: NotificationsRealtimeService;

  private snapshot: NotificationsSnapshot = {
    isConnected: false,
    isLoading: false,
    isOpen: false,
    notifications: [],
    unreadCount: 0,
  };

  constructor(private readonly options: NotificationsStoreOptions) {
    this.apiClient = options.apiClient ?? new NotificationsApiClient();
    this.realtimeService = options.realtimeService ?? new NotificationsRealtimeService();
    this.realtimeService.subscribe((event) => {
      if (event.type === 'connected') {
        this.snapshot = {
          ...this.snapshot,
          isConnected: true,
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

      if (event.type === 'state') {
        this.snapshot = {
          ...this.snapshot,
          unreadCount: event.payload.unreadCount,
        };
        this.notify();
        return;
      }

      if (event.type === 'delivered') {
        this.snapshot = {
          ...this.snapshot,
          notifications: [
            event.payload.notification,
            ...this.snapshot.notifications.filter(
              (notification) => notification.id !== event.payload.notification.id,
            ),
          ].slice(0, MAX_NOTIFICATION_ITEMS),
          unreadCount: event.payload.unreadCount,
        };
        this.notify();
        this.emitEvent({
          notification: event.payload.notification,
          type: 'received',
        });
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeEvents(listener: (event: NotificationsStoreEvent) => void): () => void {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  getSnapshot(): NotificationsSnapshot {
    return this.snapshot;
  }

  reset(): void {
    this.snapshot = {
      isConnected: false,
      isLoading: false,
      isOpen: false,
      notifications: [],
      unreadCount: 0,
    };
    this.notify();
  }

  async load(force = false): Promise<NotificationsSnapshot> {
    const accessToken = await this.requireAccessToken();
    void this.realtimeService.connect(accessToken);

    if (!force && this.snapshot.notifications.length > 0) {
      return this.snapshot;
    }

    this.snapshot = {
      ...this.snapshot,
      isLoading: true,
    };
    this.notify();

    try {
      const [notifications, unreadCount] = await Promise.all([
        this.apiClient.getNotifications(accessToken),
        this.apiClient.getUnreadCount(accessToken),
      ]);

      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
        notifications: notifications.notifications,
        unreadCount: unreadCount.unreadCount,
      };
      this.notify();

      return this.snapshot;
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        isLoading: false,
      };
      this.notify();
      throw error;
    }
  }

  openPanel(): void {
    this.snapshot = {
      ...this.snapshot,
      isOpen: true,
    };
    this.notify();
    void this.load().catch((error) => {
      this.emitEvent({
        message: error instanceof Error ? error.message : 'Notifications are unavailable.',
        type: 'error',
      });
    });
  }

  closePanel(): void {
    if (!this.snapshot.isOpen) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      isOpen: false,
    };
    this.notify();
  }

  togglePanel(): void {
    if (this.snapshot.isOpen) {
      this.closePanel();
      return;
    }

    this.openPanel();
  }

  async markRead(notificationId: string): Promise<void> {
    const accessToken = await this.requireAccessToken();
    const updatedNotification = await this.apiClient.markNotificationRead(accessToken, notificationId);

    this.snapshot = {
      ...this.snapshot,
      notifications: this.snapshot.notifications.map((notification) =>
        notification.id === notificationId ? updatedNotification : notification,
      ),
      unreadCount: Math.max(
        0,
        updatedNotification.isRead
          ? this.snapshot.notifications.some(
              (notification) => notification.id === notificationId && !notification.isRead,
            )
            ? this.snapshot.unreadCount - 1
            : this.snapshot.unreadCount
          : this.snapshot.unreadCount,
      ),
    };
    this.notify();
  }

  async markAllRead(): Promise<void> {
    const accessToken = await this.requireAccessToken();
    const result = await this.apiClient.markAllRead(accessToken);

    this.snapshot = {
      ...this.snapshot,
      notifications: this.snapshot.notifications.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
      unreadCount: result.unreadCount,
    };
    this.notify();
  }

  async disconnectRealtime(): Promise<void> {
    await this.realtimeService.disconnect();
    this.snapshot = {
      ...this.snapshot,
      isConnected: false,
    };
    this.notify();
  }

  private emitEvent(event: NotificationsStoreEvent): void {
    this.eventListeners.forEach((listener) => {
      listener(event);
    });
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
