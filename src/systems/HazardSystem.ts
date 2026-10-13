import Phaser from 'phaser';
import type { Actor } from '../entities/Actor';
import type { GameWorldApi } from '../entities/WorldApi';
import { FLOOR_BOTTOM, FLOOR_TOP, FONT } from '../game/constants';
import type { HazardConfig } from '../types/game';
import type { HitEvent } from '../types/world';

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  dir?: 1 | -1;
  g?: Phaser.GameObjects.Graphics;
}

interface Pending {
  at: number;
  fn: () => void;
}

/**
 * Environmental hazards (GDD §9). Every damaging hazard is announced by a telegraph ≥ its warningMs.
 * Hazards hurt enemies too, and stop once the boss is defeated.
 */
export class HazardSystem {
  active = false;
  private timers = new Map<HazardConfig, number>();
  private pending: Pending[] = [];
  private conveyors: Zone[] = [];
  private icePatches: Zone[] = [];
  private vents: Array<{ x: number; y: number }> = [];
  private windDir: 1 | -1 = 1;
  private windUntil = 0;
  private windText: Phaser.GameObjects.Text | null = null;
  private lasers: Array<{ x: number; dir: 1 | -1; end: number; hit: Set<number>; g: Phaser.GameObjects.Graphics }> = [];
  private electric: Array<{ zone: Zone; until: number; nextTick: number }> = [];
  private steamCols: Array<{ x: number; y: number; until: number; nextTick: number; g: Phaser.GameObjects.Particles.ParticleEmitter }> = [];

  constructor(private w: GameWorldApi, private cfgs: HazardConfig[], stageWidth: number) {
    const now = w.now;
    for (const c of cfgs) this.timers.set(c, now + c.intervalMs * 0.6);
    // static layout hazards
    for (const c of cfgs) {
      if (c.kind === 'conveyor') {
        for (let x = 900; x < stageWidth - 600; x += 1100) {
          const z: Zone = { x, y: Phaser.Math.Between(FLOOR_TOP + 50, FLOOR_BOTTOM - 110), w: 360, h: 70, dir: Math.random() < 0.5 ? 1 : -1 };
          z.g = w.scene.add.graphics().setDepth(-4);
          this.conveyors.push(z);
        }
      }
      if (c.kind === 'ice') {
        for (let x = 500; x < stageWidth - 300; x += 700) {
          const z: Zone = { x, y: Phaser.Math.Between(FLOOR_TOP + 30, FLOOR_BOTTOM - 120), w: Phaser.Math.Between(260, 420), h: Phaser.Math.Between(80, 120) };
          const g = w.scene.add.graphics().setDepth(-4);
          g.fillStyle(0xbfe9ff, 0.55).fillEllipse(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h);
          g.lineStyle(3, 0xffffff, 0.8).strokeEllipse(z.x + z.w / 2, z.y + z.h / 2, z.w, z.h);
          g.fillStyle(0xffffff, 0.6).fillEllipse(z.x + z.w * 0.4, z.y + z.h * 0.35, z.w * 0.35, z.h * 0.18);
          this.icePatches.push(z);
        }
      }
      if (c.kind === 'steam') {
        for (let x = 700; x < stageWidth - 300; x += 520) {
          const v = { x, y: Phaser.Math.Between(FLOOR_TOP + 40, FLOOR_BOTTOM - 40) };
          w.scene.add.image(v.x, v.y, 'prop-vent').setScale(0.5).setDepth(-4);
          this.vents.push(v);
        }
      }
    }
  }

  get windPush(): number {
    return this.w.now < this.windUntil ? this.windDir * 95 : 0;
  }

  private actors(): Actor[] {
    const list: Actor[] = [...this.w.players];
    for (const h of this.w.hostiles()) if (!h.isBoss && h.team === 'enemy') list.push(h);
    return list;
  }

  private hit(a: Actor, dmg: number, opts: Partial<HitEvent> = {}): void {
    if (!a.alive || a.isInvulnerable) return;
    a.receiveHit({
      attackerId: -1,
      attackerX: a.x - (opts.dirX ?? 1) * 10,
      dirX: 1,
      damage: dmg,
      knockback: 160,
      launch: false,
      stunMs: 300,
      slowMs: 0,
      grab: false,
      breaksArmor: true,
      heavy: true,
      color: 0xffaa00,
      fromHazard: true,
      ...opts,
    });
  }

