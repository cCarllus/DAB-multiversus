import { Scalar, Vector3, type ArcRotateCamera } from '@babylonjs/core';

import type { MenuWorld } from '@game/core/types';

export class MenuAtmosphereSystem {
  private readonly pointerCurrent = new Vector3(0, 0, 0);

  private readonly pointerTarget = new Vector3(0, 0, 0);

  private time = 0;

  public constructor(
    private readonly camera: ArcRotateCamera,
    private readonly world: MenuWorld,
  ) {}

  public setPointerInfluence(x: number, y: number): void {
    this.pointerTarget.set(Scalar.Clamp(x, -1, 1), Scalar.Clamp(y, -1, 1), 0);
  }

  public update(deltaSeconds: number): void {
    this.time += deltaSeconds;

    this.pointerCurrent.x = Scalar.Lerp(this.pointerCurrent.x, this.pointerTarget.x, deltaSeconds * 2.8);
    this.pointerCurrent.y = Scalar.Lerp(this.pointerCurrent.y, this.pointerTarget.y, deltaSeconds * 2.8);

    this.camera.alpha = -Math.PI / 2.18 + Math.sin(this.time * 0.18) * 0.08 + this.pointerCurrent.x * 0.18;
    this.camera.beta = 1.12 + Math.cos(this.time * 0.24) * 0.035 - this.pointerCurrent.y * 0.08;
    this.camera.radius = 17.8 + Math.sin(this.time * 0.12) * 0.24;
    this.camera.setTarget(
      Vector3.Lerp(
        this.camera.target,
        new Vector3(this.pointerCurrent.x * 1.2, 1.42 + this.pointerCurrent.y * 0.38, 0),
        deltaSeconds * 2.2,
      ),
    );

    this.world.outerRing.rotation.z += deltaSeconds * 0.17;
    this.world.innerRing.rotation.z -= deltaSeconds * 0.22;
    this.world.root.rotation.y = Math.sin(this.time * 0.08) * 0.09;
    this.world.core.scaling.setAll(1 + Math.sin(this.time * 2.2) * 0.08);
    this.world.core.position.y = 1.3 + Math.sin(this.time * 1.4) * 0.18;

    this.world.shards.forEach((shard, index) => {
      shard.pivot.position.y =
        shard.basePosition.y + Math.sin(this.time * (1.2 + shard.speed) + shard.driftOffset) * 0.38;
      shard.pivot.rotation.y += deltaSeconds * shard.speed;
      shard.pivot.rotation.z = Math.sin(this.time * 0.6 + index) * 0.16;
    });
  }
}
