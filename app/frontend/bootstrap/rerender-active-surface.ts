import {
  type AppI18n,
} from '@shared/i18n';

export type AppSurface = 'boot' | 'game' | 'loading' | 'login' | 'menu';

interface RerenderActiveSurfaceOptions {
  activeSurface: AppSurface;
  i18n: AppI18n;
  openProfileView: (nickname: string | null) => void;
  renderGamePage: () => void;
  renderLoginPage: () => void;
  renderMenuPage: () => void;
  router: {
    showBoot: (status: string) => void;
  };
}

export function rerenderActiveSurface(options: RerenderActiveSurfaceOptions): void {
  if (options.activeSurface === 'login') {
    options.renderLoginPage();
    return;
  }

  if (options.activeSurface === 'menu') {
    options.renderMenuPage();
    return;
  }

  if (options.activeSurface === 'game') {
    options.renderGamePage();
    return;
  }

  if (options.activeSurface === 'boot') {
    options.router.showBoot(options.i18n.t('boot.statuses.validatingRememberedSession'));
  }
}
