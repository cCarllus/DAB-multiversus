export function createPlayScreen(): HTMLElement {
  const screen = document.createElement('section');
  screen.className = 'screen screen--panel';
  screen.dataset.routeId = 'play';

  screen.innerHTML = `
    <div class="panel-shell">
      <span class="panel-kicker">Play routing</span>
      <h2 class="panel-title">Match launch starts here, not inside the menu layer.</h2>
      <p class="panel-copy">
        This screen is already reserved for mode selection, session setup, and the eventual handoff into a dedicated Babylon gameplay scene.
      </p>
      <div class="detail-list">
        <div class="detail-list__row">
          <span>Arena handshake</span>
          <strong>Wire the runtime bootstrap after mode selection is locked.</strong>
        </div>
        <div class="detail-list__row">
          <span>Modes</span>
          <strong>Skirmish, local versus, and scripted intro flow can branch from here.</strong>
        </div>
        <div class="detail-list__row">
          <span>Future seam</span>
          <strong>Menu state stays disposable once the active scene takes over.</strong>
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
        <button
          class="action-button action-button--ghost"
          type="button"
          data-route-target="settings"
        >
          Open Settings
        </button>
      </div>
    </div>
  `;

  return screen;
}
