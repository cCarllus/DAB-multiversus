export interface UserRecord {
  id: string;
  email: string;
  name: string;
  nickname: string;
  passwordHash: string;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
  nickname: string;
  passwordHash: string;
  profileImageUrl?: string | null;
}

export interface UpdateUserProfileInput {
  name?: string;
  profileImageUrl?: string | null;
}

export interface PublicUser {
  email: string;
  name: string;
  nickname: string;
  profileImageUrl: string | null;
  createdAt: string;
}
