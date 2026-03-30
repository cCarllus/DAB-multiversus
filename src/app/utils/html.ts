export function createElementFromTemplate(
  templateSource: string,
  replacements: Record<string, string> = {},
): HTMLElement {
  let hydratedTemplate = templateSource;

  Object.entries(replacements).forEach(([key, value]) => {
    hydratedTemplate = hydratedTemplate.replaceAll(`__${key}__`, value);
  });

  const template = document.createElement('template');
  template.innerHTML = hydratedTemplate.trim();

  const rootElement = template.content.firstElementChild;

  if (!(rootElement instanceof HTMLElement)) {
    throw new Error('HTML template did not produce a valid root element.');
  }

  return rootElement;
}
