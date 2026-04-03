import { AppApiError } from '@frontend/services/api/api-error';
import { type AuthService } from '@frontend/services/auth/auth-service';
import { SocialApiClient } from '@frontend/services/social/social-api-client';
import { SocialPresenceRealtimeService } from '@frontend/services/social/social-presence-realtime.service';
import type {
  PresencePayload,
  SocialDirectoryQuery,
  SocialDirectoryResponse,
  SocialSnapshot,
  SocialUserSummary,
} from '@frontend/services/social/social-types';
import type { SocialLivePresenceEntry } from '@shared/contracts/social.contract';

const DEFAULT_DIRECTORY_QUERY: SocialDirectoryQuery = {
  page: 1,
  pageSize: 18,
  presence: 'all',
  q: '',
  relationship: 'all',
};

interface SocialStoreOptions {
  apiClient?: SocialApiClient;
  authService: AuthService;
  realtimeService?: SocialPresenceRealtimeService;
}

export class SocialStore {
  private readonly apiClient: SocialApiClient;

  private readonly listeners = new Set<() => void>();

  private readonly realtimePresenceByNickname = new Map<
    string,
    SocialLivePresenceEntry['presence']
  >();

  private readonly realtimeService: SocialPresenceRealtimeService;

  private baseSnapshot: SocialSnapshot | null = null;

  private isLivePresenceReady = false;

  private lastDirectoryQuery: SocialDirectoryQuery = {
    ...DEFAULT_DIRECTORY_QUERY,
  };

  private lastPresenceSentAt = 0;

  private lastPresenceSignature: string | null = null;

  private selectedNickname: string | null = null;

  private snapshot: SocialSnapshot | null = null;

