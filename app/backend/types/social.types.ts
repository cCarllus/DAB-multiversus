export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type PresenceStatus = 'online' | 'offline' | 'in_launcher';
export type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'friends';
export type DirectoryPresenceFilter = 'all' | 'online' | 'offline';
export type DirectoryRelationshipFilter = 'all' | 'friends' | 'requests';

export interface FriendshipRecord {
  addresseeUserId: string;
  createdAt: Date;
  id: string;
  requesterUserId: string;
  status: FriendshipStatus;
  updatedAt: Date;
}

export interface PresenceRecord {
  currentActivity: string | null;
  lastSeenAt: Date;
  status: PresenceStatus;
  updatedAt: Date;
  userId: string;
}

export interface SocialUserRecord {
  createdAt: Date;
  currentActivity: string | null;
  id: string;
  lastSeenAt: Date;
  name: string;
  nickname: string;
  presenceStatus: PresenceStatus;
  profileImageUrl: string | null;
  relationshipAddresseeUserId: string | null;
  relationshipId: string | null;
  relationshipRequesterUserId: string | null;
  relationshipStatus: FriendshipStatus | null;
}

export interface FriendRequestRecord {
  createdAt: Date;
  friendshipId: string;
  user: SocialUserRecord;
}

export interface DirectoryQueryInput {
  page: number;
  pageSize: number;
  presence: DirectoryPresenceFilter;
  query: string;
  relationship: DirectoryRelationshipFilter;
}

export interface UpdatePresenceInput {
  currentActivity?: string | null;
  status: PresenceStatus;
}
