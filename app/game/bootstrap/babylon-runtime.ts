import { Engine } from '@babylonjs/core';

import { createMenuScene, type MenuSceneHandle } from '@game/scenes/create-menu-scene';

export class BabylonRuntime {
  private engine: Engine | null = null;

  private menuScene: MenuSceneHandle | null = null;

  public constructor(private readonly canvas: HTMLCanvasElement) {}

  public dispose(): void {
    if (import.meta.env.DEV) {
      window.removeEventListener('keydown', this.handleInspectorHotkey);
    }

    window.removeEventListener('resize', this.handleResize);
    this.menuScene?.dispose();
    this.engine?.dispose();

    this.menuScene = null;
    this.engine = null;
  }

  public setPointerInfluence(x: number, y: number): void {
    this.menuScene?.atmosphere.setPointerInfluence(x, y);
  }

  public start(): void {
    this.engine = new Engine(this.canvas, true, {
      adaptToDeviceRatio: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.menuScene = createMenuScene(this.engine);
    this.engine.runRenderLoop(() => {
      this.menuScene?.scene.render();
    });

    window.addEventListener('resize', this.handleResize);

    if (import.meta.env.DEV) {
      window.addEventListener('keydown', this.handleInspectorHotkey);
    }
  }

  private readonly handleInspectorHotkey = (event: KeyboardEvent): void => {
    const shouldToggleInspector =
      event.shiftKey && (event.metaKey || event.ctrlKey) && event.code === 'KeyI';

    if (!shouldToggleInspector || !this.menuScene) {
      return;
    }

    const debugLayer = this.menuScene.scene.debugLayer;

    if (debugLayer.isVisible()) {
      void debugLayer.hide();
      return;
    }

    const inspectorModuleId = '@babylonjs/inspector';

    void import(/* @vite-ignore */ inspectorModuleId)
      .then(() => {
        void debugLayer.show({
          overlay: true,
        });
      })
      .catch((error: unknown) => {
        console.warn('Babylon inspector could not be loaded.', error);
      });
  };

  private readonly handleResize = (): void => {
    this.engine?.resize();
  };
}
