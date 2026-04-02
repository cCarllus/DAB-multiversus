import { createElementFromTemplate } from '@frontend/lib/html';

import applicationShellTemplate from './application-shell.html?raw';
import './application-shell.css';

export interface ApplicationShell {
  interactiveLayer: HTMLElement;
  setPage: (page: HTMLElement) => void;
}

export function createApplicationShell(host: HTMLElement): ApplicationShell {
  const shell = createElementFromTemplate(applicationShellTemplate);

  host.replaceChildren(shell);

  const interactiveLayer = shell.querySelector<HTMLElement>('.app-layer');
  const pageStage = shell.querySelector<HTMLElement>('[data-page-stage]');

  if (!interactiveLayer || !pageStage) {
    throw new Error('Application shell could not be initialized.');
  }

  return {
    interactiveLayer,
    setPage: (page) => {
      pageStage.replaceChildren(page);
    },
  };
}
