import { randomUUID } from 'node:crypto';

import { dbPool, type DatabaseClient } from '../lib/postgres';
import type {
  DirectoryQueryInput,
  FriendRequestRecord,
  FriendshipRecord,
  FriendshipStatus,
  PresenceRecord,
  PresenceStatus,
  SocialUserRecord,
} from '../types/social.types';

interface FriendshipRow {
  addressee_user_id: string;
  created_at: Date;
  id: string;
  requester_user_id: string;
  status: FriendshipStatus;
  updated_at: Date;
}

interface SocialUserRow {
  created_at: Date;
  current_activity: string | null;
  id: string;
  last_seen_at: Date;
  name: string;
  nickname: string;
  presence_status: PresenceStatus;
  profile_image_url: string | null;
  relationship_addressee_user_id: string | null;
  relationship_id: string | null;
  relationship_requester_user_id: string | null;
  relationship_status: FriendshipStatus | null;
}

interface FriendRequestRow extends SocialUserRow {
  friendship_created_at: Date;
  friendship_id: string;
}

interface CountRow {
  count: string;
}

interface PresenceRow {
  current_activity: string | null;
  last_seen_at: Date;
  status: PresenceStatus;
  updated_at: Date;
  user_id: string;
}

function mapFriendshipRow(row: FriendshipRow): FriendshipRecord {
  return {
    addresseeUserId: row.addressee_user_id,
    createdAt: row.created_at,
    id: row.id,
    requesterUserId: row.requester_user_id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapSocialUserRow(row: SocialUserRow): SocialUserRecord {
  return {
    createdAt: row.created_at,
    currentActivity: row.current_activity,
    id: row.id,
    lastSeenAt: row.last_seen_at,
    name: row.name,
    nickname: row.nickname,
    presenceStatus: row.presence_status,
    profileImageUrl: row.profile_image_url,
    relationshipAddresseeUserId: row.relationship_addressee_user_id,
    relationshipId: row.relationship_id,
    relationshipRequesterUserId: row.relationship_requester_user_id,
    relationshipStatus: row.relationship_status,
  };
}

function mapFriendRequestRow(row: FriendRequestRow): FriendRequestRecord {
  return {
    createdAt: row.friendship_created_at,
    friendshipId: row.friendship_id,
    user: mapSocialUserRow(row),
  };
}

function mapPresenceRow(row: PresenceRow): PresenceRecord {
  return {
    currentActivity: row.current_activity,
    lastSeenAt: row.last_seen_at,
    status: row.status,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function buildDirectoryFromClause(viewerParam: number): string {
  return `
    FROM users u
    LEFT JOIN user_presence p
      ON p.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT
        f.id,
        f.status,
        f.requester_user_id,
        f.addressee_user_id
      FROM friendships f
      WHERE (
        (f.requester_user_id = $${viewerParam} AND f.addressee_user_id = u.id)
        OR
        (f.requester_user_id = u.id AND f.addressee_user_id = $${viewerParam})
      )
      AND f.status IN ('pending', 'accepted', 'blocked')
      ORDER BY
        CASE WHEN f.status = 'accepted' THEN 0 ELSE 1 END,
        f.updated_at DESC
      LIMIT 1
    ) rel ON TRUE
  `;
}

function buildDirectoryWhereClause(
  input: DirectoryQueryInput,
  viewerParam: number,
  searchParam: number,
): { clause: string; params: unknown[] } {
  const conditions = [`u.id <> $${viewerParam}`];
  const params: unknown[] = [];

  if (input.query) {
    conditions.push(`(u.nickname ILIKE $${searchParam} OR u.name ILIKE $${searchParam})`);
    params.push(`%${input.query}%`);
  }

  if (input.presence === 'online') {
    conditions.push(`COALESCE(p.status, 'offline') <> 'offline'`);
  }

  if (input.presence === 'offline') {
    conditions.push(`COALESCE(p.status, 'offline') = 'offline'`);
  }

  if (input.relationship === 'friends') {
    conditions.push(`rel.status = 'accepted'`);
  }

  if (input.relationship === 'requests') {
    conditions.push(`rel.status = 'pending'`);
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

export class SocialRepository {
  constructor(private readonly database: DatabaseClient = dbPool) {}

  async listGlobalUsers(
    viewerUserId: string,
    input: DirectoryQueryInput,
    client?: DatabaseClient,
  ): Promise<{ total: number; users: SocialUserRecord[] }> {
    const executor = client ?? this.database;
    const searchParam = 2;
    const { clause, params: filterParams } = buildDirectoryWhereClause(
      input,
      1,
      searchParam,
    );
    const fromClause = buildDirectoryFromClause(1);
    const totalResult = await executor.query<CountRow>(
      `SELECT COUNT(*) AS count
       ${fromClause}
       ${clause}`,
      [viewerUserId, ...filterParams],
    );
    const total = Number(totalResult.rows[0]?.count ?? '0');
    const pageOffset = (input.page - 1) * input.pageSize;
    const result = await executor.query<SocialUserRow>(
      `SELECT
         u.id,
         u.nickname,
         u.name,
         u.profile_image_url,
         u.created_at,
         COALESCE(p.status, 'offline') AS presence_status,
         p.current_activity,
         COALESCE(p.last_seen_at, u.created_at) AS last_seen_at,
         rel.id AS relationship_id,
         rel.status AS relationship_status,
         rel.requester_user_id AS relationship_requester_user_id,
         rel.addressee_user_id AS relationship_addressee_user_id
       ${fromClause}
       ${clause}
       ORDER BY
         CASE WHEN COALESCE(p.status, 'offline') = 'offline' THEN 1 ELSE 0 END,
         LOWER(u.nickname) ASC
       LIMIT $${filterParams.length + 2}
       OFFSET $${filterParams.length + 3}`,
      [viewerUserId, ...filterParams, input.pageSize, pageOffset],
    );

    return {
      total,
      users: result.rows.map(mapSocialUserRow),
    };
  }

  async findPublicProfileByNickname(
    viewerUserId: string,
    nickname: string,
    client?: DatabaseClient,
  ): Promise<SocialUserRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<SocialUserRow>(
      `SELECT
         u.id,
         u.nickname,
         u.name,
         u.profile_image_url,
         u.created_at,
         COALESCE(p.status, 'offline') AS presence_status,
         p.current_activity,
         COALESCE(p.last_seen_at, u.created_at) AS last_seen_at,
         rel.id AS relationship_id,
         rel.status AS relationship_status,
         rel.requester_user_id AS relationship_requester_user_id,
         rel.addressee_user_id AS relationship_addressee_user_id
       ${buildDirectoryFromClause(1)}
       WHERE u.nickname = $2
       LIMIT 1`,
      [viewerUserId, nickname],
    );

    return result.rows[0] ? mapSocialUserRow(result.rows[0]) : null;
  }

  async findFriendshipBetweenUsers(
    userId: string,
    otherUserId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<FriendshipRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendshipRow>(
      `SELECT
         id,
         requester_user_id,
         addressee_user_id,
         status,
         created_at,
         updated_at
       FROM friendships
       WHERE (
         (requester_user_id = $1 AND addressee_user_id = $2)
         OR
         (requester_user_id = $2 AND addressee_user_id = $1)
       )
       AND status IN ('pending', 'accepted', 'blocked')
       ORDER BY
         CASE WHEN status = 'accepted' THEN 0 ELSE 1 END,
         updated_at DESC
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [userId, otherUserId],
    );

    return result.rows[0] ? mapFriendshipRow(result.rows[0]) : null;
  }

  async createFriendRequest(
    requesterUserId: string,
    addresseeUserId: string,
    client?: DatabaseClient,
  ): Promise<FriendshipRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendshipRow>(
      `INSERT INTO friendships (
         id,
         requester_user_id,
         addressee_user_id,
         status,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING
         id,
         requester_user_id,
         addressee_user_id,
         status,
         created_at,
         updated_at`,
      [randomUUID(), requesterUserId, addresseeUserId],
    );

    const friendship = result.rows[0];

    if (!friendship) {
      throw new Error('Friend request creation did not return a database row.');
    }

    return mapFriendshipRow(friendship);
  }

  async findFriendshipById(
    friendshipId: string,
    client?: DatabaseClient,
    options: { forUpdate?: boolean } = {},
  ): Promise<FriendshipRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendshipRow>(
      `SELECT
         id,
         requester_user_id,
         addressee_user_id,
         status,
         created_at,
         updated_at
       FROM friendships
       WHERE id = $1
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE' : ''}`,
      [friendshipId],
    );

    return result.rows[0] ? mapFriendshipRow(result.rows[0]) : null;
  }

  async updateFriendshipStatus(
    friendshipId: string,
    status: FriendshipStatus,
    client?: DatabaseClient,
  ): Promise<FriendshipRecord | null> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendshipRow>(
      `UPDATE friendships
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         requester_user_id,
         addressee_user_id,
         status,
         created_at,
         updated_at`,
      [friendshipId, status],
    );

    return result.rows[0] ? mapFriendshipRow(result.rows[0]) : null;
  }

  async deleteFriendship(friendshipId: string, client?: DatabaseClient): Promise<void> {
    const executor = client ?? this.database;
    await executor.query(`DELETE FROM friendships WHERE id = $1`, [friendshipId]);
  }

  async listFriends(userId: string, client?: DatabaseClient): Promise<SocialUserRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<SocialUserRow>(
      `SELECT
         u.id,
         u.nickname,
         u.name,
         u.profile_image_url,
         u.created_at,
         COALESCE(p.status, 'offline') AS presence_status,
         p.current_activity,
         COALESCE(p.last_seen_at, u.created_at) AS last_seen_at,
         f.id AS relationship_id,
         f.status AS relationship_status,
         f.requester_user_id AS relationship_requester_user_id,
         f.addressee_user_id AS relationship_addressee_user_id
       FROM friendships f
       JOIN users u
         ON u.id = CASE
           WHEN f.requester_user_id = $1 THEN f.addressee_user_id
           ELSE f.requester_user_id
         END
       LEFT JOIN user_presence p
         ON p.user_id = u.id
       WHERE (f.requester_user_id = $1 OR f.addressee_user_id = $1)
       AND f.status = 'accepted'
       ORDER BY
         CASE WHEN COALESCE(p.status, 'offline') = 'offline' THEN 1 ELSE 0 END,
         LOWER(u.nickname) ASC`,
      [userId],
    );

    return result.rows.map(mapSocialUserRow);
  }

  async listIncomingRequests(userId: string, client?: DatabaseClient): Promise<FriendRequestRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendRequestRow>(
      `SELECT
         u.id,
         u.nickname,
         u.name,
         u.profile_image_url,
         u.created_at,
         COALESCE(p.status, 'offline') AS presence_status,
         p.current_activity,
         COALESCE(p.last_seen_at, u.created_at) AS last_seen_at,
         f.id AS relationship_id,
         f.status AS relationship_status,
         f.requester_user_id AS relationship_requester_user_id,
         f.addressee_user_id AS relationship_addressee_user_id,
         f.id AS friendship_id,
         f.created_at AS friendship_created_at
       FROM friendships f
       JOIN users u
         ON u.id = f.requester_user_id
       LEFT JOIN user_presence p
         ON p.user_id = u.id
       WHERE f.addressee_user_id = $1
       AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId],
    );

    return result.rows.map(mapFriendRequestRow);
  }

  async listOutgoingRequests(userId: string, client?: DatabaseClient): Promise<FriendRequestRecord[]> {
    const executor = client ?? this.database;
    const result = await executor.query<FriendRequestRow>(
      `SELECT
         u.id,
         u.nickname,
         u.name,
         u.profile_image_url,
         u.created_at,
         COALESCE(p.status, 'offline') AS presence_status,
         p.current_activity,
         COALESCE(p.last_seen_at, u.created_at) AS last_seen_at,
         f.id AS relationship_id,
         f.status AS relationship_status,
         f.requester_user_id AS relationship_requester_user_id,
         f.addressee_user_id AS relationship_addressee_user_id,
         f.id AS friendship_id,
         f.created_at AS friendship_created_at
       FROM friendships f
       JOIN users u
         ON u.id = f.addressee_user_id
       LEFT JOIN user_presence p
         ON p.user_id = u.id
       WHERE f.requester_user_id = $1
       AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId],
    );

    return result.rows.map(mapFriendRequestRow);
  }

  async updatePresence(
    userId: string,
    status: PresenceStatus,
    currentActivity: string | null,
    client?: DatabaseClient,
  ): Promise<PresenceRecord> {
    const executor = client ?? this.database;
    const result = await executor.query<PresenceRow>(
      `INSERT INTO user_presence (
         user_id,
         status,
         current_activity,
         last_seen_at,
         updated_at
       )
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         current_activity = EXCLUDED.current_activity,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING
         user_id,
         status,
         current_activity,
         last_seen_at,
         updated_at`,
      [userId, status, currentActivity],
    );

    const presence = result.rows[0];

    if (!presence) {
      throw new Error('Presence update did not return a database row.');
    }

    return mapPresenceRow(presence);
  }
}

