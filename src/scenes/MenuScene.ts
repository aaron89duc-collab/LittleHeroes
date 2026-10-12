import Phaser from 'phaser';
import { HEADS } from '../art/registry';
import { CHARACTER_ORDER } from '../config/characters';
import { getMove } from '../config/moves';
import { FONT, GAME_W } from '../game/constants';
import { Rig } from '../rig/Rig';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav } from '../ui/MenuComponents';

export function drawLogo(scene: Phaser.Scene, x: number, y: number, scale = 1): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const crown = scene.add.graphics();
  crown.fillStyle(0xffd23f, 1).lineStyle(4, 0x7a4d00, 1);
  crown.beginPath();
  crown.moveTo(-46, 0);
  crown.lineTo(-46, -34);
  crown.lineTo(-22, -14);
  crown.lineTo(0, -44);
  crown.lineTo(22, -14);
  crown.lineTo(46, -34);
  crown.lineTo(46, 0);
  crown.closePath();
  crown.fillPath();
  crown.strokePath();
  crown.fillStyle(0xff4d6d, 1).fillCircle(0, -14, 6);
  crown.setPosition(0, -78);
  const t1 = scene.add
    .text(0, -20, 'LITTLE HEROES', { fontFamily: FONT, fontSize: '86px', fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 14 })
    .setOrigin(0.5)
    .setShadow(0, 8, '#000', 0, true, true);
  t1.setTint(0xffffff, 0xffffff, 0x9fd3ff, 0x9fd3ff);
  const ribbon = scene.add.graphics();
  ribbon.fillStyle(0xd62f2f, 1).lineStyle(4, 0x0b1230, 1);
  ribbon.beginPath();
  ribbon.moveTo(-250, 34);
  ribbon.lineTo(250, 34);
  ribbon.lineTo(232, 56);
  ribbon.lineTo(250, 78);
  ribbon.lineTo(-250, 78);
  ribbon.lineTo(-232, 56);
  ribbon.closePath();
  ribbon.fillPath();
  ribbon.strokePath();
  const t2 = scene.add
    .text(0, 56, 'ROYAL CITY BRAWL', { fontFamily: FONT, fontSize: '36px', fontStyle: '800', color: '#ffe066', stroke: '#3a0a0a', strokeThickness: 6 })
    .setOrigin(0.5);
  c.add([crown, ribbon, t1, t2]);
  c.setScale(scale);
  return c;
}

export class MenuScene extends Phaser.Scene {
  private rigs: Rig[] = [];
  private demoT = 0;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.rigs = [];
    new Backdrop(this, 'street', 0.25);
    const save = SaveSystem.get();
    const logo = drawLogo(this, 420, 150, 0.95);
    this.tweens.add({ targets: logo, y: 158, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });

    // the three heroes, built from the reference artwork
    CHARACTER_ORDER.forEach((id, i) => {
      const h = HEADS[`head-${id}`];
      const r = new Rig(this, {
        partKey: `rig-${id}`,
        headKey: h.key,
        headHeight: h.height,
        headAnchorY: h.anchorY,
        headOffsetX: h.offsetX,
        scale: 1.7,
        tailKey: id === 'shu-shu' ? 'tail-shu-shu' : undefined,
        bulk: id === 'bap' ? 1.12 : 1,
      });
      r.setPosition(200 + i * 230, 650 + (i === 1 ? 20 : 0)).setDepth(10 + i);
      this.rigs.push(r);
      this.add.image(r.x, r.y + 4, 'fx-shadow').setScale(2.4, 1.8).setDepth(5);
    });

    const hasProgress = save.data.completedStages.length > 0 || save.data.highestUnlockedStage > 1;
    const bx = 1040;
    const items: Array<[string, () => void, boolean?, string?]> = [
      ['Chơi mới', () => this.scene.start('CharacterSelectScene', { next: 'stage', stageId: 1 })],
      ['Tiếp tục', () => this.scene.start('StageSelectScene'), !hasProgress, hasProgress ? `Màn ${save.data.highestUnlockedStage} đã mở` : undefined],
      ['Chọn nhân vật', () => this.scene.start('CharacterSelectScene', { next: 'menu' })],
      ['Hướng dẫn', () => this.scene.start('InfoScene', { page: 'help' })],
      ['Cài đặt', () => this.scene.start('SettingsScene', { back: 'MenuScene' })],
      ['Credits', () => this.scene.start('InfoScene', { page: 'credits' })],
    ];
    const buttons = items.map(([label, fn, disabled, sub], i) => new MenuButton(this, bx, 200 + i * 78, label, fn, { disabled, sub, width: 360, height: 64 }));
    new MenuNav(this, buttons);
    if (hasProgress) buttons[1].emit('hover');

    this.add
      .text(GAME_W - 16, 704, 'v1.0 • Phaser 3 + TypeScript', { fontFamily: FONT, fontSize: '14px', color: '#8fa0d0' })
      .setOrigin(1, 1);
    const hint = this.add
      .text(bx, 668, 'Mũi tên/WASD để chọn • Enter để xác nhận', { fontFamily: FONT, fontSize: '16px', color: '#c9d6ff' })
      .setOrigin(0.5);
    void hint;
    this.input.once('pointerdown', () => AudioSystem.get().unlock());
    this.input.keyboard?.once('keydown', () => {
      AudioSystem.get().unlock();
      AudioSystem.get().playMusic(10);
    });
    AudioSystem.get().playMusic(10);
  }

  update(_t: number, dt: number): void {
    this.demoT += dt;
    // little demo: heroes take turns showing off moves
    if (this.demoT > 1700) {
      this.demoT = 0;
      const i = Phaser.Math.Between(0, 2);
      const id = CHARACTER_ORDER[i];
      const pool = { 'dau-dau': ['dd_l1', 'dd_fin', 'dd_s3'], 'shu-shu': ['ss_l2', 'ss_fin', 'ss_s1'], bap: ['bp_l1', 'bp_s2', 'bp_fin'] }[id];
      this.rigs[i].playMove(getMove(pool[Phaser.Math.Between(0, pool.length - 1)]));
    }
    for (const r of this.rigs) {
      if (r.animDone) r.play('idle');
      r.update(dt);
    }
  }
}
