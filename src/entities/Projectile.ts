import Phaser from 'phaser';
import type { Actor } from './Actor';
import type { GameWorldApi, ProjectileOpts } from './WorldApi';

/** Non-weapon ranged attacks: poison spit, sonic waves, energy orbs, webs and ground shockwaves. */
export class Projectile {
  x: number;
  y: number;
  z: number;
  dead = false;
  private age = 0;
  private sprite: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private hitIds = new Set<number>();
  private trailT = 0;
  readonly radius: number;
  readonly depth: number;

  constructor(private w: GameWorldApi, readonly o: ProjectileOpts) {
    this.x = o.x;
    this.y = o.y;
    this.z = o.z;
    this.radius = o.radius ?? 22;
    this.depth = o.depth ?? 22;
    const key = o.kind === 'sonic' ? 'fx-sonic' : o.kind === 'wave' ? 'fx-ring' : o.kind === 'ice' ? 'prop-icicle' : 'fx-orb';
    this.sprite = w.scene.add.image(o.x, o.y - o.z, key).setTint(o.color).setDepth(o.y + 1);
    if (o.kind === 'sonic') this.sprite.setScale(o.vx < 0 ? -1.4 : 1.4, 1.4).setBlendMode(Phaser.BlendModes.ADD);
    else if (o.kind === 'wave') this.sprite.setScale(0.9, 0.35).setBlendMode(Phaser.BlendModes.ADD);
    else if (o.kind === 'ice') this.sprite.setScale(0.6, -0.8).setOrigin(0.5, 0.05);
    else this.sprite.setScale(o.kind === 'web' ? 1.4 : 1.1).setBlendMode(o.kind === 'energy' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    this.shadow = w.scene.add.image(o.x, o.y, 'fx-shadow').setDepth(-5).setScale(0.6, 0.5).setAlpha(o.z > 0 ? 0.5 : 0);
  }

  update(dt: number, targets: Actor[]): void {
    const s = dt / 1000;
    this.age += dt;
    this.x += this.o.vx * s;
    this.y += (this.o.vy ?? 0) * s;
    if (this.age > (this.o.lifeMs ?? 2600) || this.x < this.w.camLeft - 100 || this.x > this.w.camRight + 100) {
      this.destroy();
      return;
    }
    this.sprite.setPosition(this.x, this.y - this.z).setDepth(this.y + 1);
    this.shadow.setPosition(this.x, this.y);
    if (this.o.kind !== 'ice' && this.o.kind !== 'wave') this.sprite.rotation += s * 6;
    this.trailT += dt;
    if (this.trailT > 60) {
      this.trailT = 0;
      if (this.o.kind === 'wave') this.w.fx.dust(this.x, this.y, 2);
      if (this.o.kind === 'ice') {
        const spike = this.w.scene.add.image(this.x, this.y, 'prop-icicle').setOrigin(0.5, 0.05).setScale(0.5, -0.7).setDepth(this.y).setAlpha(0.9);
        this.w.scene.tweens.add({ targets: spike, alpha: 0, scaleY: -0.2, duration: 600, onComplete: () => spike.destroy() });
      }
    }
    for (const t of targets) {
      if (!t.alive || this.hitIds.has(t.id)) continue;
      if (Math.abs(t.x - this.x) > this.radius + t.halfWidth) continue;
      if (Math.abs(t.y - this.y) > this.depth + t.halfDepth) continue;
      // ground waves can be jumped over; aerial shots need body overlap
      if (this.z <= 10 ? t.z > 48 : this.z < t.z - 20 || this.z > t.z + t.height) continue;
      if (t.isInvulnerable) {
        (t as Actor & { onAttackedWhileInvulnerable?: () => void }).onAttackedWhileInvulnerable?.();
        continue;
      }
      this.hitIds.add(t.id);
      const res = t.receiveHit({
        attackerId: this.o.owner.id,
        attackerX: this.x,
        dirX: this.o.vx >= 0 ? 1 : -1,
        damage: this.o.damage,
        knockback: this.o.launch ? 260 : 120,
        launch: !!this.o.launch,
        stunMs: 0,
        slowMs: this.o.slowMs ?? 0,
        grab: false,
        breaksArmor: false,
        heavy: !!this.o.launch,
        color: this.o.color,
        freezeMs: this.o.kind === 'ice' ? 900 : undefined,
      });
      if (res.landed) this.w.fx.hitSpark(this.x, this.y - Math.max(this.z, 60), this.o.color, false);
      if (!this.o.pierce) {
        this.destroy();
        return;
      }
    }
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
