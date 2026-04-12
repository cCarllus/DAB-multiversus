import { Client as ColyseusClient, type Room as ColyseusRoom } from '@colyseus/sdk';

import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';
import {
  SOCIAL_PRESENCE_CHANGED_MESSAGE,
  SOCIAL_PRESENCE_ROOM_NAME,
  SOCIAL_PRESENCE_SNAPSHOT_MESSAGE,
  SOCIAL_PRESENCE_UPDATE_MESSAGE,
  type SocialLivePresenceEntry,
  type SocialLivePresenceSnapshot,
} from '@shared/contracts/social.contract';
import type { PresencePayload } from './social-types';

type SocialPresenceRealtimeEvent =
  | {
      type: 'connected';
    }
  | {
      type: 'disconnected';
    }
  | {
      entry: SocialLivePresenceEntry;
      type: 'presence';
    }
  | {
      entries: SocialLivePresenceEntry[];
      type: 'snapshot';
    };

export class SocialPresenceRealtimeService {
  private readonly listeners = new Set<(event: SocialPresenceRealtimeEvent) => void>();

  private client: ColyseusClient | null = null;

  private connectPromise: Promise<boolean> | null = null;

  private lastConnectionFailureAt = 0;

  private room: ColyseusRoom | null = null;

  constructor(private readonly endpoint = resolveApiBaseUrl()) {}

  subscribe(listener: (event: SocialPresenceRealtimeEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  isConnected(): boolean {
    return Boolean(this.room);
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

  async updatePresence(payload: PresencePayload): Promise<void> {
    if (!this.room) {
      throw new Error('Presence room is not connected.');
    }

    this.room.send(SOCIAL_PRESENCE_UPDATE_MESSAGE, payload);
  }

  private async connectInternal(accessToken: string): Promise<boolean> {
    try {
      if (!this.client) {
        this.client = new ColyseusClient(this.endpoint);
      }

      this.client.http.authToken = accessToken;
      const room = await this.client.joinOrCreate(SOCIAL_PRESENCE_ROOM_NAME);

      room.onMessage<SocialLivePresenceSnapshot>(
        SOCIAL_PRESENCE_SNAPSHOT_MESSAGE,
        (payload) => {
          this.emit({
            entries: payload.entries,
            type: 'snapshot',
          });
        },
      );
      room.onMessage<SocialLivePresenceEntry>(SOCIAL_PRESENCE_CHANGED_MESSAGE, (entry) => {
        this.emit({
          entry,
          type: 'presence',
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

  private emit(event: SocialPresenceRealtimeEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
