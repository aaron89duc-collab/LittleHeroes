import Phaser from 'phaser';
import { FONT } from '../game/constants';
import { TouchController, type TouchButton } from '../input/TouchController';

/** Floating 8-direction joystick: touch anywhere on the left part of the screen (GDD §6.2). */
export class VirtualJoystick {
  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private home = { x: 170, y: 560 };
  private radius = 86;
  private touch = TouchController.get();

  constructor(scene: Phaser.Scene, opacity: number) {
    this.base = scene.add.circle(this.home.x, this.home.y, this.radius, 0x0b1230, 0.45 * opacity * 2).setStrokeStyle(4, 0xffffff, 0.6 * opacity * 1.6).setDepth(100);
    this.thumb = scene.add.circle(this.home.x, this.home.y, 40, 0xffffff, 0.55 * opacity * 1.6).setStrokeStyle(3, 0x0b1230, 0.8).setDepth(101);
    scene.input.on('pointerdown', this.down, this);
    scene.input.on('pointermove', this.move, this);
    scene.input.on('pointerup', this.up, this);
    scene.input.on('pointerupoutside', this.up, this);
  }

  private down(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (this.pointerId !== null || over.length > 0) return;
    if (p.x > 560 || p.y < 220) return;
    this.pointerId = p.id;
    this.base.setPosition(p.x, p.y);
    this.thumb.setPosition(p.x, p.y);
  }

  private move(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const d = Math.hypot(dx, dy);
    const k = d > this.radius ? this.radius / d : 1;
    this.thumb.setPosition(this.base.x + dx * k, this.base.y + dy * k);
    const nx = (dx * k) / this.radius;
    const ny = (dy * k) / this.radius;
    // dead zone + 8-way friendly snapping
    this.touch.moveX = Math.abs(nx) < 0.25 ? 0 : Phaser.Math.Clamp(nx * 1.3, -1, 1);
    this.touch.moveY = Math.abs(ny) < 0.25 ? 0 : Phaser.Math.Clamp(ny * 1.3, -1, 1);
  }

  private up(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    this.touch.moveX = 0;
    this.touch.moveY = 0;
    this.base.setPosition(this.home.x, this.home.y);
    this.thumb.setPosition(this.home.x, this.home.y);
  }

  setVisible(v: boolean): void {
    this.base.setVisible(v);
    this.thumb.setVisible(v);
  }
}

export interface TouchButtonView {
  key: TouchButton;
  arc: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  overlay: Phaser.GameObjects.Graphics;
  r: number;
}

export function makeTouchButton(scene: Phaser.Scene, key: TouchButton, x: number, y: number, r: number, text: string, color: number, opacity: number): TouchButtonView {
  const tc = TouchController.get();
  const arc = scene.add.circle(x, y, r, color, Math.min(1, opacity * 1.3)).setStrokeStyle(4, 0xffffff, Math.min(1, opacity * 1.8)).setDepth(100);
  const label = scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${Math.round(r * 0.42)}px`, fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 4 })
    .setOrigin(0.5)
    .setDepth(102)
    .setAlpha(Math.min(1, opacity * 2));
  const overlay = scene.add.graphics().setDepth(101);
  arc.setInteractive(new Phaser.Geom.Circle(r, r, r * 1.15), Phaser.Geom.Circle.Contains);
  arc.on('pointerdown', () => {
    tc.press(key);
    arc.setScale(0.9);
  });
  const rel = (): void => {
    tc.release(key);
    arc.setScale(1);
  };
  arc.on('pointerup', rel);
  arc.on('pointerout', rel);
  return { key, arc, label, overlay, r };
}
