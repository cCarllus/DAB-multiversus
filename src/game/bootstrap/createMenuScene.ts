import {
  Color3,
  GlowLayer,
  HemisphericLight,
  Scene,
  SceneInstrumentation,
  Vector3,
  type Engine,
} from '@babylonjs/core';

import { createMenuCamera } from '@game/camera/createMenuCamera';
import { MenuAtmosphereSystem } from '@game/systems/MenuAtmosphereSystem';
import { createMenuWorld } from '@game/world/createMenuWorld';

export interface MenuSceneHandle {
  atmosphere: MenuAtmosphereSystem;
  dispose: () => void;
  scene: Scene;
}

export function createMenuScene(engine: Engine): MenuSceneHandle {
  const scene = new Scene(engine);
  const camera = createMenuCamera(scene);
  const world = createMenuWorld(scene);

  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(0.02, 0.04, 0.08);
  scene.imageProcessingConfiguration.exposure = 1.12;
  scene.imageProcessingConfiguration.contrast = 1.1;

  const fillLight = new HemisphericLight('menu-fill-light', new Vector3(0, 1, 0), scene);
  fillLight.intensity = 0.78;
  fillLight.diffuse = new Color3(0.6, 0.76, 1);
  fillLight.groundColor = new Color3(0.08, 0.06, 0.1);

  const glowLayer = new GlowLayer('menu-glow-layer', scene);
  glowLayer.intensity = 0.85;

  const atmosphere = new MenuAtmosphereSystem(camera, world);
  const instrumentation = new SceneInstrumentation(scene);
  instrumentation.captureActiveMeshesEvaluationTime = false;
  instrumentation.captureFrameTime = false;
  instrumentation.captureRenderTime = false;

  scene.onBeforeRenderObservable.add(() => {
    atmosphere.update(engine.getDeltaTime() * 0.001);
  });

  return {
    atmosphere,
    dispose: () => {
      instrumentation.dispose();
      glowLayer.dispose();
      scene.dispose();
    },
    scene,
  };
}
