export type AppRouteId = 'home' | 'play' | 'heroes' | 'settings';

export interface AppRouteDefinition {
  id: AppRouteId;
  label: string;
  description: string;
}
