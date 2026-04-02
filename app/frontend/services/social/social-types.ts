import type {
  SocialDirectoryPresenceFilter,
  SocialDirectoryRelationshipFilter,
  SocialDirectoryResponse,
  SocialFriendRequestsResponse,
  SocialFriendsResponse,
  SocialPublicProfileResponse,
  SocialPresenceStatus,
  SocialUserSummary,
} from '@shared/contracts/social.contract';

export type {
  SocialDirectoryPresenceFilter,
  SocialDirectoryRelationshipFilter,
  SocialDirectoryResponse,
  SocialFriendRequestsResponse,
  SocialFriendsResponse,
  SocialPresenceStatus,
  SocialUserSummary,
};

export interface SocialDirectoryQuery {
  page: number;
  pageSize: number;
  presence: SocialDirectoryPresenceFilter;
  q: string;
  relationship: SocialDirectoryRelationshipFilter;
}

export interface SocialSnapshot {
  directory: SocialDirectoryResponse;
  incomingRequests: SocialFriendRequestsResponse;
  outgoingRequests: SocialFriendRequestsResponse;
  profile: SocialPublicProfileResponse['profile'] | null;
  friends: SocialFriendsResponse;
}

export interface SocialFeedback {
  message: string;
  tone: 'error' | 'success';
}

export interface PresencePayload {
  currentActivity?: string;
  status: SocialPresenceStatus;
}

