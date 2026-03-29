import type { AppRouteDefinition, AppRouteId } from '@shared/types/navigation';
import type { DesktopBridge } from '@shared/types/desktop';

import { PRODUCT_CONFIG } from '@shared/config/productConfig';

export interface ApplicationShell {
  canvas: HTMLCanvasElement;
  interactiveLayer: HTMLElement;
  screenStage: HTMLElement;
  setActiveRoute: (route: AppRouteDefinition) => void;
  setScreen: (screen: HTMLElement) => void;
}

export function createApplicationShell(
  host: HTMLElement,
  routes: AppRouteDefinition[],
  desktop: DesktopBridge,
  appVersion: string,
): ApplicationShell {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  shell.innerHTML = `
    <div class="scene-layer">
      <canvas
        class="scene-layer__canvas"
        aria-hidden="true"
      ></canvas>
      <div class="scene-layer__wash"></div>
      <div class="scene-layer__scanlines"></div>
    </div>
    <div class="shell-ui">
      <header class="shell-header">
        <div class="shell-brand">
          <div class="shell-brand__mark">DAB</div>
          <div class="shell-brand__copy">
            <span class="shell-brand__title">${PRODUCT_CONFIG.title}</span>
            <span class="shell-brand__subtitle">${PRODUCT_CONFIG.shellLabel}</span>
          </div>
        </div>
        <nav
          class="shell-nav"
          aria-label="Primary"
        >
          ${routes
            .map(
              (route) => `
                <button
                  class="shell-nav__button"
                  type="button"
                  data-route-target="${route.id}"
                >
                  ${route.label}
                </button>
              `,
            )
            .join('')}
        </nav>
      </header>
      <main class="shell-main">
        <div class="route-summary">
          <span class="route-summary__label" data-route-label></span>
          <p class="route-summary__description" data-route-description></p>
        </div>
        <section
          class="screen-stage"
          data-screen-stage
        ></section>
      </main>
      <footer class="shell-footer">
        <div class="footer-slot">
          <span class="footer-slot__label">Player imprint</span>
          <strong class="footer-slot__value">Awaiting profile sync</strong>
        </div>
        <div class="footer-slot">
          <span class="footer-slot__label">Runtime</span>
          <strong class="footer-slot__value">${desktop.platform} / Electron ${desktop.versions.electron}</strong>
        </div>
        <div class="footer-slot footer-slot--right">
          <span class="footer-slot__label">Build</span>
          <strong class="footer-slot__value">v${appVersion}</strong>
        </div>
      </footer>
    </div>
  `;

  host.replaceChildren(shell);

  const canvas = shell.querySelector<HTMLCanvasElement>('.scene-layer__canvas');
  const interactiveLayer = shell.querySelector<HTMLElement>('.shell-ui');
  const screenStage = shell.querySelector<HTMLElement>('[data-screen-stage]');
  const routeLabel = shell.querySelector<HTMLElement>('[data-route-label]');
  const routeDescription = shell.querySelector<HTMLElement>('[data-route-description]');
  const navButtons = shell.querySelectorAll<HTMLButtonElement>('.shell-nav__button');

  if (!canvas || !interactiveLayer || !screenStage || !routeLabel || !routeDescription) {
    throw new Error('Application shell could not be initialized.');
  }

  return {
    canvas,
    interactiveLayer,
    screenStage,
    setActiveRoute: (route) => {
      routeLabel.textContent = route.label;
      routeDescription.textContent = route.description;

      navButtons.forEach((button) => {
        const isActive = button.dataset.routeTarget === route.id;
        button.classList.toggle('is-active', isActive);

        if (isActive) {
          button.setAttribute('aria-current', 'page');
        } else {
          button.removeAttribute('aria-current');
        }
      });
    },
    setScreen: (screen) => {
      screen.dataset.routeId = screen.dataset.routeId ?? 'screen';
      screenStage.replaceChildren(screen);
    },
  };
}

export function getRouteTarget(source: HTMLElement | null): AppRouteId | null {
  const routeTarget = source?.closest<HTMLElement>('[data-route-target]')?.dataset.routeTarget;
  return routeTarget ? (routeTarget as AppRouteId) : null;
}
