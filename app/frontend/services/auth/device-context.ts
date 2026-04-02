import { STORAGE_KEYS } from '@shared/constants/storage-keys';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';

export interface LauncherDeviceContext {
  appAgent: string;
  appVersion: string;
  deviceId: string;
  deviceName: string;
  osName: string;
  osVersion: string;
}

function generateDeviceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveStoredDeviceId(): string {
  try {
    const existingDeviceId = globalThis.localStorage?.getItem(STORAGE_KEYS.deviceId);

    if (existingDeviceId) {
      return existingDeviceId;
    }

    const nextDeviceId = generateDeviceId();
    globalThis.localStorage?.setItem(STORAGE_KEYS.deviceId, nextDeviceId);
    return nextDeviceId;
  } catch {
    return generateDeviceId();
  }
}

function resolveOsName(platform: string): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    case 'browser':
      return 'Browser';
    default:
      return platform || 'Unknown OS';
  }
}

export function createLauncherDeviceContext(
  desktop: DesktopBridge,
  appVersion: string,
): LauncherDeviceContext {
  const osName = resolveOsName(desktop.platform);
  const osVersion = desktop.osVersion || 'Unknown';

  return {
    appAgent: `Dead As Battle/${appVersion} Electron/${desktop.versions.electron} ${osName}/${osVersion}`,
    appVersion,
    deviceId: resolveStoredDeviceId(),
    deviceName: `Dead As Battle Launcher on ${osName}`,
    osName,
    osVersion,
  };
}
