export type SocialPresenceStatus =
  | 'online'
  | 'offline'
  | 'in_launcher';

export const SOCIAL_PRESENCE_ROOM_NAME = 'social_presence';
export const SOCIAL_PRESENCE_CHANGED_MESSAGE = 'presence:changed';
export const SOCIAL_PRESENCE_SNAPSHOT_MESSAGE = 'presence:snapshot';
export const SOCIAL_PRESENCE_UPDATE_MESSAGE = 'presence:update';

export type SocialRelationshipState =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'friends';

export type SocialDirectoryPresenceFilter = 'all' | 'online' | 'offline';
export type SocialDirectoryRelationshipFilter = 'all' | 'friends' | 'requests';

export interface SocialRelationship {
  friendshipId: string | null;
  requestId: string | null;
  state: SocialRelationshipState;
}

export interface SocialPresence {
  currentActivity: string | null;
  lastSeenAt: string;
  status: SocialPresenceStatus;
}

export interface SocialLivePresenceEntry {
  nickname: string;
  presence: SocialPresence;
}

export interface SocialLivePresenceSnapshot {
  entries: SocialLivePresenceEntry[];
}

export interface SocialUserSummary {
  createdAt: string;
  name: string;
  nickname: string;
  presence: SocialPresence;
  profileImageUrl: string | null;
  relationship: SocialRelationship;
}

export interface SocialDirectoryResponse {
  filters: {
    presence: SocialDirectoryPresenceFilter;
    relationship: SocialDirectoryRelationshipFilter;
  };
  hasMore: boolean;
  page: number;
  pageSize: number;
  query: string;
  total: number;
  users: SocialUserSummary[];
}

export interface SocialFriendRequest {
  createdAt: string;
  id: string;
  user: SocialUserSummary;
}

export interface SocialFriendRequestsResponse {
  requests: SocialFriendRequest[];
  total: number;
}

export interface SocialFriendsResponse {
  friends: SocialUserSummary[];
  total: number;
}

export interface SocialPublicProfileResponse {
  profile: SocialUserSummary;
}
