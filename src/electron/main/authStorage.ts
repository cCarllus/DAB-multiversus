import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import { app, ipcMain, safeStorage } from 'electron';

import type { DesktopRememberedAuthSession } from '@shared/types/desktop';

const AUTH_STORAGE_CHANNELS = {
  clear: 'desktop-auth-storage:clear',
  get: 'desktop-auth-storage:get',
  isAvailable: 'desktop-auth-storage:is-available',
  set: 'desktop-auth-storage:set',
} as const;

const AUTH_STORAGE_FILENAME = 'auth-session.bin';
const AUTH_STORAGE_DEV_FILENAME = 'auth-session.dev.json';

let handlersRegistered = false;

function getAuthStorageFilePath(): string {
  return join(app.getPath('userData'), AUTH_STORAGE_FILENAME);
}

function getDevAuthStorageFilePath(): string {
  return join(app.getPath('userData'), AUTH_STORAGE_DEV_FILENAME);
}

function supportsDevFallbackStorage(): boolean {
  return !app.isPackaged;
}

function validateRememberedSession(
  value: unknown,
): asserts value is DesktopRememberedAuthSession {
  if (!value || typeof value !== 'object') {
    throw new Error('Remembered auth session is malformed.');
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.refreshToken !== 'string' ||
    typeof candidate.sessionExpiresAt !== 'string' ||
    typeof candidate.savedAt !== 'string'
  ) {
    throw new Error('Remembered auth session payload is invalid.');
  }
}

async function readRememberedSession(): Promise<DesktopRememberedAuthSession | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      if (!supportsDevFallbackStorage()) {
        return null;
      }

      const rawPayload = await fs.readFile(getDevAuthStorageFilePath(), 'utf8');
      const parsedPayload = JSON.parse(rawPayload) as unknown;

      validateRememberedSession(parsedPayload);

      return parsedPayload;
    }

    const encryptedPayload = await fs.readFile(getAuthStorageFilePath());
    const decryptedPayload = safeStorage.decryptString(encryptedPayload);
    const parsedPayload = JSON.parse(decryptedPayload) as unknown;

    validateRememberedSession(parsedPayload);

    return parsedPayload;
  } catch (error) {
    const candidate = error as NodeJS.ErrnoException | undefined;

    if (candidate?.code === 'ENOENT') {
      return null;
    }

    await clearRememberedSession();
    return null;
  }
}

async function writeRememberedSession(session: DesktopRememberedAuthSession): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    if (!supportsDevFallbackStorage()) {
      throw new Error('Electron secure storage is unavailable on this system.');
    }

    await fs.writeFile(getDevAuthStorageFilePath(), JSON.stringify(session), {
      encoding: 'utf8',
      mode: 0o600,
    });
    return;
  }

  const serializedSession = JSON.stringify(session);
  const encryptedSession = safeStorage.encryptString(serializedSession);

  await fs.writeFile(getAuthStorageFilePath(), encryptedSession, {
    mode: 0o600,
  });
  await fs.rm(getDevAuthStorageFilePath(), {
    force: true,
  });
}

async function clearRememberedSession(): Promise<void> {
  await Promise.all([
    fs.rm(getAuthStorageFilePath(), {
      force: true,
    }),
    fs.rm(getDevAuthStorageFilePath(), {
      force: true,
    }),
  ]);
}

export function registerAuthStorageHandlers(): void {
  if (handlersRegistered) {
    return;
  }

  handlersRegistered = true;

  ipcMain.handle(AUTH_STORAGE_CHANNELS.isAvailable, () => {
    return safeStorage.isEncryptionAvailable() || supportsDevFallbackStorage();
  });

  ipcMain.handle(AUTH_STORAGE_CHANNELS.get, async () => {
    return readRememberedSession();
  });

  ipcMain.handle(AUTH_STORAGE_CHANNELS.set, async (_event, payload: unknown) => {
    validateRememberedSession(payload);
    await writeRememberedSession(payload);
  });

  ipcMain.handle(AUTH_STORAGE_CHANNELS.clear, async () => {
    await clearRememberedSession();
  });
}

export { AUTH_STORAGE_CHANNELS };
