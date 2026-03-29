import type { DesktopBridge } from '@shared/types/desktop';

interface SettingsScreenOptions {
  appVersion: string;
  audioMuted: boolean;
  desktop: DesktopBridge;
}

export function createSettingsScreen(options: SettingsScreenOptions): HTMLElement {
  const screen = document.createElement('section');
  screen.className = 'screen screen--panel';
  screen.dataset.routeId = 'settings';

  const inspectorHint =
    options.desktop.environment === 'development'
      ? 'Use Ctrl/Cmd + Shift + I to open the Babylon inspector during development.'
      : 'Inspector loading is reserved for development builds.';

  screen.innerHTML = `
    <div class="panel-shell">
      <span class="panel-kicker">Shell controls</span>
      <h2 class="panel-title">Audio, diagnostics, and desktop metadata are exposed from one place.</h2>
      <p class="panel-copy">
        Keep shell-level preferences here so they do not leak into the future gameplay runtime.
      </p>
      <div class="detail-list">
        <div class="detail-list__row detail-list__row--action">
          <span>Menu audio</span>
          <button
            class="action-button action-button--ghost action-button--compact"
            type="button"
            data-action="toggle-mute"
            aria-pressed="${options.audioMuted}"
          >
            ${options.audioMuted ? 'Unmute shell' : 'Mute shell'}
          </button>
        </div>
        <div class="detail-list__row">
          <span>Build channel</span>
          <strong>${options.desktop.environment} / v${options.appVersion}</strong>
        </div>
        <div class="detail-list__row">
          <span>Packaging state</span>
          <strong>${options.desktop.isPackaged ? 'Packaged desktop build' : 'Development runtime'}</strong>
        </div>
        <div class="detail-list__row">
          <span>Diagnostics</span>
          <strong>${inspectorHint}</strong>
        </div>
      </div>
      <div class="panel-actions">
        <button
          class="action-button action-button--primary"
          type="button"
          data-route-target="home"
        >
          Return Home
        </button>
      </div>
    </div>
  `;

  return screen;
}
