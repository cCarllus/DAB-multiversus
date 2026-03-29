import { AppAudioManager } from '@app/audio/AppAudioManager';
import { createApplicationShell, getRouteTarget } from '@app/layout/createApplicationShell';
import { AppNavigator } from '@app/navigation/AppNavigator';
import {
  APP_ROUTES,
  DEFAULT_ROUTE_ID,
  getRouteDefinition,
  isAppRouteId,
} from '@app/navigation/routes';
import { SCREEN_REGISTRY } from '@app/screens';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import type { DesktopBridge } from '@shared/types/desktop';

function createDesktopBridgeFallback(): DesktopBridge {
  return {
    environment: import.meta.env.DEV ? 'development' : 'production',
    isPackaged: false,
    platform: 'browser',
    versions: {
      chrome: 'web',
      electron: 'web',
      node: 'web',
    },
  };
}

export function bootstrapApplication(host: HTMLElement): void {
  const desktop = window.desktop ?? createDesktopBridgeFallback();
  const shell = createApplicationShell(host, APP_ROUTES, desktop, __APP_VERSION__);
  const navigator = new AppNavigator(APP_ROUTES, DEFAULT_ROUTE_ID);
  const audio = new AppAudioManager();
  const runtime = new BabylonRuntime(shell.canvas);

  audio.bindInteractionSurface(shell.interactiveLayer);
  runtime.start();

  const renderRoute = (): void => {
    const currentRoute = navigator.currentRoute;
    const routeDefinition = getRouteDefinition(currentRoute);
    const screen = SCREEN_REGISTRY[currentRoute]({
      appVersion: __APP_VERSION__,
      audioMuted: audio.isMuted(),
      desktop,
    });

    shell.setActiveRoute(routeDefinition);
    shell.setScreen(screen);
  };

  navigator.subscribe((currentRoute, previousRoute) => {
    if (previousRoute && previousRoute !== currentRoute) {
      audio.playTransitionCue('screen-shift');
    }

    renderRoute();
  }, true);

  shell.interactiveLayer.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const routeTarget = getRouteTarget(target);

    if (routeTarget && isAppRouteId(routeTarget)) {
      navigator.navigate(routeTarget);
      return;
    }

    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'toggle-mute') {
      audio.toggleMute();
      renderRoute();
    }
  });

  shell.interactiveLayer.addEventListener('pointermove', (event) => {
    const bounds = shell.interactiveLayer.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const normalizedY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    runtime.setPointerInfluence(normalizedX, normalizedY);
  });

  shell.interactiveLayer.addEventListener('pointerleave', () => {
    runtime.setPointerInfluence(0, 0);
  });

  window.addEventListener('beforeunload', () => {
    runtime.dispose();
  });
}