  constructor(private readonly options: SocialStoreOptions) {
    this.apiClient = options.apiClient ?? new SocialApiClient();
    this.realtimeService = options.realtimeService ?? new SocialPresenceRealtimeService();
    this.realtimeService.subscribe((event) => {
      if (event.type === 'snapshot') {
        this.isLivePresenceReady = true;
        this.realtimePresenceByNickname.clear();

        event.entries.forEach((entry) => {
          if (entry.presence.status !== 'offline') {
            this.realtimePresenceByNickname.set(entry.nickname, entry.presence);
          }
        });

        this.rebuildSnapshot();
        return;
      }

      if (event.type === 'presence') {
        this.isLivePresenceReady = true;

        if (event.entry.presence.status === 'offline') {
          this.realtimePresenceByNickname.delete(event.entry.nickname);
        } else {
          this.realtimePresenceByNickname.set(event.entry.nickname, event.entry.presence);
        }

        this.rebuildSnapshot();
        return;
      }

      if (event.type === 'disconnected') {
        if (!this.isLivePresenceReady && this.realtimePresenceByNickname.size === 0) {
          return;
        }

        this.isLivePresenceReady = false;
        this.realtimePresenceByNickname.clear();
        this.rebuildSnapshot();
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): SocialSnapshot | null {
    return this.snapshot;
  }

  reset(): void {
    this.baseSnapshot = null;
    this.isLivePresenceReady = false;
    this.lastDirectoryQuery = {
      ...DEFAULT_DIRECTORY_QUERY,
    };
    this.lastPresenceSentAt = 0;
    this.lastPresenceSignature = null;
    this.realtimePresenceByNickname.clear();
    this.selectedNickname = null;
    this.snapshot = null;
    this.notify();
  }

  async disconnectRealtime(): Promise<void> {
    await this.realtimeService.disconnect();
    this.isLivePresenceReady = false;
    this.realtimePresenceByNickname.clear();
    this.rebuildSnapshot();
  }

  async load(force = false): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    void this.ensureRealtimeConnected(accessToken);

    if (!force && this.snapshot) {
      return this.snapshot;
    }

    const [directory, friends, incomingRequests, outgoingRequests] = await Promise.all([
      this.getNormalizedDirectory(accessToken, this.lastDirectoryQuery),
      this.apiClient.getFriends(accessToken).then((value) => ({
        ...value,
        friends: value.friends.map((user) => this.normalizeUser(user)),
      })),
      this.apiClient.getIncomingRequests(accessToken).then((value) => ({
        ...value,
        requests: value.requests.map((request) => ({
          ...request,
          user: this.normalizeUser(request.user),
        })),
      })),
      this.apiClient.getOutgoingRequests(accessToken).then((value) => ({
        ...value,
        requests: value.requests.map((request) => ({
          ...request,
          user: this.normalizeUser(request.user),
        })),
      })),
    ]);

    const selectedNickname =
      this.selectedNickname ??
      this.snapshot?.profile?.nickname ??
      directory.users[0]?.nickname ??
      null;
    const profile = selectedNickname
      ? await this.getNormalizedProfile(accessToken, selectedNickname)
      : null;

    this.selectedNickname = profile?.nickname ?? selectedNickname;
    this.baseSnapshot = {
      directory,
      incomingRequests,
      outgoingRequests,
      profile,
      friends,
    };
    this.rebuildSnapshot();
    return this.ensureSnapshot();
  }

  async searchDirectory(
    queryPatch: Partial<Pick<SocialDirectoryQuery, 'presence' | 'q' | 'relationship'>>,
  ): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    void this.ensureRealtimeConnected(accessToken);

    this.lastDirectoryQuery = {
      ...this.lastDirectoryQuery,
      ...queryPatch,
      page: 1,
    };

    const directory = await this.getNormalizedDirectory(accessToken, this.lastDirectoryQuery);
    const nextBaseSnapshot = await this.ensureBaseSnapshot();

    this.baseSnapshot = {
      ...nextBaseSnapshot,
      directory,
    };
    this.rebuildSnapshot();

    if (!this.selectedNickname && directory.users[0]) {
      await this.selectProfile(directory.users[0].nickname);
      return this.ensureSnapshot();
    }

    return this.ensureSnapshot();
  }

  async loadMoreDirectory(): Promise<SocialSnapshot> {
    const currentBaseSnapshot = await this.ensureBaseSnapshot();

    if (!currentBaseSnapshot.directory.hasMore) {
      return this.ensureSnapshot();
    }

    const accessToken = await this.requireAccessToken();
    void this.ensureRealtimeConnected(accessToken);

    const nextQuery = {
      ...this.lastDirectoryQuery,
      page: this.lastDirectoryQuery.page + 1,
    };
    const nextPage = await this.getNormalizedDirectory(accessToken, nextQuery);
    const mergedUsers = [
      ...currentBaseSnapshot.directory.users,
      ...nextPage.users.filter(
        (candidate) =>
          !currentBaseSnapshot.directory.users.some(
            (existing) => existing.nickname === candidate.nickname,
          ),
      ),
    ];

    this.lastDirectoryQuery = nextQuery;
    this.baseSnapshot = {
      ...currentBaseSnapshot,
      directory: {
        ...nextPage,
        users: mergedUsers,
      },
    };
    this.rebuildSnapshot();

    return this.ensureSnapshot();
  }

  async selectProfile(nickname: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    void this.ensureRealtimeConnected(accessToken);

    const currentBaseSnapshot = await this.ensureBaseSnapshot();
    const profile = await this.getNormalizedProfile(accessToken, nickname);
    this.selectedNickname = profile?.nickname ?? nickname;
    this.baseSnapshot = {
      ...currentBaseSnapshot,
      profile,
    };
    this.rebuildSnapshot();

    return this.ensureSnapshot();
  }

  async sendFriendRequest(nickname: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    await this.apiClient.sendFriendRequest(accessToken, nickname);
    return this.refreshAfterMutation();
  }

  async acceptFriendRequest(requestId: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    await this.apiClient.acceptFriendRequest(accessToken, requestId);
    return this.refreshAfterMutation();
  }

  async rejectFriendRequest(requestId: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    await this.apiClient.rejectFriendRequest(accessToken, requestId);
    return this.refreshAfterMutation();
  }

  async cancelOutgoingRequest(requestId: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    await this.apiClient.cancelOutgoingRequest(accessToken, requestId);
    return this.refreshAfterMutation();
  }

  async removeFriend(friendshipId: string): Promise<SocialSnapshot> {
    const accessToken = await this.requireAccessToken();
    await this.apiClient.removeFriend(accessToken, friendshipId);
    return this.refreshAfterMutation();
  }

  async updatePresence(payload: PresencePayload): Promise<void> {
    const accessToken = await this.requireAccessToken();
    const signature = `${payload.status}:${payload.currentActivity ?? ''}`;

    if (
      signature === this.lastPresenceSignature &&
      Date.now() - this.lastPresenceSentAt < 15_000
    ) {
      return;
    }

    const isRealtimeConnected = await this.ensureRealtimeConnected(accessToken);

    if (isRealtimeConnected) {
      await this.realtimeService.updatePresence(payload);
    } else {
      await this.apiClient.updatePresence(accessToken, payload);
    }

    this.lastPresenceSignature = signature;
    this.lastPresenceSentAt = Date.now();
  }

  private applyResolvedPresence(user: SocialUserSummary): SocialUserSummary {
    if (!this.isLivePresenceReady) {
      return user;
    }

    const livePresence = this.realtimePresenceByNickname.get(user.nickname);

    if (!livePresence) {
      return {
        ...user,
        presence: {
          ...user.presence,
          currentActivity: null,
          status: 'offline',
        },
      };
    }

    return {
      ...user,
      presence: {
        ...livePresence,
      },
    };
  }

  private buildSnapshot(baseSnapshot: SocialSnapshot): SocialSnapshot {
    return {
      directory: {
        ...baseSnapshot.directory,
        users: baseSnapshot.directory.users.map((user) => this.applyResolvedPresence(user)),
      },
      friends: {
        ...baseSnapshot.friends,
        friends: baseSnapshot.friends.friends.map((friend) => this.applyResolvedPresence(friend)),
      },
      incomingRequests: {
        ...baseSnapshot.incomingRequests,
        requests: baseSnapshot.incomingRequests.requests.map((request) => ({
          ...request,
          user: this.applyResolvedPresence(request.user),
        })),
      },
      outgoingRequests: {
        ...baseSnapshot.outgoingRequests,
        requests: baseSnapshot.outgoingRequests.requests.map((request) => ({
          ...request,
          user: this.applyResolvedPresence(request.user),
        })),
      },
      profile: baseSnapshot.profile ? this.applyResolvedPresence(baseSnapshot.profile) : null,
    };
  }

  private async ensureBaseSnapshot(): Promise<SocialSnapshot> {
    if (this.baseSnapshot) {
      return this.baseSnapshot;
    }

    await this.load();
    return this.ensureBaseSnapshot();
  }

  private async ensureRealtimeConnected(accessToken: string): Promise<boolean> {
    return this.realtimeService.connect(accessToken);
  }

  private async ensureSnapshot(): Promise<SocialSnapshot> {
    if (this.snapshot) {
      return this.snapshot;
    }

    await this.load();
    return this.ensureSnapshot();
  }

  private normalizeUser(user: SocialUserSummary): SocialUserSummary {
    return {
      ...user,
      profileImageUrl: this.apiClient.resolveAssetUrl(user.profileImageUrl),
    };
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private rebuildSnapshot(): void {
    this.snapshot = this.baseSnapshot ? this.buildSnapshot(this.baseSnapshot) : null;
    this.notify();
  }

  private async refreshAfterMutation(): Promise<SocialSnapshot> {
    const previousSelectedNickname = this.selectedNickname;
    this.baseSnapshot = null;
    this.snapshot = null;
    this.selectedNickname = previousSelectedNickname;
    return this.load(true);
  }

  private async getNormalizedDirectory(
    accessToken: string,
    query: SocialDirectoryQuery,
  ): Promise<SocialDirectoryResponse> {
    const directory = await this.apiClient.getDirectory(accessToken, query);

    return {
      ...directory,
      users: directory.users.map((user) => this.normalizeUser(user)),
    };
  }

  private async getNormalizedProfile(
    accessToken: string,
    nickname: string,
  ): Promise<SocialSnapshot['profile']> {
    try {
      const response = await this.apiClient.getPublicProfile(accessToken, nickname);
      return this.normalizeUser(response.profile);
    } catch (error) {
      if (error instanceof AppApiError && error.code === 'USER_NOT_FOUND') {
        return null;
      }

      throw error;
    }
  }

  private async requireAccessToken(): Promise<string> {
    const accessToken = await this.options.authService.ensureAccessToken();

    if (!accessToken) {
      throw new AppApiError('UNAUTHENTICATED', 'No active session is available.');
    }

    return accessToken;
  }
}
