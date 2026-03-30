import { createElementFromTemplate } from '@app/utils/html';

import applicationShellTemplate from './application-shell.html?raw';
import './application-shell.css';

export interface ApplicationShell {
  canvas: HTMLCanvasElement;
  interactiveLayer: HTMLElement;
  setPage: (page: HTMLElement) => void;
}

export function createApplicationShell(host: HTMLElement): ApplicationShell {
  const shell = createElementFromTemplate(applicationShellTemplate);

  host.replaceChildren(shell);

  const canvas = shell.querySelector<HTMLCanvasElement>('.scene-layer__canvas');
  const interactiveLayer = shell.querySelector<HTMLElement>('.app-layer');
  const pageStage = shell.querySelector<HTMLElement>('[data-page-stage]');

  if (!canvas || !interactiveLayer || !pageStage) {
    throw new Error('Application shell could not be initialized.');
  }

  return {
    canvas,
    interactiveLayer,
    setPage: (page) => {
      pageStage.replaceChildren(page);
    },
  };
}
