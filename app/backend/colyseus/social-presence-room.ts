import { Room, type Client, type AuthContext } from '@colyseus/core';

import {
  SOCIAL_PRESENCE_CHANGED_MESSAGE,
  SOCIAL_PRESENCE_SNAPSHOT_MESSAGE,
  SOCIAL_PRESENCE_UPDATE_MESSAGE,
  type SocialLivePresenceEntry,
  type SocialLivePresenceSnapshot,
} from '../../shared/contracts/social.contract';
import type { PresenceStatus } from '../types/social.types';
import { AppError } from '../lib/app-error';
import { updatePresenceSchema } from '../validators/social.validator';
import { SessionAuthService, type AuthenticatedSessionIdentity } from '../services/session-auth.service';
import { SocialPresenceSessionService } from '../services/social-presence-session.service';
import { SocialService } from '../services/social.service';

interface SocialPresenceRoomOptions {
  presenceSessionService: SocialPresenceSessionService;
  sessionAuthService: SessionAuthService;
  socialService: SocialService;
}

interface SocialPresenceClientData {
  authSessionId: string;
  nickname: string;
  unregisterSession: () => void;
  userId: string;
}

interface PresenceConnection {
  currentActivity: string | null;
  nickname: string;
  status: PresenceStatus;
  updatedAt: number;
  userId: string;
}

const PRESENCE_PRIORITY: Record<PresenceStatus, number> = {
  offline: 0,
  online: 1,
  in_launcher: 2,
};

export class SocialPresenceRoom extends Room<
  Record<string, never>,
  Record<string, never>,
  SocialPresenceClientData,
  AuthenticatedSessionIdentity
