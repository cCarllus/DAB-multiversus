import type { AppRouteDefinition, AppRouteId } from '@shared/types/navigation';

type NavigationListener = (currentRoute: AppRouteId, previousRoute: AppRouteId | null) => void;

export class AppNavigator {
  private readonly listeners = new Set<NavigationListener>();

  private readonly routeIds: ReadonlySet<AppRouteId>;

  private activeRoute: AppRouteId;

  public constructor(routes: AppRouteDefinition[], initialRoute: AppRouteId) {
    this.routeIds = new Set(routes.map((route) => route.id));
    this.activeRoute = initialRoute;
  }

  public get currentRoute(): AppRouteId {
    return this.activeRoute;
  }

  public navigate(routeId: AppRouteId): void {
    if (!this.routeIds.has(routeId) || routeId === this.activeRoute) {
      return;
    }

    const previousRoute = this.activeRoute;
    this.activeRoute = routeId;

    this.listeners.forEach((listener) => {
      listener(routeId, previousRoute);
    });
  }

  public subscribe(listener: NavigationListener, emitImmediately = false): () => void {
    this.listeners.add(listener);

    if (emitImmediately) {
      listener(this.activeRoute, null);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }
}
