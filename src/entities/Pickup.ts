import Phaser from 'phaser';
import type { Player } from './Player';
import type { GameWorldApi } from './WorldApi';

export type PickupKind = 'health' | 'energy' | 'token';

export const PICKUP_VALUES = { health: 25, energy: 20, token: 100 } as const;

/** Health Orb (+25 HP), Energy Orb (+20 EN), Score Token (+100) — GDD §6.5. No weapons. */
export class Pickup {
  dead = false;
  private age = 0;
  private img: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private z = 40;
  private vz = 380;
  private vx: number;

  constructor(private w: GameWorldApi, readonly kind: PickupKind, public x: number, public y: number) {
    // pixel-art icons from the user's UI pack when available
    const icon = `icon-${kind}`;
    this.img = w.scene.textures.exists(icon) ? w.scene.add.image(x, y, icon).setScale(0.85) : w.scene.add.image(x, y, `pickup-${kind}`).setScale(0.75);
    this.shadow = w.scene.add.image(x, y, 'fx-shadow').setScale(0.5, 0.4).setDepth(-5);
    this.vx = Phaser.Math.Between(-90, 90);
  }

  update(dt: number): void {
    const s = dt / 1000;
    this.age += dt;
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 1600 * s;
      this.z = Math.max(0, this.z + this.vz * s);
      this.x += this.vx * s;
      if (this.z === 0) this.vz = 0;
    }
    const bob = this.z === 0 ? 10 + Math.sin(this.age / 200) * 5 : 10;
    this.img.setPosition(this.x, this.y - this.z - bob).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y);
    if (this.age > 9000) this.img.setAlpha(Math.floor(this.age / 120) % 2 ? 0.3 : 1);
    if (this.age > 12000) {
      this.destroy();
      return;
    }
    if (this.age <= 300) return;
    const p = this.w.players.find((q) => q.alive && Math.abs(q.x - this.x) < 46 && Math.abs(q.y - this.y) < 30 && q.z < 60);
    if (p) this.collect(p);
  }

  private collect(p: Player): void {
    if (this.kind === 'health') {
      p.heal(PICKUP_VALUES.health);
      this.w.fx.text(this.x, this.y - 70, `+${PICKUP_VALUES.health} HP`, '#ff8fa3', 26);
      this.w.audio.play('pickup');
    } else if (this.kind === 'energy') {
      p.energy.add(PICKUP_VALUES.energy);
      this.w.fx.text(this.x, this.y - 70, `+${PICKUP_VALUES.energy} EN`, '#8fd0ff', 26);
      this.w.audio.play('pickup');
    } else {
      this.w.addScore(PICKUP_VALUES.token);
      this.w.fx.text(this.x, this.y - 70, `+${PICKUP_VALUES.token}`, '#ffd23f', 26);
      this.w.audio.play('coin');
    }
    this.destroy();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.img.destroy();
    this.shadow.destroy();
  }
}
