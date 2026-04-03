import { withTransaction, type DatabaseClient } from '../lib/postgres';
import { AppError } from '../lib/app-error';
import { SocialRepository } from '../repositories/social.repository';
import type {
  DirectoryQueryInput,
  FriendshipRecord,
  RelationshipState,
  SocialUserRecord,
  UpdatePresenceInput,
} from '../types/social.types';
import { UsersService } from './users.service';

interface PublicRelationship {
  friendshipId: string | null;
  requestId: string | null;
  state: RelationshipState;
}

export class SocialService {
  constructor(
    private readonly socialRepository: SocialRepository,
    private readonly usersService: UsersService,
  ) {}

  async listGlobalUsers(viewerUserId: string, input: DirectoryQueryInput) {
    const result = await this.socialRepository.listGlobalUsers(viewerUserId, input);

    return {
      filters: {
        presence: input.presence,
        relationship: input.relationship,
      },
      hasMore: input.page * input.pageSize < result.total,
      page: input.page,
      pageSize: input.pageSize,
      query: input.query,
      total: result.total,
      users: result.users.map((user) => this.toSocialUserSummary(user, viewerUserId)),
    };
  }

  async getPublicProfile(viewerUserId: string, nickname: string) {
    const profile = await this.socialRepository.findPublicProfileByNickname(
      viewerUserId,
      nickname.trim().toLowerCase(),
    );

    if (!profile) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Player profile could not be found.');
    }

