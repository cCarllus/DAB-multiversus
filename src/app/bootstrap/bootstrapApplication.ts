import { AppAudioManager } from '@app/audio/AppAudioManager';
import { createApplicationShell } from '@app/layout/createApplicationShell';
import { createHomePage } from '@app/pages/home/createHomePage';
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
  const shell = createApplicationShell(host);
  const audio = new AppAudioManager();
  const runtime = new BabylonRuntime(shell.canvas);

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
  };

  renderHomePage();

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
