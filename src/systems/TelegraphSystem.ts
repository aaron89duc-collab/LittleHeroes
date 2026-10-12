import Phaser from 'phaser';

/**
 * Floor decals that warn about incoming attacks/hazards. Each warning uses shape + animated fill + a "!" icon,
 * never colour alone (GDD §12.5). Driven by world time so it freezes with pause.
 */
export type TelegraphShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'cone'; x: number; y: number; facing: 1 | -1; len: number; spread: number };

interface Item {
  g: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  shape: TelegraphShape;
  start: number;
  dur: number;
  color: number;
  follow?: () => { x: number; y: number } | null;
  dead: boolean;
}

export class TelegraphSystem {
  private items: Item[] = [];

  constructor(private scene: Phaser.Scene, private now: () => number) {}

  add(shape: TelegraphShape, durMs: number, color = 0xff3b3b, follow?: Item['follow']): { cancel: () => void; shape: TelegraphShape } {
    const g = this.scene.add.graphics().setDepth(-3);
    const icon = this.scene.add
      .text(0, 0, '!', { fontFamily: 'Arial Black, Arial', fontSize: '30px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(2000);
    const it: Item = { g, icon, shape, start: this.now(), dur: durMs, color, follow, dead: false };
    this.items.push(it);
    return {
      shape,
      cancel: () => {
        it.dead = true;
      },
    };
  }

  update(): void {
    const now = this.now();
    for (const it of this.items) {
      const k = Phaser.Math.Clamp((now - it.start) / it.dur, 0, 1);
      if (k >= 1) it.dead = true;
      if (it.dead) continue;
      if (it.follow) {
        const p = it.follow();
        if (p && (it.shape.kind === 'circle' || it.shape.kind === 'rect')) {
          it.shape.x = p.x;
          it.shape.y = p.y;
        }
      }
      this.draw(it, k, now);
    }
    if (this.items.some((i) => i.dead)) {
      for (const i of this.items) if (i.dead) {
        i.g.destroy();
        i.icon.destroy();
      }
      this.items = this.items.filter((i) => !i.dead);
    }
  }

  private draw(it: Item, k: number, now: number): void {
    const g = it.g;
    g.clear();
    const pulse = 0.55 + 0.45 * Math.sin(now / 60);
    const s = it.shape;
    g.lineStyle(4, 0xffffff, 0.9 * pulse);
    if (s.kind === 'circle') {
      const ry = s.r * 0.42;
      g.fillStyle(it.color, 0.18);
      g.fillEllipse(s.x, s.y, s.r * 2, ry * 2);
      g.fillStyle(it.color, 0.45);
      g.fillEllipse(s.x, s.y, s.r * 2 * k, ry * 2 * k);
      g.strokeEllipse(s.x, s.y, s.r * 2, ry * 2);
      it.icon.setPosition(s.x, s.y - ry - 18);
    } else if (s.kind === 'rect') {
      g.fillStyle(it.color, 0.18);
      g.fillRect(s.x, s.y, s.w, s.h);
      g.fillStyle(it.color, 0.42);
      g.fillRect(s.x, s.y, s.w * k, s.h);
      // hazard chevrons
      g.lineStyle(3, 0xffffff, 0.5 * pulse);
      for (let x = s.x + 10; x < s.x + s.w - 10; x += 40) {
        g.beginPath();
        g.moveTo(x, s.y + 6);
        g.lineTo(x + 12, s.y + s.h / 2);
        g.lineTo(x, s.y + s.h - 6);
        g.strokePath();
      }
      g.lineStyle(4, 0xffffff, 0.9 * pulse);
      g.strokeRect(s.x, s.y, s.w, s.h);
      it.icon.setPosition(Phaser.Math.Clamp(s.x + s.w / 2, s.x + 20, s.x + s.w - 20), s.y - 16);
    } else {
      const a0 = s.facing === 1 ? -s.spread : Math.PI - s.spread;
      const a1 = s.facing === 1 ? s.spread : Math.PI + s.spread;
      const pts = (len: number): Phaser.Math.Vector2[] => {
        const out = [new Phaser.Math.Vector2(s.x, s.y)];
        for (let i = 0; i <= 12; i++) {
          const a = a0 + ((a1 - a0) * i) / 12;
          out.push(new Phaser.Math.Vector2(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len * 0.42));
        }
        return out;
      };
      g.fillStyle(it.color, 0.18);
      g.fillPoints(pts(s.len), true);
      g.fillStyle(it.color, 0.45);
      g.fillPoints(pts(s.len * k), true);
      g.strokePoints(pts(s.len), true);
      it.icon.setPosition(s.x + s.facing * s.len * 0.6, s.y - 20);
    }
    it.icon.setScale(0.9 + 0.2 * pulse);
  }

  clear(): void {
    for (const i of this.items) {
      i.g.destroy();
      i.icon.destroy();
    }
    this.items = [];
  }
}
