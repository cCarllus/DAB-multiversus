export interface UserRecord {
  id: string;
  email: string;
  username: string | null;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  username: string | null;
  passwordHash: string;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  createdAt: string;
}
