import bcrypt from 'bcryptjs';

const PASSWORD_HASH_ROUNDS = 12;

export class PasswordService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
