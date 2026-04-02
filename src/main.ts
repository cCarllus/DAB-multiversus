import { bootstrapApplication } from '@app/bootstrap/bootstrapApplication';
import { createElementFromTemplate } from '@app/utils/html';
import { createI18n, getInitialLocale } from '@shared/i18n';

import fatalScreenTemplate from '@app/bootstrap/fatal-screen.html?raw';
import './styles/global.css';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) {
  throw new Error('Application root element "#app" was not found.');
}

try {
  bootstrapApplication(appRoot);
} catch (error: unknown) {
  const i18n = createI18n(getInitialLocale());
  const messages = i18n.getMessages();

  console.error('Failed to bootstrap Dead As Battle Multiversus.', error);
  appRoot.replaceChildren(
    createElementFromTemplate(fatalScreenTemplate, {
      FATAL_DESCRIPTION: messages.fatal.description,
      FATAL_EYEBROW: messages.fatal.eyebrow,
      FATAL_TITLE: messages.fatal.title,
    }),
  );
}