  private viewSpot(nearPlayer = 0.6): { x: number; y: number } {
    const alive = this.w.players.filter((q) => q.alive);
    const p = alive.length ? alive[Math.floor(Math.random() * alive.length)] : this.w.player;
    if (Math.random() < nearPlayer) return { x: p.x + Phaser.Math.Between(-30, 30), y: p.y + Phaser.Math.Between(-10, 10) };
    return {
      x: Phaser.Math.Between(this.w.camLeft + 120, this.w.camRight - 120),
      y: Phaser.Math.Between(FLOOR_TOP + 30, FLOOR_BOTTOM - 20),
    };
  }

  private later(ms: number, fn: () => void): void {
    this.pending.push({ at: this.w.now + ms, fn });
  }

  update(dt: number): void {
    const now = this.w.now;
    // static zones always apply
    this.applyZones(dt);
    // pending events (telegraph → impact)
    if (this.pending.length) {
      const due = this.pending.filter((p) => now >= p.at);
      this.pending = this.pending.filter((p) => now < p.at);
      for (const p of due) p.fn();
    }
    this.updateLasers(dt);
    this.updateElectric();
    this.updateSteam();
    const wp = this.windPush;
    if (wp) for (const a of this.actors()) a.pushX += wp;
    if (this.windText && now >= this.windUntil) {
      this.windText.destroy();
      this.windText = null;
    }
    if (!this.active) return;
    for (const c of this.cfgs) {
      if (c.intervalMs <= 0) continue;
      const next = this.timers.get(c) ?? 0;
      if (now >= next) {
        this.timers.set(c, now + c.intervalMs * Phaser.Math.FloatBetween(0.85, 1.2));
        this.trigger(c);
      }
    }
  }

  private applyZones(dt: number): void {
    const t = this.w.now;
    for (const z of this.conveyors) {
      const g = z.g!;
      g.clear();
      g.fillStyle(0x2a2d35, 0.9).fillRect(z.x, z.y, z.w, z.h);
      g.lineStyle(3, 0x111111, 1).strokeRect(z.x, z.y, z.w, z.h);
      g.fillStyle(0xffcc00, 0.85);
      const off = ((t / 1000) * 70 * (z.dir ?? 1)) % 40;
      for (let x = z.x + 10 + ((off + 40) % 40); x < z.x + z.w - 16; x += 40) {
        const d = z.dir ?? 1;
        g.fillTriangle(x, z.y + 16, x, z.y + z.h - 16, x + 14 * d, z.y + z.h / 2);
      }
      for (const a of this.actors()) {
        if (a.z <= 0 && a.x > z.x && a.x < z.x + z.w && a.y > z.y && a.y < z.y + z.h) a.pushX += (z.dir ?? 1) * 75;
      }
    }
    for (const a of this.actors()) {
      a.slippery = this.icePatches.some((z) => {
        const cx = z.x + z.w / 2;
        const cy = z.y + z.h / 2;
        return ((a.x - cx) / (z.w / 2)) ** 2 + ((a.y - cy) / (z.h / 2)) ** 2 <= 1;
      });
    }
    void dt;
  }

