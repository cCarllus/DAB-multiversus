const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

interface CreateSvgIconOptions {
  ariaHidden?: boolean;
  className?: string;
  focusable?: boolean;
}

export function createSvgIcon(
  iconId: string,
  options: CreateSvgIconOptions = {},
): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  const use = document.createElementNS(SVG_NAMESPACE, 'use');

  if (options.className) {
    icon.setAttribute('class', options.className);
  }

  icon.setAttribute('aria-hidden', String(options.ariaHidden ?? true));
  icon.setAttribute('focusable', String(options.focusable ?? false));
  use.setAttribute('href', `#${iconId}`);
  icon.append(use);

  return icon;
}
