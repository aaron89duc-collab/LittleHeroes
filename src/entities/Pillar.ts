import Phaser from 'phaser';
import { FONT } from '../game/constants';
import type { HitEvent, HitResult } from '../types/world';
import { Actor } from './Actor';
import type { GameWorldApi } from './WorldApi';

/** Destructible objective (energy / ice / chaos pillars). Only heroes can damage it. */
export class Pillar extends Actor {
  readonly team = 'object' as const;
  private img: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private bar: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(private w: GameWorldApi, x: number, y: number, hp: number, readonly color: number, name: string, private onBroken: (p: Pillar) => void) {
    super(w, null, x, y, 1.1);
    this.maxHp = hp;
    this.hp = hp;
    this.height = 150;
    this.halfWidth = 26;
    this.halfDepth = 18;
    this.mass = 999;
    this.grabbable = false;
    this.glow = w.scene.add.image(x, y - 70, 'fx-glow').setTint(color).setScale(3).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.img = w.scene.add.image(x, y + 6, 'prop-pillar').setOrigin(0.5, 1).setScale(0.5).setTint(color);
    this.bar = w.scene.add.graphics();
    this.label = w.scene.add.text(x, y - 175, name, { fontFamily: FONT, fontSize: '16px', fontStyle: '800', color: '#ffffff', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
    this.syncPillar();
    w.fx.ring(x, y, 80, color, 400);
  }

  get isInvulnerable(): boolean {
    return !this.alive;
  }

  receiveHit(e: HitEvent): HitResult {
    if (!this.alive) return { landed: false, damage: 0, blocked: false, killed: false };
    const dmg = Math.max(1, Math.round(e.damage * (e.breaksArmor ? 1.5 : 1)));
    this.hp = Math.max(0, this.hp - dmg);
    this.img.setTintFill(0xffffff);
    this.w.scene.time.delayedCall(60, () => this.img.active && this.img.setTint(this.color));
    this.img.x = this.x + Phaser.Math.Between(-4, 4);
    if (this.hp <= 0) {
      this.alive = false;
      this.w.audio.play('break');
      this.w.fx.ring(this.x, this.y, 140, this.color, 500);
      this.w.fx.hitSpark(this.x, this.y - 80, this.color, true);
      this.w.shake(0.01, 300);
      this.onBroken(this);
      this.destroy();
      return { landed: true, damage: dmg, blocked: false, killed: true };
    }
    return { landed: true, damage: dmg, blocked: false, killed: false };
  }

  private syncPillar(): void {
    const g = this.bar;
    g.clear();
    if (!this.alive) return;
    g.fillStyle(0x000000, 0.6).fillRect(this.x - 32, this.y - 162, 64, 9);
    g.fillStyle(this.color, 1).fillRect(this.x - 31, this.y - 161, 62 * (this.hp / this.maxHp), 7);
    g.setDepth(this.y + 2);
    this.img.setDepth(this.y);
    this.glow.setDepth(this.y - 1).setAlpha(0.35 + 0.2 * Math.sin(this.w.now / 200));
    this.label.setDepth(this.y + 2);
  }

  update(): void {
    this.syncPillar();
    this.img.x += (this.x - this.img.x) * 0.3;
  }

  destroy(): void {
    super.destroy();
    this.img.destroy();
    this.glow.destroy();
    this.bar.destroy();
    this.label.destroy();
  }
}
