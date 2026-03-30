import { AppAudioManager } from '@app/audio/AppAudioManager';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createHomePage } from '@app/pages/home/createHomePage';
import { BabylonRuntime } from '@game/bootstrap/BabylonRuntime';
import type { DesktopBridge, DesktopWindowState } from '@shared/types/desktop';

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
    windowControls: {
      close: () => Promise.resolve(),
      getState: () => Promise.resolve({ isMaximized: false }),
      minimize: () => Promise.resolve(),
      onStateChange: () => () => undefined,
      toggleMaximize: () => Promise.resolve({ isMaximized: false }),
    },
  };
}

export function bootstrapApplication(host: HTMLElement): void {
  const desktop = window.desktop ?? createDesktopBridgeFallback();
  const shell = createApplicationShell(host);
  const audio = new AppAudioManager();
  const runtime = new BabylonRuntime(shell.canvas);
  let currentWindowState: DesktopWindowState = { isMaximized: false };
  let unsubscribeWindowControls: () => void = () => undefined;

  audio.bindInteractionSurface(shell.interactiveLayer);
  runtime.start();

  const renderHomePage = (): void => {
    shell.setPage(
      createHomePage({
        appVersion: __APP_VERSION__,
        audioMuted: audio.isMuted(),
        desktop,
      }),
    );

    syncWindowControlsState(shell.interactiveLayer, currentWindowState);
  };

  renderHomePage();

  void desktop.windowControls?.getState().then((state) => {
    currentWindowState = state;
    syncWindowControlsState(shell.interactiveLayer, state);
  });

  unsubscribeWindowControls =
    desktop.windowControls?.onStateChange((state) => {
      currentWindowState = state;
      syncWindowControlsState(shell.interactiveLayer, state);
    }) ?? (() => undefined);

  shell.interactiveLayer.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;

    if (action === 'toggle-mute') {
      audio.toggleMute();
      renderHomePage();
      return;
    }

    if (action === 'play-now') {
      audio.playTransitionCue('screen-shift');
      return;
    }

    if (action === 'window-minimize') {
      void desktop.windowControls?.minimize();
      return;
    }

    if (action === 'window-toggle-maximize') {
      void desktop.windowControls?.toggleMaximize().then((state) => {
        currentWindowState = state;
        syncWindowControlsState(shell.interactiveLayer, state);
      });
      return;
    }

    if (action === 'window-close') {
      void desktop.windowControls?.close();
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
    unsubscribeWindowControls();
    runtime.dispose();
  });
}

function syncWindowControlsState(root: HTMLElement, state: DesktopWindowState): void {
  const maximizeButton = root.querySelector<HTMLElement>('[data-window-maximize-button]');
  const expandIcon = root.querySelector<SVGElement>('[data-window-icon="expand"]');
  const restoreIcon = root.querySelector<SVGElement>('[data-window-icon="restore"]');

  if (!maximizeButton || !expandIcon || !restoreIcon) {
    return;
  }

  maximizeButton.setAttribute('aria-label', state.isMaximized ? 'Restore window' : 'Maximize window');
  maximizeButton.setAttribute('title', state.isMaximized ? 'Restore window' : 'Maximize window');
  maximizeButton.dataset.windowState = state.isMaximized ? 'maximized' : 'normal';
  expandIcon.classList.toggle('hidden', state.isMaximized);
  restoreIcon.classList.toggle('hidden', !state.isMaximized);
}
