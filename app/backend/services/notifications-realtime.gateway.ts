import type {
  NotificationDeliveredPayload,
  NotificationStatePayload,
} from '../../shared/contracts/notifications.contract';

interface NotificationRealtimeListener {
  onDelivered: (payload: NotificationDeliveredPayload) => void;
  onState: (payload: NotificationStatePayload) => void;
}

export class NotificationsRealtimeGateway {
  private readonly listenersByUserId = new Map<string, Set<NotificationRealtimeListener>>();

  registerConnection(userId: string, listener: NotificationRealtimeListener): () => void {
    const listeners = this.listenersByUserId.get(userId) ?? new Set<NotificationRealtimeListener>();
    listeners.add(listener);
    this.listenersByUserId.set(userId, listeners);

    return () => {
      const existingListeners = this.listenersByUserId.get(userId);

      if (!existingListeners) {
        return;
      }

      existingListeners.delete(listener);

      if (existingListeners.size === 0) {
        this.listenersByUserId.delete(userId);
      }
    };
  }

  publishDelivered(userId: string, payload: NotificationDeliveredPayload): void {
    this.listenersByUserId.get(userId)?.forEach((listener) => {
      listener.onDelivered(payload);
    });
  }

  publishState(userId: string, payload: NotificationStatePayload): void {
    this.listenersByUserId.get(userId)?.forEach((listener) => {
      listener.onState(payload);
    });
  }
}
