import Phaser from 'phaser';
import { TEX_RES } from '../game/constants';
import type { MoveConfig } from '../types/game';
import type { ActorView } from './ActorView';
import type { Pose } from './Poses';

export type CreatureKind = 'drone' | 'spider' | 'crab' | 'bat';

interface Palette {
  body: number;
  dark: number;
  skin: number;
  accent: number;
}

const INK = 0x141428;

/**
 * Procedurally animated non-humanoid bodies (flying drones, Nhện Chúa, Thủy Quái, Dơi Chúa).
 * Implements the same ActorView contract as the puppet Rig so entities/AI don't care which one they drive.
 */
export class CreatureView extends Phaser.GameObjects.Container implements ActorView {
  private inner: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private wings: Phaser.GameObjects.Image[] = [];
  private bodyImg?: Phaser.GameObjects.Image;
  private mode = 'idle';
  private modeTime = 0;
  private attackTiming = { tele: 400, active: 150, rec: 300 };
  private facingSign: 1 | -1 = 1;
  private baseScale: number;
  private flashMs = 0;
  private wobble = 0;
  private lie = 0;
  private tintOverride: number | null = null;

  constructor(scene: Phaser.Scene, readonly kind: CreatureKind, scale: number, private pal: Palette) {
    super(scene, 0, 0);
    this.baseScale = scale;
    this.inner = scene.add.container(0, 0);
    this.add(this.inner);
    this.g = scene.add.graphics();
    if (kind === 'drone' || kind === 'bat') {
      const wl = scene.add.image(-8, -8, 'enemy-bat-wing').setOrigin(1, 0.2).setScale(-1 / TEX_RES, 1 / TEX_RES);
      const wr = scene.add.image(8, -8, 'enemy-bat-wing').setOrigin(0, 0.2).setScale(1 / TEX_RES);
      wl.setOrigin(0, 0.2);
      this.wings = [wl, wr];
      this.bodyImg = scene.add.image(0, 0, 'enemy-bat-body').setScale(1 / TEX_RES);
      this.inner.add([wl, wr, this.bodyImg]);
      if (kind === 'bat') {
        this.inner.add(this.g);
      }
    } else {
      this.inner.add(this.g);
    }
    this.setScale(scale);
    scene.add.existing(this);
  }

  get currentAnim(): string {
    return this.mode;
  }

  get animDone(): boolean {
    return this.mode !== 'attack' || this.modeTime > this.attackTiming.tele + this.attackTiming.active + this.attackTiming.rec;
  }

  get visualHeight(): number {
    return (this.kind === 'spider' ? 120 : this.kind === 'crab' ? 130 : 90) * this.baseScale;
  }

  setFacing(f: 1 | -1): void {
    this.facingSign = f;
  }

  setBaseScale(s: number): void {
    this.baseScale = s;
  }

  play(name: string, force = false): void {
    if (!force && this.mode === name) return;
    this.mode = name;
    this.modeTime = 0;
  }

  hold(name: string, _pose: Pose, _blend?: number): void {
    this.play(name);
  }

  playMove(_m: MoveConfig): void {
    this.play('attack', true);
  }

  playAttack(_name: string, tele: number, active: number, rec: number): void {
    this.attackTiming = { tele, active, rec };
    this.play('attack', true);
  }

  flash(ms = 90): void {
    this.flashMs = ms;
  }

  setLie(deg: number): void {
    this.lie = deg;
  }

  setTintAll(c: number | null): void {
    this.tintOverride = c;
  }

  setWobble(v: number): void {
    this.wobble = v;
  }

  private col(c: number): number {
    if (this.flashMs > 0) return 0xffffff;
    if (this.tintOverride !== null) return this.tintOverride;
    return c;
  }