  private trigger(c: HazardConfig): void {
    const w = this.w;
    switch (c.kind) {
      case 'falling':
      case 'icicle': {
        const s = this.viewSpot();
        w.telegraph.add({ kind: 'circle', x: s.x, y: s.y, r: 58 }, c.warningMs, 0xff3b3b);
        w.audio.play('warning');
        this.later(c.warningMs - 260, () => this.drop(c.kind === 'icicle' ? 'prop-icicle' : 'prop-sign', s.x, s.y, 0.5));
        this.later(c.warningMs, () => this.impact(s.x, s.y, 62, c.damage, true));
        break;
      }
      case 'container': {
        const s = this.viewSpot();
        const r = { kind: 'rect' as const, x: s.x - 80, y: s.y - 34, w: 160, h: 68 };
        w.telegraph.add(r, c.warningMs, 0xff3b3b);
        w.audio.play('warning');
        this.later(c.warningMs - 300, () => this.drop('prop-container', s.x, s.y + 30, 0.55, true));
        this.later(c.warningMs, () => {
          for (const a of this.actors()) if (Math.abs(a.x - s.x) < 90 && Math.abs(a.y - s.y) < 40 && a.z < 60) this.hit(a, c.damage, { launch: true, knockback: 240, dirX: a.x < s.x ? -1 : 1 });
          w.shake(0.01, 260);
          w.fx.dust(s.x, s.y, 10);
          w.audio.play('explosion');
        });
        break;
      }
      case 'shelf': {
        const s = this.viewSpot(0.7);
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        const r = { kind: 'rect' as const, x: dir === 1 ? s.x - 40 : s.x - 220, y: s.y - 30, w: 260, h: 60 };
        w.telegraph.add(r, c.warningMs, 0xff7a3d);
        w.audio.play('warning');
        this.later(c.warningMs - 250, () => {
          const img = w.scene.add.image(dir === 1 ? s.x - 40 : s.x + 40, s.y, 'prop-shelf').setOrigin(dir === 1 ? 0 : 1, 1).setScale(0.5).setDepth(s.y + 2);
          img.setRotation(-dir * 1.5);
          w.scene.tweens.add({ targets: img, rotation: 0, duration: 250, ease: 'Quad.easeIn' });
          w.scene.tweens.add({ targets: img, alpha: 0, delay: 1200, duration: 400, onComplete: () => img.destroy() });
        });
        this.later(c.warningMs, () => {
          for (const a of this.actors()) if (a.x > r.x && a.x < r.x + r.w && Math.abs(a.y - s.y) < 40 && a.z < 60) this.hit(a, c.damage, { launch: true, dirX: dir });
          w.shake(0.008, 200);
          w.audio.play('explosion');
        });
        break;
      }
      case 'train': {
        const y0 = FLOOR_TOP;
        const h = 64;
        const fromRight = Math.random() < 0.5;
        w.telegraph.add({ kind: 'rect', x: w.camLeft, y: y0, w: w.camRight - w.camLeft, h }, c.warningMs, 0xff2020);
        const label = w.scene.add
          .text((w.camLeft + w.camRight) / 2, y0 - 30, fromRight ? '◀ TÀU ĐANG ĐẾN!' : 'TÀU ĐANG ĐẾN! ▶', { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: '#ffffff', backgroundColor: '#c0182a', padding: { x: 10, y: 4 } })
          .setOrigin(0.5)
          .setDepth(3000);
        w.scene.tweens.add({ targets: label, alpha: 0.3, yoyo: true, repeat: -1, duration: 180 });
        w.audio.play('warning');
        this.later(600, () => w.audio.play('warning'));
        this.later(c.warningMs, () => {
          label.destroy();
          w.audio.play('train');
          const train = w.scene.add.image(fromRight ? w.camRight + 50 : w.camLeft - 50, y0 + h, 'prop-train').setOrigin(fromRight ? 0 : 1, 1).setScale(fromRight ? 0.5 : -0.5, 0.5).setDepth(y0 + h);
          const hitIds = new Set<number>();
          w.scene.tweens.add({
            targets: train,
            x: fromRight ? w.camLeft - 520 : w.camRight + 520,
            duration: 950,
            onUpdate: () => {
              const front = train.x;
              for (const a of this.actors()) {
                if (hitIds.has(a.id) || a.y > y0 + h + 6 || a.z > 80) continue;
                if (fromRight ? a.x > front && a.x < front + 450 : a.x < front && a.x > front - 450) {
                  hitIds.add(a.id);
                  this.hit(a, c.damage, { launch: true, knockback: 360, dirX: fromRight ? -1 : 1 });
                }
              }
            },
            onComplete: () => train.destroy(),
          });
          w.shake(0.006, 900);
        });
        break;
      }
      case 'steam': {
        const near = this.vents.filter((v) => v.x > w.camLeft && v.x < w.camRight);
        if (!near.length) return;
        const v = near[Phaser.Math.Between(0, near.length - 1)];
        w.telegraph.add({ kind: 'circle', x: v.x, y: v.y, r: 60 }, c.warningMs, 0xffffff);
        const puff = w.scene.add.particles(v.x, v.y, 'fx-dust', { speedY: { min: -60, max: -20 }, speedX: { min: -15, max: 15 }, lifespan: 500, scale: { start: 0.4, end: 0.9 }, alpha: { start: 0.6, end: 0 }, frequency: 90 }).setDepth(v.y + 1);
        this.later(c.warningMs, () => {
          puff.destroy();
          const col = w.scene.add
            .particles(v.x, v.y, 'fx-dust', { speedY: { min: -420, max: -260 }, speedX: { min: -40, max: 40 }, lifespan: 600, scale: { start: 0.8, end: 2.2 }, alpha: { start: 0.9, end: 0 }, frequency: 20 })
            .setDepth(v.y + 1);
          this.steamCols.push({ x: v.x, y: v.y, until: w.now + 1300, nextTick: 0, g: col });
          w.audio.play('spit');
        });
        break;
      }
      case 'energyFloor': {
        const s = this.viewSpot(0.7);
        const zone: Zone = { x: s.x - 90, y: s.y - 40, w: 180, h: 80 };
        w.telegraph.add({ kind: 'rect', ...zone }, c.warningMs, 0xb44dff);
        w.audio.play('warning');
        this.later(c.warningMs, () => {
          const g = w.scene.add.graphics().setDepth(-3);
          this.electric.push({ zone: { ...zone, g }, until: w.now + 1600, nextTick: 0 });
        });
        break;
      }
      case 'wind': {
        this.windDir = Math.random() < 0.5 ? 1 : -1;
        const txt = this.windDir === 1 ? 'GIÓ MẠNH  ▶▶▶' : '◀◀◀  GIÓ MẠNH';
        const t = w.scene.add
          .text((w.camLeft + w.camRight) / 2, 170, txt, { fontFamily: FONT, fontSize: '34px', fontStyle: '800', color: '#e8f4ff', stroke: '#1a2a4a', strokeThickness: 6 })
          .setOrigin(0.5)
          .setDepth(3000);
        w.scene.tweens.add({ targets: t, x: t.x + this.windDir * 30, yoyo: true, repeat: -1, duration: 200 });
        w.audio.play('warning');
        this.windText = t;
        this.later(c.warningMs, () => {
          this.windUntil = w.now + 2600;
          w.audio.play('whoosh');
        });
        break;
      }
      case 'laser': {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
        const startX = dir === 1 ? w.camLeft + 10 : w.camRight - 10;
        w.telegraph.add({ kind: 'rect', x: dir === 1 ? startX : startX - 60, y: FLOOR_TOP - 10, w: 60, h: FLOOR_BOTTOM - FLOOR_TOP + 20 }, c.warningMs, 0xff2a6a);
        w.fx.text((w.camLeft + w.camRight) / 2, 200, 'LASER QUÉT SÀN — NHẢY QUA!', '#ff7aa8', 28);
        w.audio.play('warning');
        this.later(c.warningMs, () => {
          const g = w.scene.add.graphics().setDepth(FLOOR_BOTTOM + 10);
          this.lasers.push({ x: startX, dir, end: w.now + 2400, hit: new Set(), g });
          this.laserDamage = c.damage;
        });
        break;
      }
      case 'chaos': {
        const n = 2;
        for (let i = 0; i < n; i++) {
          const s = this.viewSpot(i === 0 ? 0.8 : 0);
          w.telegraph.add({ kind: 'circle', x: s.x, y: s.y, r: 80 }, c.warningMs, 0xb44dff);
          this.later(c.warningMs, () => this.impact(s.x, s.y, 85, c.damage, true, 0xb44dff));
        }
        w.audio.play('warning');
        break;
      }
      default:
        break;
    }
  }

