import { ArcRotateCamera, Vector3, type Scene } from '@babylonjs/core';

export function createMenuCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'menu-camera',
    -Math.PI / 2.18,
    1.12,
    17.8,
    new Vector3(0, 1.45, 0),
    scene,
  );

  camera.fov = 0.82;
  camera.lowerRadiusLimit = 16;
  camera.upperRadiusLimit = 19.5;
  camera.allowUpsideDown = false;
  camera.wheelPrecision = 40;
  camera.panningSensibility = 0;
  camera.inputs.clear();

  return camera;
}
