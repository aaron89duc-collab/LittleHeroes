import Phaser from 'phaser';
import { paintBackground } from '../art/registry';
import { getStage } from '../config/stages';
import { FONT, GAME_H, GAME_W } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { panel, title } from '../ui/MenuComponents';

const BRIEF = [
  'Bọn côn đồ đang quấy phá phố đêm. Nhớ cứu người dân!',
  'Coi chừng kệ hàng đổ và băng chuyền trong trung tâm thương mại.',
  'Đèn đỏ nhấp nháy là tàu sắp đến — tránh xa đường ray!',
  'Phá trụ năng lượng trước, giáp của gã khổng lồ sẽ vỡ.',
  'Container có thể rơi bất cứ lúc nào. Nhìn bóng cảnh báo!',
  'Đánh đúng bản thể thật để chặn hắn hồi phục.',
  'Gió mạnh trên mái nhà. Phản công ngay sau cú lao của boss!',
  'Đứng gần lò sưởi để tan băng nhanh hơn.',
  'Laser quét sàn — nhảy qua đúng lúc!',
  'Trận chiến cuối cùng. Cả thành phố trông cậy vào các bạn!',
];

interface IntroData {
  stageId: number;
  hard?: boolean;
  checkpoint?: boolean;
}

/** Stage card: art, story and objectives (GDD §6.3 step 2). */
export class StageIntroScene extends Phaser.Scene {
  private d!: IntroData;
  private started = false;

  constructor() {
    super('StageIntroScene');
  }

  init(d: IntroData): void {
    this.d = d;
    this.started = false;
  }

  create(): void {
    const s = getStage(this.d.stageId);
    const bg = paintBackground(this, s.theme);
    this.add.tileSprite(0, 0, GAME_W, GAME_H, bg.far).setOrigin(0);
    this.add.tileSprite(0, 0, GAME_W, 452, bg.mid).setOrigin(0);
    this.add.tileSprite(0, 412, GAME_W, GAME_H - 412, bg.floor).setOrigin(0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x05081a, 0.55).setOrigin(0);
    panel(this, 60, 70, 1160, 580);
    // art card: reference postcard when one matches, otherwise a live render of the stage background
    const cardX = 110;
    const cardY = 130;
    if (s.cardKey && this.textures.exists(s.cardKey)) {
      this.add.image(cardX, cardY, s.cardKey).setOrigin(0).setDisplaySize(460, 262);
    } else {
      const k = 460 / GAME_W;
      this.add.image(cardX, cardY, bg.far).setOrigin(0).setScale(k, 262 / GAME_H);
      this.add.image(cardX, cardY + 262 - 452 * k, bg.mid).setOrigin(0).setScale(k);
    }
    const fr = this.add.graphics();
    fr.lineStyle(5, 0xffd23f, 1).strokeRoundedRect(cardX - 4, cardY - 4, 468, 270, 10);

    title(this, 340, 430, `MÀN ${s.id}${this.d.hard ? ' • KHÓ' : ''}`, 54, '#ffd23f');
    title(this, 340, 488, s.name, 32, '#ffffff');
    this.add.text(620, 130, s.story, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', wordWrap: { width: 560 }, lineSpacing: 6 });
    this.add.text(620, 290, 'MỤC TIÊU', { fontFamily: FONT, fontSize: '24px', fontStyle: '800', color: '#ffd23f' });
    s.objectives.forEach((o, i) => this.add.text(640, 326 + i * 34, `• ${o}`, { fontFamily: FONT, fontSize: '21px', color: '#e8eeff', wordWrap: { width: 540 } }));
    this.add.text(620, 430, `Phần thưởng: ${s.reward}`, { fontFamily: FONT, fontSize: '19px', color: '#9ad0ff', wordWrap: { width: 560 } });
    // commander briefing (portrait from the user's asset pack)
    const cmd = `commander-${((s.id - 1) % 6) + 1}`;
    if (this.textures.exists(cmd)) {
      this.add.image(680, 520, cmd).setDisplaySize(118, 118);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.95).fillRoundedRect(752, 470, 440, 92, 14);
      g.fillTriangle(752, 506, 738, 516, 752, 526);
      const tip = this.d.checkpoint ? 'Bắt đầu từ CHECKPOINT trước boss. Hồi sức xong thì xông lên!' : BRIEF[s.id - 1] ?? 'Cẩn thận nhé, đội đặc nhiệm!';
      this.add.text(768, 480, `Chỉ huy: ${tip}`, { fontFamily: FONT, fontSize: '18px', color: '#13204a', wordWrap: { width: 410 } });
    } else if (this.d.checkpoint) this.add.text(620, 470, 'Bắt đầu từ CHECKPOINT trước boss', { fontFamily: FONT, fontSize: '20px', fontStyle: '800', color: '#7dff6a' });
    const go = this.add
      .text(640, 590, 'Nhấn ENTER hoặc chạm màn hình để bắt đầu', { fontFamily: FONT, fontSize: '28px', fontStyle: '800', color: '#ffffff', stroke: '#b3261e', strokeThickness: 6 })
      .setOrigin(0.5);
    this.tweens.add({ targets: go, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    this.add.text(640, 630, 'J đánh • K kỹ năng • I đổi kỹ năng • L né • Space nhảy • U tuyệt kỹ • Esc tạm dừng', { fontFamily: FONT, fontSize: '17px', color: '#c9d6ff' }).setOrigin(0.5);

    const start = (): void => {
      if (this.started) return;
      this.started = true;
      AudioSystem.get().unlock();
      AudioSystem.get().play('confirm');
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene', { stageId: s.id, hard: this.d.hard, checkpoint: this.d.checkpoint }));
    };
    this.time.delayedCall(350, () => {
      this.input.once('pointerdown', start);
      this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'j' || e.key === 'J') start();
        if (e.key === 'Escape') this.scene.start('MenuScene');
      });
    });
    AudioSystem.get().playMusic(s.music);
  }
}
