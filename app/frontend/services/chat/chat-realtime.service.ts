import { Client as ColyseusClient, type Room as ColyseusRoom } from 'colyseus.js';

import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';
import {
  GLOBAL_CHAT_ERROR_MESSAGE,
  GLOBAL_CHAT_MESSAGE_BROADCAST,
  GLOBAL_CHAT_PRESENCE_MESSAGE,
  GLOBAL_CHAT_ROOM_NAME,
  GLOBAL_CHAT_SEND_MESSAGE,
  type GlobalChatMessage,
  type GlobalChatPresence,
} from '@shared/contracts/chat.contract';

type ChatRealtimeEvent =
  | {
      type: 'connected';
    }
  | {
      type: 'disconnected';
    }
  | {
      message: GlobalChatMessage;
      type: 'message';
    }
  | {
      message: string;
      type: 'error';
    }
  | {
      presence: GlobalChatPresence;
      type: 'presence';
    };

export class ChatRealtimeService {
  private readonly listeners = new Set<(event: ChatRealtimeEvent) => void>();

  private client: ColyseusClient | null = null;

  private connectPromise: Promise<boolean> | null = null;

  private lastConnectionFailureAt = 0;

  private room: ColyseusRoom | null = null;

  constructor(private readonly endpoint = resolveApiBaseUrl()) {}

  subscribe(listener: (event: ChatRealtimeEvent) => void): () => void {
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

  sendMessage(content: string): void {
    if (!this.room) {
      throw new Error('Global chat is not connected.');
    }

    this.room.send(GLOBAL_CHAT_SEND_MESSAGE, {
      content,
    });
  }

  private async connectInternal(accessToken: string): Promise<boolean> {
    try {
      if (!this.client) {
        this.client = new ColyseusClient(this.endpoint);
      }

      this.client.http.authToken = accessToken;
      const room = await this.client.joinOrCreate(GLOBAL_CHAT_ROOM_NAME);

      room.onMessage<GlobalChatMessage>(GLOBAL_CHAT_MESSAGE_BROADCAST, (message) => {
        this.emit({
          message,
          type: 'message',
        });
      });
      room.onMessage<GlobalChatPresence>(GLOBAL_CHAT_PRESENCE_MESSAGE, (presence) => {
        this.emit({
          presence,
          type: 'presence',
        });
      });
      room.onMessage<{ code?: string; message?: string }>(GLOBAL_CHAT_ERROR_MESSAGE, (payload) => {
        this.emit({
          message: payload.message ?? 'Global chat is temporarily unavailable.',
          type: 'error',
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

  private emit(event: ChatRealtimeEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
