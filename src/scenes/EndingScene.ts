import Phaser from 'phaser';
import { CHARACTER_ORDER } from '../config/characters';
import { FONT, GAME_H, GAME_W, UI_OFFSET } from '../game/constants';
import { VICTORY, VICTORY2 } from '../rig/Poses';
import { createHeroView, type HeroViewT } from '../rig/HeroSpriteView';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav, title } from '../ui/MenuComponents';
import type { ResultData } from './ResultScene';

const LINES = [
  'Lõi Hỗn Mang vỡ tan. Cổng không gian từ từ khép lại...',
  'Những sinh vật biến dị trở về hình dạng ban đầu.',
  'Đậu Đậu, Shu Shu và Bắp trở về Thành phố Ánh Dương trong tiếng reo hò.',
  'Nhưng trong một góc tối, một mảnh lõi nhỏ vẫn còn le lói ánh tím...',
];

/** Short ending cinematic (GDD §4.4) followed by campaign results. */
export class EndingScene extends Phaser.Scene {
  private rigs: HeroViewT[] = [];
  private step = 0;

  constructor() {
    super('EndingScene');
  }

  create(d: ResultData): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    this.rigs = [];
    this.step = 0;
    new Backdrop(this, 'street', 0.2);
    const dawn = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xffa860, 0).setOrigin(0).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: dawn, fillAlpha: 0.25, duration: 6000 });
    CHARACTER_ORDER.forEach((id, i) => {
      const r = createHeroView(this, id, 1.8);
      r.setPosition(380 + i * 260, 660);
      r.hold('v', i % 2 ? VICTORY2 : VICTORY, 300);
      this.rigs.push(r);
    });
    const text = (this.storyText = this.add
      .text(640, 150, '', { fontFamily: FONT, fontSize: '30px', fontStyle: '700', color: '#ffffff', stroke: '#0b1230', strokeThickness: 6, align: 'center', wordWrap: { width: 1000 } })
      .setOrigin(0.5));
    const shard = this.add.image(1180, 640, 'fx-glow').setTint(0xb44dff).setScale(0.6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    AudioSystem.get().playMusic(11);
    const next = (): void => {
      if (this.step < LINES.length) {
        text.setText(LINES[this.step]).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 500 });
        if (this.step === LINES.length - 1) this.tweens.add({ targets: shard, alpha: 1, scale: 0.9, yoyo: true, repeat: -1, duration: 700 });
        this.step++;
        this.time.delayedCall(3200, next);
      } else this.showResults(d);
    };
    next();
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.step <= LINES.length) {
        this.step = LINES.length;
        this.showResults(d);
      }
    });
  }

  private shown = false;
  private storyText: Phaser.GameObjects.Text | null = null;

  private showResults(d: ResultData): void {
    if (this.shown) return;
    this.shown = true;
    this.storyText?.setVisible(false);
    const save = SaveSystem.get().data;
    const total = Object.values(save.bestScores).reduce((a, b) => a + b, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05081a, 0.6).setOrigin(0).setScrollFactor(0);
    title(this, 640, 140, 'CHIẾN DỊCH HOÀN THÀNH!', 58);
    this.add.text(640, 220, `Tổng điểm kỷ lục 10 màn: ${total}\nĐiểm màn cuối: ${d.total ?? d.score}`, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 300, 'Đã mở khóa: CHẾ ĐỘ KHÓ cho cả 10 màn!', { fontFamily: FONT, fontSize: '26px', fontStyle: '800', color: '#ff8a3d' }).setOrigin(0.5);
    const b1 = new MenuButton(this, 480, 390, 'Chơi lại từ đầu', () => this.scene.start('CharacterSelectScene', { next: 'stage', stageId: 1 }), { width: 300 });
    const b2 = new MenuButton(this, 800, 390, 'Menu', () => this.scene.start('MenuScene'), { width: 240 });
    new MenuNav(this, [b1, b2], 2);
    AudioSystem.get().play('victory');
  }

  update(_t: number, dt: number): void {
    for (const r of this.rigs) r.update(dt);
  }
}
