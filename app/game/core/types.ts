import type { Mesh, TransformNode, Vector3 } from '@babylonjs/core';

export interface FloatingShard {
  basePosition: Vector3;
  driftOffset: number;
  pivot: TransformNode;
  speed: number;
}

export interface MenuWorld {
  core: Mesh;
  focalPoint: TransformNode;
  innerRing: Mesh;
  outerRing: Mesh;
  root: TransformNode;
  shards: FloatingShard[];
}