> {
  private readonly connectionsByUserId = new Map<string, Map<string, PresenceConnection>>();

  private readonly nicknameByUserId = new Map<string, string>();

  private sessionAuthService!: SessionAuthService;

  private presenceSessionService!: SocialPresenceSessionService;

  private socialService!: SocialService;

  onCreate(options: SocialPresenceRoomOptions): void {
    this.autoDispose = false;
    this.patchRate = 0;
    this.setState({});
    void this.setPrivate(true);

    this.sessionAuthService = options.sessionAuthService;
    this.presenceSessionService = options.presenceSessionService;
    this.socialService = options.socialService;

    this.onMessage(SOCIAL_PRESENCE_UPDATE_MESSAGE, async (client, payload) => {
      const userData = client.userData;

      if (!userData) {
        throw new AppError(401, 'UNAUTHORIZED', 'Presence updates require authentication.');
      }

      const nextPresence = updatePresenceSchema.parse(payload);
      const userConnections = this.connectionsByUserId.get(userData.userId);
      const connection = userConnections?.get(client.sessionId);

      if (!connection) {
        return;
      }

      connection.status = nextPresence.status;
      connection.currentActivity = this.normalizeActivity(
        nextPresence.status,
        nextPresence.currentActivity,
      );
      connection.updatedAt = Date.now();

      const entry = await this.persistResolvedPresence(userData.userId);

      if (entry) {
        this.broadcast(SOCIAL_PRESENCE_CHANGED_MESSAGE, entry);
      }
    });
  }

  async onAuth(
    _client: Client<SocialPresenceClientData, AuthenticatedSessionIdentity>,
    options: { _authToken?: string } | undefined,
    context: AuthContext,
  ): Promise<AuthenticatedSessionIdentity> {
    const accessToken =
      (typeof context.token === 'string' && context.token) ||
      (typeof options?._authToken === 'string' && options._authToken) ||
      null;

    if (!accessToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Presence connection requires an access token.');
    }

    return this.sessionAuthService.authenticateAccessToken(accessToken);
  }

  async onJoin(
    client: Client<SocialPresenceClientData, AuthenticatedSessionIdentity>,
    options: { currentActivity?: string; status?: PresenceStatus } | undefined,
    auth: AuthenticatedSessionIdentity,
  ): Promise<void> {
    const initialStatus = options?.status === 'online' ? 'online' : 'in_launcher';
    const initialActivity = this.normalizeActivity(initialStatus, options?.currentActivity);

    client.userData = {
      authSessionId: auth.sessionId,
      nickname: auth.nickname,
      unregisterSession: this.presenceSessionService.registerSession(auth.sessionId, () => {
        client.leave();
      }),
      userId: auth.userId,
    };

    this.nicknameByUserId.set(auth.userId, auth.nickname);
    this.setConnection(auth.userId, client.sessionId, {
      currentActivity: initialActivity,
      nickname: auth.nickname,
      status: initialStatus,
      updatedAt: Date.now(),
      userId: auth.userId,
    });

    const liveEntry = await this.persistResolvedPresence(auth.userId);
    const snapshot: SocialLivePresenceSnapshot = {
      entries: this.getLiveEntries(),
    };

    client.send(SOCIAL_PRESENCE_SNAPSHOT_MESSAGE, snapshot);

    if (liveEntry) {
      this.broadcast(SOCIAL_PRESENCE_CHANGED_MESSAGE, liveEntry, {
        except: client,
      });
    }
  }

  async onLeave(
    client: Client<SocialPresenceClientData, AuthenticatedSessionIdentity>,
  ): Promise<void> {
    const userData = client.userData;

    if (!userData) {
      return;
    }

    userData.unregisterSession();
    this.deleteConnection(userData.userId, client.sessionId);
    const entry = await this.persistResolvedPresence(userData.userId);

    if (entry) {
      this.broadcast(SOCIAL_PRESENCE_CHANGED_MESSAGE, entry);
    }
  }

  private setConnection(userId: string, connectionId: string, connection: PresenceConnection): void {
    const existingConnections = this.connectionsByUserId.get(userId) ?? new Map<string, PresenceConnection>();
    existingConnections.set(connectionId, connection);
    this.connectionsByUserId.set(userId, existingConnections);
  }

  private deleteConnection(userId: string, connectionId: string): void {
    const userConnections = this.connectionsByUserId.get(userId);

    if (!userConnections) {
      return;
    }

    userConnections.delete(connectionId);

    if (userConnections.size === 0) {
      this.connectionsByUserId.delete(userId);
    }
  }

  private getLiveEntries(): SocialLivePresenceEntry[] {
    return [...this.connectionsByUserId.keys()]
      .map((userId) => this.resolveAggregateConnection(userId))
      .filter((connection): connection is PresenceConnection => Boolean(connection))
      .filter((connection) => connection.status !== 'offline')
      .map((connection) => this.toLivePresenceEntry(connection.nickname, {
        currentActivity: connection.currentActivity,
        lastSeenAt: new Date().toISOString(),
        status: connection.status,
      }))
      .sort((left, right) => left.nickname.localeCompare(right.nickname));
  }

  private resolveAggregateConnection(userId: string): PresenceConnection | null {
    const userConnections = this.connectionsByUserId.get(userId);

    if (!userConnections || userConnections.size === 0) {
      return null;
    }

    let selected: PresenceConnection | null = null;

    for (const connection of userConnections.values()) {
      if (!selected) {
        selected = connection;
        continue;
      }

      const currentPriority = PRESENCE_PRIORITY[connection.status];
      const selectedPriority = PRESENCE_PRIORITY[selected.status];

      if (
        currentPriority > selectedPriority ||
        (currentPriority === selectedPriority && connection.updatedAt >= selected.updatedAt)
      ) {
        selected = connection;
      }
    }

    return selected;
  }

  private async persistResolvedPresence(userId: string): Promise<SocialLivePresenceEntry | null> {
    const aggregateConnection = this.resolveAggregateConnection(userId);
    const nickname = aggregateConnection?.nickname ?? this.nicknameByUserId.get(userId);

    if (!nickname) {
      return null;
    }

    const persistedPresence = aggregateConnection
      ? await this.socialService.updatePresence(userId, {
          currentActivity: aggregateConnection.currentActivity,
          status: aggregateConnection.status,
        })
      : await this.socialService.updatePresence(userId, {
          status: 'offline',
        });

    const entry = this.toLivePresenceEntry(nickname, {
      currentActivity: persistedPresence.currentActivity,
      lastSeenAt: persistedPresence.lastSeenAt.toISOString(),
      status: persistedPresence.status,
    });
    return entry;
  }

  private normalizeActivity(
    status: PresenceStatus,
    currentActivity: string | undefined | null,
  ): string | null {
    if (status === 'offline') {
      return null;
    }

    const trimmed = currentActivity?.trim();

    if (trimmed) {
      return trimmed.slice(0, 60);
    }

    return status === 'in_launcher' ? 'In launcher' : 'Online';
  }

  private toLivePresenceEntry(
    nickname: string,
    presence: {
      currentActivity: string | null;
      lastSeenAt: string;
      status: PresenceStatus;
    },
  ): SocialLivePresenceEntry {
    return {
      nickname,
      presence: {
        currentActivity: presence.currentActivity,
        lastSeenAt: presence.lastSeenAt,
        status: presence.status,
      },
    };
  }
}
