import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export const PROFILE_UPLOADS_ROOT = path.resolve(process.cwd(), 'storage', 'uploads');
export const PROFILE_AVATARS_ROOT = path.join(PROFILE_UPLOADS_ROOT, 'avatars');
export const PROFILE_AVATAR_ROUTE_PREFIX = '/uploads/avatars/';
export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_AVATAR_MIME_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function ensureProfileStorage(): Promise<void> {
  await mkdir(PROFILE_AVATARS_ROOT, {
    recursive: true,
  });
}

export function resolveAvatarPublicPath(fileName: string): string {
  return `${PROFILE_AVATAR_ROUTE_PREFIX}${fileName}`;
}

export function resolveAvatarAbsolutePath(fileName: string): string {
  return path.join(PROFILE_AVATARS_ROOT, fileName);
}

export function isLocalAvatarPath(candidate: string | null | undefined): boolean {
  return Boolean(candidate && candidate.startsWith(PROFILE_AVATAR_ROUTE_PREFIX));
}