  update(dt: number): void {
    this.modeTime += dt;
    if (this.flashMs > 0) this.flashMs -= dt;
    const t = this.scene.time.now;
    this.scaleX = this.baseScale * this.facingSign;
    this.scaleY = this.baseScale;
    this.inner.x = this.wobble ? Math.sin(t / 25) * this.wobble : 0;
    // winged bodies are drawn around their centre: lift them so they rest on the floor when grounded
    this.inner.y = this.kind === 'bat' ? -58 : this.kind === 'drone' ? -26 : 0;
    const flip = this.kind === 'spider' || this.kind === 'crab';
    this.inner.rotation = flip ? (-this.lie / 88) * Math.PI * 0.9 : (-this.lie / 88) * 1.4;
    // attack phase: 0 idle → -1 windup → +1 strike
    let atk = 0;
    if (this.mode === 'attack') {
      const { tele, active, rec } = this.attackTiming;
      const m = this.modeTime;
      if (m < tele) atk = -Math.min(1, m / Math.max(1, tele * 0.7));
      else if (m < tele + active) atk = 1;
      else atk = Math.max(0, 1 - (m - tele - active) / Math.max(1, rec));
    } else if (this.mode === 'telegraph' || this.mode === 'crouch') atk = -1;
    const walking = this.mode === 'walk' || this.mode === 'charge';
    switch (this.kind) {
      case 'drone':
      case 'bat':
        this.drawWinged(t, atk);
        break;
      case 'spider':
        this.drawSpider(t, atk, walking);
        break;
      case 'crab':
        this.drawCrab(t, atk, walking);
        break;
    }
  }

  private drawWinged(t: number, atk: number): void {
    const flap = Math.sin(t / (this.mode === 'attack' ? 45 : 70));
    const big = this.kind === 'bat' ? 1.9 : 1;
    const [wl, wr] = this.wings;
    wl.setPosition(-10 * big, -6 * big).setScale((-1 / TEX_RES) * big, ((1 / TEX_RES) * big) * (0.6 + 0.4 * flap));
    wr.setPosition(10 * big, -6 * big).setScale((1 / TEX_RES) * big, ((1 / TEX_RES) * big) * (0.6 + 0.4 * flap));
    wl.setOrigin(0, 0.2);
    wl.rotation = -0.3 * flap;
    wr.rotation = 0.3 * flap;
    this.bodyImg!.setScale((1 / TEX_RES) * big);
    this.bodyImg!.y = atk > 0 ? 4 : 0;
    const tint = this.flashMs > 0 ? 0xffffff : this.tintOverride;
    for (const o of [wl, wr, this.bodyImg!]) {
      if (tint !== null && tint !== undefined) o.setTintFill(tint);
      else if (this.kind === 'bat') o.setTint(0xd8b8ff);
      else o.clearTint();
    }
    if (this.kind === 'bat') {
      const g = this.g;
      g.clear();
      // crown of spikes + glowing chest gem
      g.fillStyle(this.col(this.pal.accent), 1);
      g.fillCircle(0, 14, 7);
      if (atk < 0) {
        g.lineStyle(3, 0xff3b6b, 0.8);
        g.strokeCircle(0, 0, 50 + Math.sin(t / 40) * 4);
      }
    }
  }

