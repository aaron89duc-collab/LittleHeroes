import Phaser from 'phaser';
import { FONT } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';

export interface ButtonOpts {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
  disabled?: boolean;
  sub?: string;
}

/** Big, high-contrast, touch-friendly button with keyboard focus state (focus = gold border + arrow, not colour only). */
export class MenuButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Text;
  private subText?: Phaser.GameObjects.Text;
  focused = false;
  readonly w: number;
  readonly h: number;
  disabled: boolean;
  private color: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.w = o.width ?? 340;
    this.h = o.height ?? 62;
    this.color = o.color ?? 0x1d3170;
    this.disabled = !!o.disabled;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, o.sub ? -9 : 0, text, { fontFamily: FONT, fontSize: `${o.fontSize ?? 28}px`, fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 4 })
      .setOrigin(0.5);
    this.arrow = scene.add.text(-this.w / 2 + 22, 0, '▶', { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0.5).setVisible(false);
    this.add([this.bg, this.label, this.arrow]);
    if (o.sub) {
      this.subText = scene.add.text(0, 16, o.sub, { fontFamily: FONT, fontSize: '16px', color: '#c9d6ff' }).setOrigin(0.5);
      this.add(this.subText);
    }
    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: !this.disabled });
    this.on('pointerover', () => this.emit('hover'));
    this.on('pointerdown', () => {
      if (this.disabled) return;
      this.setScale(0.96);
    });
    this.on('pointerout', () => this.setScale(1));
    this.on('pointerup', () => {
      this.setScale(1);
      this.activate();
    });
    this.draw();
    scene.add.existing(this);
  }

  activate(): void {
    if (this.disabled) {
      AudioSystem.get().play('guard');
      return;
    }
    AudioSystem.get().unlock();
    AudioSystem.get().play('confirm');
    this.onClick();
  }

  setFocus(f: boolean): void {
    this.focused = f;
    this.draw();
  }

  setLabel(t: string): void {
    this.label.setText(t);
  }

  private draw(): void {
    const g = this.bg;
    const w = this.w;
    const h = this.h;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 14);
    g.fillStyle(this.disabled ? 0x2a2f45 : this.focused ? Phaser.Display.Color.ValueToColor(this.color).lighten(18).color : this.color, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 4, 10);
    g.lineStyle(this.focused ? 5 : 3, this.focused ? 0xffd23f : 0x5a78d0, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.arrow.setVisible(this.focused);
    this.label.setAlpha(this.disabled ? 0.45 : 1);
  }
}

/** Enter / Space / A / Z (and legacy J) confirm in menus. */
export function isConfirmKey(k: string): boolean {
  return k === 'Enter' || k === ' ' || (k.length === 1 && 'aAzZjJ'.includes(k));
}

/** Keyboard navigation (arrows + Enter/Space/A/Z) across a list of buttons. */
export class MenuNav {
  index = 0;
  constructor(
    private scene: Phaser.Scene,
    public buttons: MenuButton[],
    private cols = 1,
    private onBack?: () => void,
  ) {
    buttons.forEach((b, i) => b.on('hover', () => this.focus(i)));
    const kb = scene.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    scene.events.once('shutdown', () => kb?.off('keydown', this.onKey, this));
    const first = buttons.findIndex((b) => !b.disabled);
    this.focus(first < 0 ? 0 : first);
  }

  private onKey(ev: KeyboardEvent): void {
    if (!this.scene.scene.isActive()) return;
    const k = ev.key;
    const n = this.buttons.length;
    if (k === 'ArrowDown') this.move(this.cols);
    else if (k === 'ArrowUp') this.move(-this.cols);
    else if (k === 'ArrowRight') this.move(this.cols > 1 ? 1 : 0);
    else if (k === 'ArrowLeft') this.move(this.cols > 1 ? -1 : 0);
    else if (isConfirmKey(k)) this.buttons[this.index]?.activate();
    else if (k === 'Escape' || k === 'Backspace') this.onBack?.();
    void n;
  }

  private move(d: number): void {
    if (d === 0) return;
    const n = this.buttons.length;
    let i = this.index;
    for (let tries = 0; tries < n; tries++) {
      i = (i + d + n) % n;
      if (!this.buttons[i].disabled) break;
    }
    AudioSystem.get().play('ui');
    this.focus(i);
  }

  focus(i: number): void {
    this.index = i;
    this.buttons.forEach((b, j) => b.setFocus(j === i));
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.92): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(x + 6, y + 8, w, h, 20);
  g.fillStyle(0x0f1a3d, alpha).fillRoundedRect(x, y, w, h, 20);
  g.lineStyle(4, 0x3f63c9, 1).strokeRoundedRect(x, y, w, h, 20);
  g.lineStyle(2, 0xffd23f, 0.6).strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 14);
  return g;
}

export function title(scene: Phaser.Scene, x: number, y: number, text: string, size = 44, color = '#ffd23f'): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: '800', color, stroke: '#0b1230', strokeThickness: 8 })
    .setOrigin(0.5)
    .setShadow(0, 4, '#000000', 6, true, true);
}

export function bodyText(scene: Phaser.Scene, x: number, y: number, text: string, size = 20, wrap = 600, color = '#e8eeff'): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, wordWrap: { width: wrap }, lineSpacing: 4 });
}
