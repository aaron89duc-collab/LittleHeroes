import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../game/constants';
import type { WorldFx } from '../types/world';

/** Pooled visual effects (GDD §14: object pooling for hit effects). */
export class EffectsSystem implements WorldFx {
  private sparks: Phaser.GameObjects.Image[] = [];
  private numbers: Phaser.GameObjects.Text[] = [];
  private dusts: Phaser.GameObjects.Image[] = [];
  private rings: Phaser.GameObjects.Image[] = [];
  private ghosts: Phaser.GameObjects.RenderTexture[] = [];
  private flash: Phaser.GameObjects.Rectangle;
  reduceFlash = false;

  constructor(private scene: Phaser.Scene) {
    this.flash = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(5000);
  }

  private take<T extends Phaser.GameObjects.GameObject & { active: boolean }>(pool: T[], make: () => T, max: number): T | null {
    const free = pool.find((o) => !o.active);
    if (free) return free;
    if (pool.length >= max) return null;
    const o = make();
    pool.push(o);
    return o;
  }

  hitSpark(x: number, y: number, color: number, big: boolean): void {
    const s = this.take(this.sparks, () => this.scene.add.image(0, 0, 'fx-spark').setBlendMode(Phaser.BlendModes.ADD), 24);
    if (!s) return;
    s.setActive(true).setVisible(true).setPosition(x, y).setDepth(3000).setTint(color).setAlpha(1);
    s.setScale(big ? 1.3 : 0.8).setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({
      targets: s,
      scale: big ? 2.1 : 1.3,
      alpha: 0,
      duration: big ? 260 : 180,
      onComplete: () => s.setActive(false).setVisible(false),
    });
    if (big) this.ring(x, y, 60, color, 220);
  }

  damageNumber(x: number, y: number, value: number, color: string): void {
    const t = this.take(
      this.numbers,
      () => this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: '#fff', stroke: '#1a1030', strokeThickness: 6 }).setOrigin(0.5),
      30,
    );
    if (!t) return;
    t.setActive(true).setVisible(true).setText(`${value}`).setColor(color).setPosition(x + Phaser.Math.Between(-12, 12), y).setDepth(3100).setAlpha(1).setScale(value >= 20 ? 1.25 : 1);
    this.scene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.setActive(false).setVisible(false) });
  }

  dust(x: number, y: number, n = 3): void {
    for (let i = 0; i < n; i++) {
      const d = this.take(this.dusts, () => this.scene.add.image(0, 0, 'fx-dust'), 40);
      if (!d) return;
      d.setActive(true).setVisible(true).setPosition(x + Phaser.Math.Between(-20, 20), y - 6).setDepth(y + 1).setAlpha(0.8).setScale(0.6);
      this.scene.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-30, 30),
        y: d.y - Phaser.Math.Between(6, 24),
        scale: 1.4,
        alpha: 0,
        duration: 420,
        onComplete: () => d.setActive(false).setVisible(false),
      });
    }
  }

  ring(x: number, y: number, radius: number, color: number, ms = 300): void {
    const r = this.take(this.rings, () => this.scene.add.image(0, 0, 'fx-ring').setBlendMode(Phaser.BlendModes.ADD), 16);
    if (!r) return;
    r.setActive(true).setVisible(true).setPosition(x, y).setDepth(2900).setTint(color).setAlpha(0.9).setScale(0.2, 0.09);
    this.scene.tweens.add({
      targets: r,
      scaleX: radius / 56,
      scaleY: (radius / 56) * 0.45,
      alpha: 0,
      duration: ms,
      onComplete: () => r.setActive(false).setVisible(false),
    });
  }

  text(x: number, y: number, msg: string, color = '#ffffff', size = 26): void {
    const t = this.scene.add
      .text(x, y, msg, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: '#1a1030', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(3200);
    this.scene.tweens.add({ targets: t, y: y - 40, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  slash(x: number, y: number, facing: 1 | -1, color: number, scale = 1): void {
    const s = this.scene.add.image(x, y, 'fx-slash').setTint(color).setDepth(3000).setBlendMode(Phaser.BlendModes.ADD).setScale(facing * scale, scale);
    this.scene.tweens.add({ targets: s, alpha: 0, scaleY: scale * 1.3, duration: 200, onComplete: () => s.destroy() });
  }

  afterimage(target: Phaser.GameObjects.Container, color: number): void {
    const W = 260;
    const H = 300;
    const g = this.take(this.ghosts, () => this.scene.add.renderTexture(0, 0, W, H).setOrigin(0), 6);
    if (!g) return;
    g.setActive(true).setVisible(true);
    g.clear();
    const ox = W / 2 - target.x;
    const oy = H - 30 - target.y;
    g.draw(target, ox, oy);
    g.setPosition(target.x - W / 2, target.y - (H - 30)).setDepth(target.depth - 1).setAlpha(0.55).setTintFill(color);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.setActive(false).setVisible(false) });
  }

  flashScreen(color: number, ms: number): void {
    if (this.reduceFlash) return;
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setFillStyle(color, 1).setAlpha(0.25);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: ms });
  }
}