    return {
      profile: this.toSocialUserSummary(profile, viewerUserId),
    };
  }

  async listFriends(userId: string) {
    const friends = await this.socialRepository.listFriends(userId);

    return {
      friends: friends.map((friend) => this.toSocialUserSummary(friend, userId)),
      total: friends.length,
    };
  }

  async listIncomingRequests(userId: string) {
    const requests = await this.socialRepository.listIncomingRequests(userId);

    return {
      requests: requests.map((request) => ({
        createdAt: request.createdAt.toISOString(),
        id: request.friendshipId,
        user: this.toSocialUserSummary(request.user, userId),
      })),
      total: requests.length,
    };
  }

  async listOutgoingRequests(userId: string) {
    const requests = await this.socialRepository.listOutgoingRequests(userId);

    return {
      requests: requests.map((request) => ({
        createdAt: request.createdAt.toISOString(),
        id: request.friendshipId,
        user: this.toSocialUserSummary(request.user, userId),
      })),
      total: requests.length,
    };
  }

  async sendFriendRequest(requesterUserId: string, nickname: string): Promise<void> {
    const normalizedNickname = nickname.trim().toLowerCase();
    const targetUser = await this.usersService.findByNickname(normalizedNickname);

    if (!targetUser) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Player profile could not be found.');
    }

    if (targetUser.id === requesterUserId) {
      throw new AppError(400, 'SELF_FRIEND_REQUEST', 'You cannot send a friend request to yourself.');
    }

    await withTransaction(async (client) => {
      const existingFriendship = await this.socialRepository.findFriendshipBetweenUsers(
        requesterUserId,
        targetUser.id,
        client,
        {
          forUpdate: true,
        },
      );

      this.assertCanCreateRequest(existingFriendship, requesterUserId);

      await this.socialRepository.createFriendRequest(requesterUserId, targetUser.id, client);
    });
  }

  async acceptFriendRequest(userId: string, requestId: string): Promise<void> {
    await withTransaction(async (client) => {
      const request = await this.requirePendingRequest(requestId, client);

      if (request.addresseeUserId !== userId) {
        throw new AppError(
          403,
          'FRIEND_REQUEST_NOT_OWNED',
          'Only the recipient can accept this friend request.',
        );
      }

      await this.socialRepository.updateFriendshipStatus(requestId, 'accepted', client);
    });
  }

  async rejectFriendRequest(userId: string, requestId: string): Promise<void> {
    await withTransaction(async (client) => {
      const request = await this.requirePendingRequest(requestId, client);

      if (request.addresseeUserId !== userId) {
        throw new AppError(
          403,
          'FRIEND_REQUEST_NOT_OWNED',
          'Only the recipient can reject this friend request.',
        );
      }

      await this.socialRepository.deleteFriendship(requestId, client);
    });
  }

  async cancelOutgoingRequest(userId: string, requestId: string): Promise<void> {
    await withTransaction(async (client) => {
      const request = await this.requirePendingRequest(requestId, client);

      if (request.requesterUserId !== userId) {
        throw new AppError(
          403,
          'FRIEND_REQUEST_NOT_OWNED',
          'Only the requester can cancel this friend request.',
        );
      }

      await this.socialRepository.deleteFriendship(requestId, client);
    });
  }

  async removeFriend(userId: string, friendshipId: string): Promise<void> {
    await withTransaction(async (client) => {
      const friendship = await this.socialRepository.findFriendshipById(friendshipId, client, {
        forUpdate: true,
      });

      if (!friendship || friendship.status !== 'accepted') {
        throw new AppError(404, 'FRIENDSHIP_NOT_FOUND', 'Friendship could not be found.');
      }

      if (friendship.requesterUserId !== userId && friendship.addresseeUserId !== userId) {
        throw new AppError(
          403,
          'FRIENDSHIP_NOT_OWNED',
          'You cannot modify this friendship.',
        );
      }

      await this.socialRepository.deleteFriendship(friendshipId, client);
    });
  }

  async updatePresence(userId: string, input: UpdatePresenceInput, client?: DatabaseClient) {
    const normalizedActivity = input.currentActivity?.trim() || null;

    return this.socialRepository.updatePresence(
      userId,
      input.status,
      input.status === 'offline' ? null : normalizedActivity,
      client,
    );
  }

  async markUserInLauncher(userId: string, currentActivity = 'In launcher'): Promise<void> {
    await this.updatePresence(userId, {
      currentActivity,
      status: 'in_launcher',
    });
  }

  async markUserOffline(userId: string): Promise<void> {
    await this.updatePresence(userId, {
      status: 'offline',
    });
  }

  private async requirePendingRequest(
    requestId: string,
    client: DatabaseClient,
  ): Promise<FriendshipRecord> {
    const request = await this.socialRepository.findFriendshipById(requestId, client, {
      forUpdate: true,
    });

    if (!request || request.status !== 'pending') {
      throw new AppError(404, 'FRIEND_REQUEST_NOT_FOUND', 'Friend request could not be found.');
    }

    return request;
  }

  private assertCanCreateRequest(
    existingFriendship: FriendshipRecord | null,
    requesterUserId: string,
  ): void {
    if (!existingFriendship) {
      return;
    }

    if (existingFriendship.status === 'accepted') {
      throw new AppError(409, 'ALREADY_FRIENDS', 'You are already friends with this player.');
    }

    if (existingFriendship.status === 'blocked') {
      throw new AppError(
        403,
        'FRIENDSHIP_BLOCKED',
        'This player cannot receive friend requests right now.',
      );
    }

    if (existingFriendship.requesterUserId === requesterUserId) {
      throw new AppError(
        409,
        'FRIEND_REQUEST_ALREADY_SENT',
        'A friend request has already been sent to this player.',
      );
    }

    throw new AppError(
      409,
      'FRIEND_REQUEST_ALREADY_RECEIVED',
      'You already have an incoming request from this player.',
    );
  }

  private toSocialUserSummary(user: SocialUserRecord, viewerUserId: string) {
    return {
      createdAt: user.createdAt.toISOString(),
      level: user.level,
      name: user.name,
      nickname: user.nickname,
      presence: {
        currentActivity: user.currentActivity,
        lastSeenAt: user.lastSeenAt.toISOString(),
        status: user.presenceStatus,
      },
      profileImageUrl: user.profileImageUrl,
      relationship: this.toRelationship(user, viewerUserId),
    };
  }

  private toRelationship(user: SocialUserRecord, viewerUserId: string): PublicRelationship {
    if (!user.relationshipStatus || !user.relationshipId) {
      return {
        friendshipId: null,
        requestId: null,
        state: 'none',
      };
    }

    if (user.relationshipStatus === 'accepted') {
      return {
        friendshipId: user.relationshipId,
        requestId: null,
        state: 'friends',
      };
    }

    if (user.relationshipStatus === 'pending') {
      const isRequester = user.relationshipRequesterUserId === viewerUserId;

      return {
        friendshipId: null,
        requestId: user.relationshipId,
        state: isRequester ? 'pending_sent' : 'pending_received',
      };
    }

    return {
      friendshipId: null,
      requestId: null,
      state: 'none',
    };
  }
}
