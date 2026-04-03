import { AppApiError } from '@frontend/services/api/api-error';
import { type AuthService } from '@frontend/services/auth/auth-service';
import { type AuthUser } from '@frontend/services/auth/auth-types';
import { createLauncherDeviceContext } from '@frontend/services/auth/device-context';
import { ProfileApiClient } from '@frontend/services/profile/profile-api-client';
import type {
  ProfileDevicesPayload,
  ProfileSnapshot,
} from '@frontend/services/profile/profile.types';
import type { DesktopBridge } from '@shared/contracts/desktop.contract';

interface ProfileStoreOptions {
  apiClient?: ProfileApiClient;
  appVersion: string;
  authService: AuthService;
  desktop: DesktopBridge;
}

export class ProfileStore {
  private cachedDevices: ProfileDevicesPayload | null = null;

  private cachedProfile: AuthUser | null;

  private readonly apiClient: ProfileApiClient;

  private readonly deviceContext;

  constructor(private readonly options: ProfileStoreOptions) {
    this.apiClient = options.apiClient ?? new ProfileApiClient();
    this.deviceContext = createLauncherDeviceContext(options.desktop, options.appVersion);
    this.cachedProfile = this.normalizeProfile(options.authService.getCurrentSession()?.user ?? null);
  }

  getSnapshot(): ProfileSnapshot | null {
    if (!this.cachedProfile || !this.cachedDevices) {
      return null;
    }

    return {
      devices: this.cachedDevices,
      profile: this.cachedProfile,
    };
  }

  reset(): void {
    this.cachedDevices = null;
    this.cachedProfile = this.normalizeProfile(this.options.authService.getCurrentSession()?.user ?? null);
  }

  async load(force = false): Promise<ProfileSnapshot> {
    const accessToken = await this.requireAccessToken();
    const [profile, devices] = await Promise.all([
      !force && this.cachedProfile
        ? Promise.resolve(this.cachedProfile)
        : this.apiClient.getProfile(accessToken).then((value) => this.normalizeProfile(value)),
      !force && this.cachedDevices
        ? Promise.resolve(this.cachedDevices)
        : this.apiClient.getDevices(accessToken, this.deviceContext.deviceId),
    ]);

    this.cachedProfile = profile;
    this.cachedDevices = devices;
    this.options.authService.syncCurrentUser(profile);

    return {
      devices,
      profile,
    };
  }

  async updateName(name: string): Promise<ProfileSnapshot> {
    const accessToken = await this.requireAccessToken();
    const profile = this.normalizeProfile(
      await this.apiClient.updateProfile(accessToken, {
        name,
      }),
    );

    this.cachedProfile = profile;
    this.options.authService.syncCurrentUser(profile);

    return {
      devices: this.cachedDevices ?? (await this.load()).devices,
      profile,
    };
  }

  async uploadAvatar(file: File): Promise<ProfileSnapshot> {
    const accessToken = await this.requireAccessToken();
    const profile = this.normalizeProfile(await this.apiClient.uploadAvatar(accessToken, file));

    this.cachedProfile = profile;
    this.options.authService.syncCurrentUser(profile);

    return {
      devices: this.cachedDevices ?? (await this.load()).devices,
      profile,
    };
  }

  private normalizeProfile(profile: AuthUser): AuthUser;
  private normalizeProfile(profile: AuthUser | null): AuthUser | null;
  private normalizeProfile(profile: AuthUser | null): AuthUser | null {
    if (!profile) {
      return null;
    }

    return {
      ...profile,
      profileImageUrl: this.apiClient.resolveAssetUrl(profile.profileImageUrl),
    };
  }

  private async requireAccessToken(): Promise<string> {
    const accessToken = await this.options.authService.ensureAccessToken();

    if (!accessToken) {
      throw new AppApiError('UNAUTHENTICATED', 'No active session is available.');
    }

    return accessToken;
  }
}
