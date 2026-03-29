import type { AppRouteDefinition, AppRouteId } from '@shared/types/navigation';

export const APP_ROUTES: AppRouteDefinition[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Primary command deck and branded entry point.',
  },
  {
    id: 'play',
    label: 'Play',
    description: 'Future match flow, mode selection, and runtime handoff.',
  },
  {
    id: 'heroes',
    label: 'Heroes',
    description: 'Roster framing, fighter identity, and showcase staging.',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Audio behavior, shell diagnostics, and desktop runtime controls.',
  },
];

export const DEFAULT_ROUTE_ID: AppRouteId = 'home';

export function isAppRouteId(value: string | undefined): value is AppRouteId {
  return APP_ROUTES.some((route) => route.id === value);
}

export function getRouteDefinition(routeId: AppRouteId): AppRouteDefinition {
  const route = APP_ROUTES.find((candidate) => candidate.id === routeId);

  if (!route) {
    throw new Error(`Unknown application route: ${routeId}`);
  }

  return route;
}