  private drawSpider(t: number, atk: number, walking: boolean): void {
    const g = this.g;
    g.clear();
    const body = this.col(this.pal.body);
    const dark = this.col(this.pal.dark);
    const acc = this.col(this.pal.accent);
    const ph = t / (walking ? 70 : 260);
    // legs: 4 back, 4 front
    g.lineStyle(7, INK, 1);
    const legs = (front: boolean): void => {
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const sx = (i - 1.5) * 14;
        const lift = Math.max(0, Math.sin(ph + i * 1.6)) * (walking ? 12 : 3);
        const kx = sx + side * 34 + (front ? 6 : -6);
        const ky = -70 - lift;
        const fx = sx + side * 56;
        const fy = -4 - (atk < 0 && i < 2 ? 20 : 0);
        g.lineStyle(9, INK, 1);
        g.beginPath();
        g.moveTo(sx, -48);
        g.lineTo(kx, ky);
        g.lineTo(fx, fy);
        g.strokePath();
        g.lineStyle(5, front ? body : dark, 1);
        g.beginPath();
        g.moveTo(sx, -48);
        g.lineTo(kx, ky);
        g.lineTo(fx, fy);
        g.strokePath();
      }
    };
    legs(false);
    // abdomen
    g.fillStyle(dark, 1);
    g.fillEllipse(-34, -64, 76, 62);
    g.lineStyle(3, INK, 1);
    g.strokeEllipse(-34, -64, 76, 62);
    g.fillStyle(acc, 0.9);
    g.fillTriangle(-46, -78, -26, -78, -36, -56);
    // head
    const hx = 20 + (atk > 0 ? 14 : atk < 0 ? -6 : 0);
    g.fillStyle(body, 1);
    g.fillEllipse(hx, -56, 54, 44);
    g.strokeEllipse(hx, -56, 54, 44);
    g.fillStyle(0xff3bd4, 1);
    for (const [ex, ey] of [[hx + 8, -64], [hx + 18, -60], [hx + 10, -54], [hx + 20, -52]]) g.fillCircle(ex, ey, 4);
    // fangs
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(hx + 18, -42, hx + 24, -42, hx + 21, -30 + (atk > 0 ? 6 : 0));
    g.fillTriangle(hx + 8, -42, hx + 14, -42, hx + 11, -32);
    legs(true);
  }

  private drawCrab(t: number, atk: number, walking: boolean): void {
    const g = this.g;
    g.clear();
    const body = this.col(this.pal.body);
    const dark = this.col(this.pal.dark);
    const skin = this.col(this.pal.skin);
    const ph = t / (walking ? 80 : 300);
    // legs
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const sx = side * (20 + i * 12);
        const lift = Math.max(0, Math.sin(ph + i + (side > 0 ? 1.5 : 0))) * (walking ? 10 : 2);
        g.lineStyle(8, INK, 1);
        g.beginPath();
        g.moveTo(sx, -40);
        g.lineTo(sx + side * 26, -50 - lift);
        g.lineTo(sx + side * 40, -2);
        g.strokePath();
        g.lineStyle(4, dark, 1);
        g.beginPath();
        g.moveTo(sx, -40);
        g.lineTo(sx + side * 26, -50 - lift);
        g.lineTo(sx + side * 40, -2);
        g.strokePath();
      }
    }
    // shell
    g.fillStyle(body, 1);
    g.fillEllipse(0, -60, 120, 70);
    g.lineStyle(3, INK, 1);
    g.strokeEllipse(0, -60, 120, 70);
    g.fillStyle(skin, 0.5);
    g.fillEllipse(-10, -72, 60, 22);
    // eye stalks
    for (const ex of [14, 30]) {
      g.lineStyle(4, INK, 1);
      g.lineBetween(ex, -88, ex, -108);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(ex, -110, 7);
      g.fillStyle(INK, 1);
      g.fillCircle(ex + 2, -110, 3);
    }
    // claws (front claw swings on attack)
    const claw = (cx: number, cy: number, open: number, scale: number): void => {
      g.fillStyle(body, 1);
      g.lineStyle(3, INK, 1);
      g.fillEllipse(cx, cy, 46 * scale, 34 * scale);
      g.strokeEllipse(cx, cy, 46 * scale, 34 * scale);
      g.fillStyle(dark, 1);
      g.fillTriangle(cx + 14 * scale, cy - 6 * scale, cx + 34 * scale, cy - 18 * scale - open, cx + 20 * scale, cy + 2 * scale);
      g.fillTriangle(cx + 14 * scale, cy + 4 * scale, cx + 34 * scale, cy + 14 * scale + open, cx + 20 * scale, cy + 8 * scale);
    };
    const swing = atk > 0 ? 40 : atk < 0 ? -22 : Math.sin(t / 300) * 4;
    g.lineStyle(10, INK, 1);
    g.lineBetween(46, -60, 64 + swing * 0.4, -84 - (atk < 0 ? 26 : 0) + (atk > 0 ? 30 : 0));
    claw(76 + swing * 0.6, -88 - (atk < 0 ? 30 : 0) + (atk > 0 ? 34 : 0), atk < 0 ? 10 : 2, 1.25);
    claw(-60, -72, 2, 0.9);
  }
}
