import { BackendApiClient } from '@frontend/services/api/backend-api-client';
import type {
  PresencePayload,
  SocialDirectoryQuery,
  SocialDirectoryResponse,
  SocialFriendRequestsResponse,
  SocialFriendsResponse,
} from './social-types';
import type { SocialPublicProfileResponse } from '@shared/contracts/social.contract';

const SOCIAL_REQUEST_MESSAGES = {
  failureCode: 'UNKNOWN_SOCIAL_ERROR',
  failureMessage: 'Social request failed.',
  networkMessage: 'The launcher could not reach the social service.',
} as const;

export class SocialApiClient extends BackendApiClient {

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
    }, SOCIAL_REQUEST_MESSAGES);
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
      SOCIAL_REQUEST_MESSAGES,
    );
  }

  async getFriends(accessToken: string): Promise<SocialFriendsResponse> {
    return this.request<SocialFriendsResponse>('/friends', {
      accessToken,
      method: 'GET',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async getIncomingRequests(accessToken: string): Promise<SocialFriendRequestsResponse> {
    return this.request<SocialFriendRequestsResponse>('/friends/requests/incoming', {
      accessToken,
      method: 'GET',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async getOutgoingRequests(accessToken: string): Promise<SocialFriendRequestsResponse> {
    return this.request<SocialFriendRequestsResponse>('/friends/requests/outgoing', {
      accessToken,
      method: 'GET',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async sendFriendRequest(accessToken: string, nickname: string): Promise<void> {
    await this.request('/friends/request', {
      accessToken,
      body: JSON.stringify({
        nickname,
      }),
      method: 'POST',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async acceptFriendRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/${requestId}/accept`, {
      accessToken,
      method: 'POST',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async rejectFriendRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/${requestId}/reject`, {
      accessToken,
      method: 'POST',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async cancelOutgoingRequest(accessToken: string, requestId: string): Promise<void> {
    await this.request(`/friends/requests/${requestId}`, {
      accessToken,
      method: 'DELETE',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async removeFriend(accessToken: string, friendshipId: string): Promise<void> {
    await this.request(`/friends/${friendshipId}`, {
      accessToken,
      method: 'DELETE',
    }, SOCIAL_REQUEST_MESSAGES);
  }

  async updatePresence(accessToken: string, payload: PresencePayload): Promise<void> {
    await this.request('/presence/me', {
      accessToken,
      body: JSON.stringify(payload),
      method: 'PATCH',
    }, SOCIAL_REQUEST_MESSAGES);
  }
}
