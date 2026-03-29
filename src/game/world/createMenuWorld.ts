import {
  Color3,
  Color4,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';

import type { FloatingShard, MenuWorld } from '@game/core/types';

export function createMenuWorld(scene: Scene): MenuWorld {
  const root = new TransformNode('menu-world-root', scene);
  const focalPoint = new TransformNode('menu-world-focus', scene);
  focalPoint.parent = root;
  focalPoint.position = new Vector3(0, 1.45, 0);

  const sky = MeshBuilder.CreateSphere(
    'menu-sky',
    {
      diameter: 74,
      segments: 24,
    },
    scene,
  );
  sky.parent = root;
  sky.scaling = new Vector3(1, 0.7, 1);

  const skyMaterial = new StandardMaterial('menu-sky-material', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableLighting = true;
  skyMaterial.emissiveColor = new Color3(0.06, 0.09, 0.14);
  skyMaterial.alpha = 0.92;
  sky.material = skyMaterial;

  const floor = MeshBuilder.CreateGround(
    'menu-floor',
    {
      width: 44,
      height: 44,
      subdivisions: 4,
    },
    scene,
  );
  floor.parent = root;
  floor.position.y = -2.45;

  const gridMaterial = new GridMaterial('menu-grid-material', scene);
  gridMaterial.mainColor = new Color3(0.03, 0.04, 0.08);
  gridMaterial.lineColor = new Color3(0.38, 0.9, 1);
  gridMaterial.opacity = 0.36;
  gridMaterial.gridRatio = 1.8;
  gridMaterial.majorUnitFrequency = 8;
  floor.material = gridMaterial;

  const platform = MeshBuilder.CreateCylinder(
    'menu-platform',
    {
      diameter: 8.8,
      height: 0.22,
      tessellation: 64,
    },
    scene,
  );
  platform.parent = root;
  platform.position.y = -1.58;

  const platformMaterial = new StandardMaterial('menu-platform-material', scene);
  platformMaterial.diffuseColor = new Color3(0.06, 0.08, 0.12);
  platformMaterial.emissiveColor = new Color3(0.05, 0.11, 0.18);
  platform.material = platformMaterial;

  const outerRing = MeshBuilder.CreateTorus(
    'menu-ring-outer',
    {
      diameter: 7.4,
      thickness: 0.16,
      tessellation: 96,
    },
    scene,
  );
  outerRing.parent = root;
  outerRing.position.y = 1.3;
  outerRing.rotation.x = Math.PI / 2;

  const innerRing = MeshBuilder.CreateTorus(
    'menu-ring-inner',
    {
      diameter: 5.4,
      thickness: 0.1,
      tessellation: 96,
    },
    scene,
  );
  innerRing.parent = root;
  innerRing.position.y = 1.3;
  innerRing.rotation.x = Math.PI / 2;

  const ringMaterial = new StandardMaterial('menu-ring-material', scene);
  ringMaterial.diffuseColor = new Color3(0.08, 0.12, 0.18);
  ringMaterial.emissiveColor = new Color3(0.15, 0.82, 1);
  outerRing.material = ringMaterial;
  innerRing.material = ringMaterial;

  const core = MeshBuilder.CreateSphere(
    'menu-core',
    {
      diameter: 1.55,
      segments: 24,
    },
    scene,
  );
  core.parent = root;
  core.position = new Vector3(0, 1.3, 0);

  const coreMaterial = new StandardMaterial('menu-core-material', scene);
  coreMaterial.diffuseColor = new Color3(0.12, 0.05, 0.03);
  coreMaterial.emissiveColor = new Color3(1, 0.45, 0.18);
  core.material = coreMaterial;

  const accentLight = new PointLight('menu-accent-light', new Vector3(0, 1.35, 0), scene);
  accentLight.diffuse = new Color3(1, 0.55, 0.24);
  accentLight.intensity = 16;
  accentLight.range = 18;

  const cyanLight = new PointLight('menu-cyan-light', new Vector3(-8, 7, -5), scene);
  cyanLight.diffuse = new Color3(0.36, 0.86, 1);
  cyanLight.intensity = 9;
  cyanLight.range = 32;

  const shardMaterial = new StandardMaterial('menu-shard-material', scene);
  shardMaterial.diffuseColor = new Color3(0.05, 0.08, 0.14);
  shardMaterial.emissiveColor = new Color3(0.7, 0.82, 1);
  shardMaterial.alpha = 0.86;

  const shards: FloatingShard[] = Array.from({ length: 14 }, (_, index) => {
    const pivot = new TransformNode(`menu-shard-pivot-${index}`, scene);
    pivot.parent = root;

    const angle = (Math.PI * 2 * index) / 14;
    const radius = 5.2 + (index % 3) * 0.75;
    const basePosition = new Vector3(
      Math.cos(angle) * radius,
      -0.4 + (index % 4) * 0.68,
      Math.sin(angle) * radius,
    );

    pivot.position = basePosition.clone();

    const shard = MeshBuilder.CreatePolyhedron(
      `menu-shard-${index}`,
      {
        size: 0.48 + (index % 3) * 0.12,
        type: 2,
      },
      scene,
    );
    shard.material = shardMaterial;
    shard.parent = pivot;
    shard.rotation = new Vector3(index * 0.32, index * 0.18, index * 0.24);
    shard.scaling = new Vector3(0.42, 1.55, 0.34 + (index % 2) * 0.2);
    shard.position.y = index % 2 === 0 ? 0.35 : -0.2;

    return {
      basePosition,
      driftOffset: index * 0.55,
      pivot,
      speed: 0.14 + index * 0.012,
    };
  });

  const skyline = MeshBuilder.CreateBox(
    'menu-skyline',
    {
      width: 16,
      height: 4.6,
      depth: 0.18,
    },
    scene,
  );
  skyline.parent = root;
  skyline.position = new Vector3(0, -0.2, 13.5);

  const skylineMaterial = new StandardMaterial('menu-skyline-material', scene);
  skylineMaterial.diffuseColor = new Color3(0.03, 0.05, 0.08);
  skylineMaterial.emissiveColor = new Color3(0.07, 0.11, 0.18);
  skylineMaterial.alpha = 0.34;
  skyline.material = skylineMaterial;

  scene.clearColor = new Color4(0.01, 0.02, 0.04, 1);

  return {
    core,
    focalPoint,
    innerRing,
    outerRing,
    root,
    shards,
  };
}