  private laserDamage = 10;

  private drop(key: string, x: number, y: number, scale: number, wide = false): void {
    const img = this.w.scene.add.image(x, y - 600, key).setOrigin(0.5, 1).setScale(scale, key === 'prop-icicle' ? -scale : scale).setDepth(y + 2);
    if (key === 'prop-icicle') img.setOrigin(0.5, 0);
    this.w.scene.tweens.add({ targets: img, y, duration: 250, ease: 'Quad.easeIn' });
    this.w.scene.tweens.add({ targets: img, alpha: 0, delay: wide ? 1300 : 900, duration: 300, onComplete: () => img.destroy() });
  }

  private impact(x: number, y: number, r: number, dmg: number, launch: boolean, color = 0xffaa33): void {
    for (const a of this.actors()) {
      if (Math.abs(a.x - x) < r + a.halfWidth * 0.5 && Math.abs(a.y - y) < r * 0.5 && a.z < 80) this.hit(a, dmg, { launch, dirX: a.x < x ? -1 : 1, color });
    }
    this.w.fx.ring(x, y, r + 10, color, 300);
    this.w.fx.dust(x, y, 5);
    this.w.shake(0.006, 160);
    this.w.audio.play('explosion');
  }

  private updateLasers(dt: number): void {
    const w = this.w;
    for (const l of this.lasers) {
      l.x += l.dir * ((w.camRight - w.camLeft) / 2.2) * (dt / 1000);
      const g = l.g;
      g.clear();
      g.fillStyle(0xff2a6a, 0.35).fillRect(l.x - 14, FLOOR_TOP - 10, 28, FLOOR_BOTTOM - FLOOR_TOP + 20);
      g.fillStyle(0xffffff, 0.95).fillRect(l.x - 3, FLOOR_TOP - 10, 6, FLOOR_BOTTOM - FLOOR_TOP + 20);
      g.fillStyle(0xff2a6a, 1).fillCircle(l.x, FLOOR_TOP - 14, 9);
      for (const a of this.actors()) {
        if (l.hit.has(a.id) || Math.abs(a.x - l.x) > 16 || a.z > 40) continue;
        l.hit.add(a.id);
        this.hit(a, this.laserDamage, { knockback: 120, dirX: l.dir, color: 0xff2a6a });
      }
      if (w.now > l.end || l.x < w.camLeft - 40 || l.x > w.camRight + 40) {
        g.destroy();
        l.end = -1;
      }
    }
    this.lasers = this.lasers.filter((l) => l.end > 0);
  }

