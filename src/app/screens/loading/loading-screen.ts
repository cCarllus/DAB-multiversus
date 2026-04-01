import { createElementFromTemplate } from '@app/utils/html';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import type { AppI18n } from '@shared/i18n';

import './loading-screen.css';

export interface LoadingScreenOptions {
  appVersion: string;
  detail?: string;
  eyebrow: string;
  i18n: AppI18n;
  progress: number;
  status: string;
  title?: string;
}

export interface LoadingScreenHandle {
  element: HTMLElement;
  setState: (nextState: Partial<LoadingScreenOptions>) => void;
}

function clampProgress(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

export function createLoadingScreen(
  options: LoadingScreenOptions,
): LoadingScreenHandle {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(`
    <section class="loading-screen" aria-label="${messages.loading.screenAriaLabel}">
      <div class="loading-screen__vignette" aria-hidden="true"></div>
      <div class="loading-screen__sunburst" aria-hidden="true"></div>
      <div class="loading-screen__horizon" aria-hidden="true"></div>
      <span class="loading-screen__diamond loading-screen__diamond--left" aria-hidden="true"></span>
      <span class="loading-screen__diamond loading-screen__diamond--right" aria-hidden="true"></span>

      <div class="loading-screen__stage">
        <div class="loading-screen__ring loading-screen__ring--outer" aria-hidden="true"></div>
        <div class="loading-screen__ring loading-screen__ring--mid" aria-hidden="true"></div>
        <div class="loading-screen__ring loading-screen__ring--inner" aria-hidden="true"></div>
        <div class="loading-screen__ring-markers loading-screen__ring-markers--mid" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="loading-screen__ring-markers loading-screen__ring-markers--outer" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="loading-screen__energy loading-screen__energy--blue" aria-hidden="true"></div>
        <div class="loading-screen__energy loading-screen__energy--red" aria-hidden="true"></div>

        <div class="loading-screen__content">
          <img class="loading-screen__brand" data-loading-brand alt="${messages.common.brandAlt}" />
          <p class="loading-screen__eyebrow" data-loading-eyebrow></p>
          <h1 class="loading-screen__title" data-loading-title></h1>
          <p class="loading-screen__status" data-loading-status></p>
          <div class="loading-screen__progress" aria-hidden="true">
            <span class="loading-screen__progress-fill" data-loading-progress-fill></span>
            <span class="loading-screen__progress-glow"></span>
          </div>
          <div class="loading-screen__meta">
            <span class="loading-screen__percent" data-loading-progress-label></span>
            <span class="loading-screen__detail" data-loading-detail></span>
          </div>
          <span class="loading-screen__version" data-loading-version></span>
        </div>
      </div>
    </section>
  `);

  const brandElement = rootElement.querySelector<HTMLImageElement>('[data-loading-brand]');
  const eyebrowElement = rootElement.querySelector<HTMLElement>('[data-loading-eyebrow]');
  const titleElement = rootElement.querySelector<HTMLElement>('[data-loading-title]');
  const statusElement = rootElement.querySelector<HTMLElement>('[data-loading-status]');
  const progressFillElement = rootElement.querySelector<HTMLElement>(
    '[data-loading-progress-fill]',
  );
  const progressLabelElement = rootElement.querySelector<HTMLElement>(
    '[data-loading-progress-label]',
  );
  const detailElement = rootElement.querySelector<HTMLElement>('[data-loading-detail]');
  const versionElement = rootElement.querySelector<HTMLElement>('[data-loading-version]');

  if (
    !brandElement ||
    !eyebrowElement ||
    !titleElement ||
    !statusElement ||
    !progressFillElement ||
    !progressLabelElement ||
    !detailElement ||
    !versionElement
  ) {
    throw new Error('Loading screen could not be initialized.');
  }

  brandElement.src = titleGameNameImage;

  let currentState: LoadingScreenOptions = {
    ...options,
    title: options.title ?? messages.loading.defaultTitle,
  };

  const applyState = (state: LoadingScreenOptions): void => {
    const progress = clampProgress(state.progress);

    eyebrowElement.textContent = state.eyebrow;
    titleElement.textContent = state.title ?? messages.loading.defaultTitle;
    statusElement.textContent = state.status;
    detailElement.textContent = state.detail ?? '';
    detailElement.hidden = !state.detail;
    progressFillElement.style.transform = `scaleX(${progress})`;
    progressLabelElement.textContent = `${Math.round(progress * 100)}%`;
    versionElement.textContent = `v${state.appVersion}`;
  };

  applyState(currentState);

  return {
    element: rootElement,
    setState(nextState) {
      currentState = {
        ...currentState,
        ...nextState,
      };
      applyState(currentState);
    },
  };
}
