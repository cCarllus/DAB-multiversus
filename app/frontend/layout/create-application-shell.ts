import { createElementFromTemplate } from '@frontend/lib/html';

import applicationShellTemplate from './application-shell.html?raw';
import './application-shell.css';

export interface ApplicationShell {
  interactiveLayer: HTMLElement;
  setOverlay: (overlay: HTMLElement | null) => void;
  setPage: (page: HTMLElement) => void;
}

export function createApplicationShell(host: HTMLElement): ApplicationShell {
  const shell = createElementFromTemplate(applicationShellTemplate);

  host.replaceChildren(shell);

  const interactiveLayer = shell.querySelector<HTMLElement>('.app-layer');
  const pageStage = shell.querySelector<HTMLElement>('[data-page-stage]');
  const overlayStage = shell.querySelector<HTMLElement>('[data-overlay-stage]');

  if (!interactiveLayer || !pageStage || !overlayStage) {
    throw new Error('Application shell could not be initialized.');
  }

  return {
    interactiveLayer,
    setOverlay: (overlay) => {
      if (overlay) {
        overlayStage.replaceChildren(overlay);
        return;
      }

      overlayStage.replaceChildren();
    },
    setPage: (page) => {
      pageStage.replaceChildren(page);
    },
  };
}
