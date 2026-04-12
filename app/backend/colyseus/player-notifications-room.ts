import { Room, type AuthContext, type Client } from '@colyseus/core';

import {
  PLAYER_NOTIFICATIONS_DELIVERED_MESSAGE,
  PLAYER_NOTIFICATIONS_STATE_MESSAGE,
} from '../../shared/contracts/notifications.contract';
import { AppError } from '../lib/app-error';
import { NotificationsRealtimeGateway } from '../services/notifications-realtime.gateway';
import { NotificationsService } from '../services/notifications.service';
import { SessionAuthService, type AuthenticatedSessionIdentity } from '../services/session-auth.service';
import { SocialPresenceSessionService } from '../services/social-presence-session.service';

interface PlayerNotificationsRoomOptions {
  notificationsRealtimeGateway: NotificationsRealtimeGateway;
  notificationsService: NotificationsService;
  presenceSessionService: SocialPresenceSessionService;
  sessionAuthService: SessionAuthService;
}

interface PlayerNotificationsClientData {
  authSessionId: string;
  disposeRealtime: () => void;
  unregisterSession: () => void;
  userId: string;
}

export class PlayerNotificationsRoom extends Room<
  Record<string, never>,
  Record<string, never>,
  PlayerNotificationsClientData,
  AuthenticatedSessionIdentity
> {
  private notificationsRealtimeGateway!: NotificationsRealtimeGateway;

  private notificationsService!: NotificationsService;

  private presenceSessionService!: SocialPresenceSessionService;

  private sessionAuthService!: SessionAuthService;

  onCreate(options: PlayerNotificationsRoomOptions): void {
    this.autoDispose = false;
    this.patchRate = 0;
    this.setState({});

    this.notificationsRealtimeGateway = options.notificationsRealtimeGateway;
    this.notificationsService = options.notificationsService;
    this.presenceSessionService = options.presenceSessionService;
    this.sessionAuthService = options.sessionAuthService;
  }

  async onAuth(
    _client: Client<PlayerNotificationsClientData, AuthenticatedSessionIdentity>,
    options: { _authToken?: string } | undefined,
    context: AuthContext,
  ): Promise<AuthenticatedSessionIdentity> {
    const accessToken =
      (typeof context.token === 'string' && context.token) ||
      (typeof options?._authToken === 'string' && options._authToken) ||
      null;

    if (!accessToken) {
      throw new AppError(
        401,
        'UNAUTHORIZED',
        'Notifications connection requires an access token.',
      );
    }

    return this.sessionAuthService.authenticateAccessToken(accessToken);
  }

  async onJoin(
    client: Client<PlayerNotificationsClientData, AuthenticatedSessionIdentity>,
    _options: Record<string, never> | undefined,
    auth: AuthenticatedSessionIdentity,
  ): Promise<void> {
    const disposeRealtime = this.notificationsRealtimeGateway.registerConnection(auth.userId, {
      onDelivered: (payload) => {
        client.send(PLAYER_NOTIFICATIONS_DELIVERED_MESSAGE, payload);
      },
      onState: (payload) => {
        client.send(PLAYER_NOTIFICATIONS_STATE_MESSAGE, payload);
      },
    });

    client.userData = {
      authSessionId: auth.sessionId,
      disposeRealtime,
      unregisterSession: this.presenceSessionService.registerSession(auth.sessionId, () => {
        client.leave();
      }),
      userId: auth.userId,
    };

    const unreadCount = await this.notificationsService.getUnreadCount(auth.userId);
    client.send(PLAYER_NOTIFICATIONS_STATE_MESSAGE, unreadCount);
  }

  async onLeave(
    client: Client<PlayerNotificationsClientData, AuthenticatedSessionIdentity>,
  ): Promise<void> {
    const userData = client.userData;

    if (!userData) {
      return;
    }

    userData.disposeRealtime();
    userData.unregisterSession();
  }
}
