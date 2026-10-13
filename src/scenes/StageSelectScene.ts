import Phaser from 'phaser';
import { STAGES } from '../config/stages';
import { FONT, UI_OFFSET } from '../game/constants';
import { SaveSystem } from '../systems/SaveSystem';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav, title } from '../ui/MenuComponents';

export class StageSelectScene extends Phaser.Scene {
  private hard = false;

  constructor() {
    super('StageSelectScene');
  }

  create(): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    new Backdrop(this, 'tower', 0.5);
    const save = SaveSystem.get().data;
    title(this, 640, 52, 'CHỌN MÀN CHƠI', 44);
    const buttons: MenuButton[] = [];
    STAGES.forEach((s, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const locked = s.id > save.highestUnlockedStage;
      const done = save.completedStages.includes(s.id);
      const best = save.bestScores[`${s.id}`];
      const b = new MenuButton(
        this,
        160 + col * 240,
        190 + row * 190,
        locked ? `🔒 Màn ${s.id}` : `${done ? '★ ' : ''}Màn ${s.id}`,
        () => this.scene.start('CharacterSelectScene', { next: 'stage', stageId: s.id, hard: this.hard }),
        { width: 220, height: 150, fontSize: 26, disabled: locked, sub: locked ? 'Chưa mở khóa' : `${s.name}${best ? `\nKỷ lục: ${best}` : ''}`, color: done ? 0x1e5a3a : 0x1d3170 },
      );
      buttons.push(b);
    });
    // sub text needs wrapping for long names
    for (const b of buttons) {
      const sub = b.list.find((o) => o instanceof Phaser.GameObjects.Text && o.style.fontSize === '16px') as Phaser.GameObjects.Text | undefined;
      sub?.setWordWrapWidth(200).setAlign('center').setY(30);
    }
    const back = new MenuButton(this, 200, 650, '◀ Menu', () => this.scene.start('MenuScene'), { width: 220, height: 56, fontSize: 24 });
    buttons.push(back);
    if (save.hardModeUnlocked) {
      const hardBtn = new MenuButton(this, 1060, 650, 'Chế độ Khó: TẮT', () => {
        this.hard = !this.hard;
        hardBtn.setLabel(`Chế độ Khó: ${this.hard ? 'BẬT' : 'TẮT'}`);
      }, { width: 300, height: 56, fontSize: 24, color: 0x6a1e1e });
      buttons.push(hardBtn);
    } else {
      this.add.text(1060, 650, 'Hoàn thành Màn 10 để mở Chế độ Khó', { fontFamily: FONT, fontSize: '18px', color: '#c9d6ff' }).setOrigin(0.5);
    }
    const nav = new MenuNav(this, buttons, 5, () => this.scene.start('MenuScene'));
    nav.focus(Math.min(save.highestUnlockedStage - 1, 9));
  }
}
