import type { AppRouteId } from '@shared/types/navigation';
import type { DesktopBridge } from '@shared/types/desktop';

import { createHeroesScreen } from '@app/screens/createHeroesScreen';
import { createHomeScreen } from '@app/screens/createHomeScreen';
import { createPlayScreen } from '@app/screens/createPlayScreen';
import { createSettingsScreen } from '@app/screens/createSettingsScreen';

export interface ScreenContext {
  appVersion: string;
  audioMuted: boolean;
  desktop: DesktopBridge;
}

export const SCREEN_REGISTRY: Record<AppRouteId, (context: ScreenContext) => HTMLElement> = {
  home: () => createHomeScreen(),
  play: () => createPlayScreen(),
  heroes: () => createHeroesScreen(),
  settings: (context) =>
    createSettingsScreen({
      appVersion: context.appVersion,
      audioMuted: context.audioMuted,
      desktop: context.desktop,
    }),
};
