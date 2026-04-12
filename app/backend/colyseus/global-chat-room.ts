import { Room, type AuthContext, type Client } from '@colyseus/core';

import {
  GLOBAL_CHAT_ERROR_MESSAGE,
  GLOBAL_CHAT_MESSAGE_BROADCAST,
  GLOBAL_CHAT_PRESENCE_MESSAGE,
  GLOBAL_CHAT_ROOM_NAME,
  GLOBAL_CHAT_SEND_MESSAGE,
  type GlobalChatPresence,
} from '../../shared/contracts/chat.contract';
import { AppError } from '../lib/app-error';
import { SessionAuthService, type AuthenticatedSessionIdentity } from '../services/session-auth.service';
import { SocialPresenceSessionService } from '../services/social-presence-session.service';
import { ChatService } from '../services/chat.service';

interface GlobalChatRoomOptions {
  chatService: ChatService;
  presenceSessionService: SocialPresenceSessionService;
  sessionAuthService: SessionAuthService;
}

interface GlobalChatClientData {
  authSessionId: string;
  unregisterSession: () => void;
  userId: string;
}

const MESSAGE_COOLDOWN_MS = 900;
const FLOOD_WINDOW_MS = 10_000;
const FLOOD_LIMIT = 6;

export class GlobalChatRoom extends Room<
  Record<string, never>,
  Record<string, never>,
  GlobalChatClientData,
  AuthenticatedSessionIdentity
> {
  private readonly activeClientsBySessionId = new Map<string, GlobalChatClientData>();

  private readonly messageHistoryByUserId = new Map<string, number[]>();

  private chatService!: ChatService;

  private presenceSessionService!: SocialPresenceSessionService;

  private sessionAuthService!: SessionAuthService;

  onCreate(options: GlobalChatRoomOptions): void {
    this.autoDispose = false;
    this.patchRate = 0;
    this.setState({});

    this.chatService = options.chatService;
    this.presenceSessionService = options.presenceSessionService;
    this.sessionAuthService = options.sessionAuthService;

    this.onMessage(GLOBAL_CHAT_SEND_MESSAGE, async (client, payload) => {
      const userData = client.userData;

      if (!userData) {
        client.send(GLOBAL_CHAT_ERROR_MESSAGE, {
          code: 'UNAUTHORIZED',
          message: 'Global chat requires authentication.',
        });
        return;
      }

      try {
        this.assertCanSendMessage(userData.userId);
        const content =
          payload && typeof payload === 'object' && 'content' in payload
            ? String((payload as { content?: unknown }).content ?? '')
            : '';
        const message = await this.chatService.createGlobalMessage(userData.userId, content);
        this.broadcast(GLOBAL_CHAT_MESSAGE_BROADCAST, message);
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : new AppError(500, 'CHAT_SEND_FAILED', 'The message could not be delivered.');

        client.send(GLOBAL_CHAT_ERROR_MESSAGE, {
          code: appError.code,
          message: appError.message,
        });
      }
    });
  }

  async onAuth(
    _client: Client<GlobalChatClientData, AuthenticatedSessionIdentity>,
    options: { _authToken?: string } | undefined,
    context: AuthContext,
  ): Promise<AuthenticatedSessionIdentity> {
    const accessToken =
      (typeof context.token === 'string' && context.token) ||
      (typeof options?._authToken === 'string' && options._authToken) ||
      null;

    if (!accessToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Global chat connection requires an access token.');
    }

    return this.sessionAuthService.authenticateAccessToken(accessToken);
  }

  async onJoin(
    client: Client<GlobalChatClientData, AuthenticatedSessionIdentity>,
    _options: Record<string, never> | undefined,
    auth: AuthenticatedSessionIdentity,
  ): Promise<void> {
    client.userData = {
      authSessionId: auth.sessionId,
      unregisterSession: this.presenceSessionService.registerSession(auth.sessionId, () => {
        client.leave();
      }),
      userId: auth.userId,
    };

    this.activeClientsBySessionId.set(client.sessionId, client.userData);
    this.broadcastPresence();
  }

  async onLeave(
    client: Client<GlobalChatClientData, AuthenticatedSessionIdentity>,
  ): Promise<void> {
    const userData = client.userData;

    if (!userData) {
      return;
    }

    this.activeClientsBySessionId.delete(client.sessionId);
    userData.unregisterSession();
    this.broadcastPresence();
  }

  private assertCanSendMessage(userId: string): void {
    const now = Date.now();
    const recentMessages = (this.messageHistoryByUserId.get(userId) ?? []).filter(
      (timestamp) => now - timestamp <= FLOOD_WINDOW_MS,
    );
    const lastMessageAt = recentMessages[recentMessages.length - 1] ?? 0;

    if (now - lastMessageAt < MESSAGE_COOLDOWN_MS) {
      throw new AppError(
        429,
        'CHAT_RATE_LIMITED',
        'Slow down for a moment before sending another message.',
      );
    }

    if (recentMessages.length >= FLOOD_LIMIT) {
      throw new AppError(
        429,
        'CHAT_RATE_LIMITED',
        'You are sending messages too quickly.',
      );
    }

    recentMessages.push(now);
    this.messageHistoryByUserId.set(userId, recentMessages);
  }

  private broadcastPresence(): void {
    const connectedUsers = new Set<string>();

    this.activeClientsBySessionId.forEach((client) => {
      connectedUsers.add(client.userId);
    });

    const payload: GlobalChatPresence = {
      connectedUsers: connectedUsers.size,
    };

    this.broadcast(GLOBAL_CHAT_PRESENCE_MESSAGE, payload);
  }
}