  private updateElectric(): void {
    const w = this.w;
    for (const e of this.electric) {
      const z = e.zone;
      const g = z.g!;
      g.clear();
      g.fillStyle(0xb44dff, 0.35).fillRect(z.x, z.y, z.w, z.h);
      g.lineStyle(3, 0xe8c8ff, 0.9);
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        let x = z.x + Math.random() * 20;
        let y = z.y + Math.random() * z.h;
        g.moveTo(x, y);
        while (x < z.x + z.w - 20) {
          x += 20 + Math.random() * 20;
          y = z.y + Math.random() * z.h;
          g.lineTo(x, y);
        }
        g.strokePath();
      }
      if (w.now >= e.nextTick) {
        e.nextTick = w.now + 450;
        for (const a of this.actors()) if (a.x > z.x && a.x < z.x + z.w && a.y > z.y && a.y < z.y + z.h && a.z < 30) this.hit(a, 6, { knockback: 60, stunMs: 250, color: 0xb44dff });
      }
      if (w.now > e.until) {
        g.destroy();
        e.until = -1;
      }
    }
    this.electric = this.electric.filter((e) => e.until > 0);
  }

  private updateSteam(): void {
    const w = this.w;
    for (const s of this.steamCols) {
      if (w.now >= s.nextTick) {
        s.nextTick = w.now + 400;
        for (const a of this.actors()) if (Math.abs(a.x - s.x) < 52 && Math.abs(a.y - s.y) < 30) this.hit(a, this.cfgs.find((c) => c.kind === 'steam')?.damage ?? 8, { knockback: 140, launch: false, dirX: a.x < s.x ? -1 : 1, color: 0xffffff });
      }
      if (w.now > s.until) {
        s.g.stop();
        w.scene.time.delayedCall(700, () => s.g.destroy());
        s.until = -1;
      }
    }
    this.steamCols = this.steamCols.filter((s) => s.until > 0);
  }

  destroy(): void {
    for (const z of this.conveyors) z.g?.destroy();
    for (const l of this.lasers) l.g.destroy();
    for (const e of this.electric) e.zone.g?.destroy();
    for (const s of this.steamCols) s.g.destroy();
    this.windText?.destroy();
    this.pending = [];
  }
}
