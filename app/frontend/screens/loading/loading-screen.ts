import { createElementFromTemplate } from '@frontend/lib/html';
import titleGameNameImage from '@assets/images/ui/icons/title-game-name.png';
import type { AppI18n } from '@shared/i18n';

import loadingScreenTemplate from './loading-screen.html?raw';
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

export function createLoadingScreen(options: LoadingScreenOptions): LoadingScreenHandle {
  const messages = options.i18n.getMessages();
  const rootElement = createElementFromTemplate(loadingScreenTemplate, {
    LOADING_BRAND_ALT: messages.common.brandAlt,
    LOADING_SCREEN_ARIA_LABEL: messages.loading.screenAriaLabel,
  });

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
