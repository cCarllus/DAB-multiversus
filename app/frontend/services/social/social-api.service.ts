import { AppApiError } from '@frontend/services/api/api-error';
import { resolveApiBaseUrl } from '@frontend/services/api/api-base-url';
import type {
  PresencePayload,
  SocialDirectoryQuery,
  SocialDirectoryResponse,
  SocialFriendRequestsResponse,
  SocialFriendsResponse,
} from './social-types';
import type { SocialPublicProfileResponse } from '@shared/contracts/social.contract';

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') ?? false;
}

export class SocialApiClient {
  constructor(private readonly baseUrl = resolveApiBaseUrl()) {}

  resolveAssetUrl(assetPath: string | null): string | null {
    if (!assetPath) {
      return null;
    }

    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath;
    }

    return `${this.baseUrl}${assetPath.startsWith('/') ? assetPath : `/${assetPath}`}`;
  }

  async getDirectory(
    accessToken: string,
    query: SocialDirectoryQuery,
  ): Promise<SocialDirectoryResponse> {
    const search = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
      presence: query.presence,
      q: query.q,
      relationship: query.relationship,
    });

    return this.request<SocialDirectoryResponse>(`/users/global?${search.toString()}`, {
      accessToken,
      method: 'GET',
    });
  }

  async getPublicProfile(
    accessToken: string,
    nickname: string,
  ): Promise<SocialPublicProfileResponse> {
    return this.request<SocialPublicProfileResponse>(
      `/users/${encodeURIComponent(nickname)}/public-profile`,
      {
        accessToken,
        method: 'GET',
      },
    );
  }

  async getFriends(accessToken: string): Promise<SocialFriendsResponse> {
    return this.request<SocialFriendsResponse>('/friends', {
      accessToken,
      method: 'GET',
    });
  }

  async getIncomingRequests(accessToken: string): Promise<SocialFriendRequestsResponse> {
    return this.request<SocialFriendRequestsResponse>('/friends/requests/incoming', {
      accessToken,
      method: 'GET',
    });
  }

  async getOutgoingRequests(accessToken: string): Promise<SocialFriendRequestsResponse> {
    return this.request<SocialFriendRequestsResponse>('/friends/requests/outgoing', {
      accessToken,
      method: 'GET',
    });
  }

  async sendFriendRequest(accessToken: string, nickname: string): Promise<void> {
    await this.request('/friends/request', {
      accessToken,
      body: JSON.stringify({
        nickname,
      }),
      method: 'POST',
    });
  }

  async acceptFriendRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/${requestId}/accept`, {
      accessToken,
      method: 'POST',
    });
  }

  async rejectFriendRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/${requestId}/reject`, {
      accessToken,
      method: 'POST',
    });
  }

  async cancelOutgoingRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/requests/${requestId}`, {
      accessToken,
      method: 'DELETE',
    });
  }

  async removeFriend(accessToken: string, friendshipId: string): Promise<void> {
    await this.request(`/friends/${friendshipId}`, {
      accessToken,
      method: 'DELETE',
    });
  }

  async updatePresence(accessToken: string, payload: PresencePayload): Promise<void> {
    await this.request('/presence/me', {
      accessToken,
      body: JSON.stringify(payload),
      method: 'PATCH',
    });
  }

  private async request<T = void>(
    path: string,
    options: {
      accessToken: string;
      body?: BodyInit;
      method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
    },
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        body: options.body,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${options.accessToken}`,
          ...(options.body
            ? {
                'Content-Type': 'application/json',
              }
            : {}),
        },
        method: options.method,
      });

      const payload = isJsonResponse(response)
        ? ((await response.json()) as unknown)
        : undefined;

      if (!response.ok) {
        const errorEnvelope = (payload ?? {}) as ErrorEnvelope;
        throw new AppApiError(
          errorEnvelope.error?.code ?? 'UNKNOWN_SOCIAL_ERROR',
          errorEnvelope.error?.message ?? 'Social request failed.',
          response.status,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof AppApiError) {
        throw error;
      }

      if (error instanceof TypeError) {
        throw new AppApiError(
          'BACKEND_UNAVAILABLE',
          'The launcher could not reach the social service.',
        );
      }

      throw new AppApiError('UNKNOWN_SOCIAL_ERROR', 'Social request failed.');
    }
  }
}
