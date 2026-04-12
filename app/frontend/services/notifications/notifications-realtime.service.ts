import { Client as ColyseusClient, type Room as ColyseusRoom } from '@colyseus/sdk';

import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';
import {
  PLAYER_NOTIFICATIONS_DELIVERED_MESSAGE,
  PLAYER_NOTIFICATIONS_ROOM_NAME,
  PLAYER_NOTIFICATIONS_STATE_MESSAGE,
  type NotificationDeliveredPayload,
  type NotificationStatePayload,
} from '@shared/contracts/notifications.contract';

type NotificationsRealtimeEvent =
  | {
      type: 'connected';
    }
  | {
      type: 'disconnected';
    }
  | {
      payload: NotificationDeliveredPayload;
      type: 'delivered';
    }
  | {
      payload: NotificationStatePayload;
      type: 'state';
    };

export class NotificationsRealtimeService {
  private readonly listeners = new Set<(event: NotificationsRealtimeEvent) => void>();

  private client: ColyseusClient | null = null;

  private connectPromise: Promise<boolean> | null = null;

  private lastConnectionFailureAt = 0;

  private room: ColyseusRoom | null = null;

  constructor(private readonly endpoint = resolveApiBaseUrl()) {}

  subscribe(listener: (event: NotificationsRealtimeEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(accessToken: string): Promise<boolean> {
    if (this.room) {
      return true;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (Date.now() - this.lastConnectionFailureAt < 10_000) {
      return false;
    }

    this.connectPromise = this.connectInternal(accessToken).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async disconnect(): Promise<void> {
    const room = this.room;
    this.room = null;

    if (room) {
      await room.leave(false).catch(() => undefined);
    }

    this.emit({
      type: 'disconnected',
    });
  }

  private async connectInternal(accessToken: string): Promise<boolean> {
    try {
      if (!this.client) {
        this.client = new ColyseusClient(this.endpoint);
      }

      this.client.http.authToken = accessToken;
      const room = await this.client.joinOrCreate(PLAYER_NOTIFICATIONS_ROOM_NAME);

      room.onMessage<NotificationDeliveredPayload>(
        PLAYER_NOTIFICATIONS_DELIVERED_MESSAGE,
        (payload) => {
          this.emit({
            payload,
            type: 'delivered',
          });
        },
      );
      room.onMessage<NotificationStatePayload>(PLAYER_NOTIFICATIONS_STATE_MESSAGE, (payload) => {
        this.emit({
          payload,
          type: 'state',
        });
      });
      room.onLeave(() => {
        if (this.room === room) {
          this.room = null;
          this.emit({
            type: 'disconnected',
          });
        }
      });
      room.onError(() => {
        if (this.room === room) {
          this.room = null;
          this.lastConnectionFailureAt = Date.now();
          this.emit({
            type: 'disconnected',
          });
        }
      });

      this.room = room;
      this.emit({
        type: 'connected',
      });

      return true;
    } catch {
      this.lastConnectionFailureAt = Date.now();
      this.room = null;
      return false;
    }
  }

  private emit(event: NotificationsRealtimeEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
