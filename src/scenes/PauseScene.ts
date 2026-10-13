import Phaser from 'phaser';
import { GAME_H, GAME_W, UI_OFFSET } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { TouchController } from '../input/TouchController';
import { MenuButton, MenuNav, panel, title } from '../ui/MenuComponents';

interface PauseData {
  stageId: number;
  hard?: boolean;
}

/** Pause overlay: the GameScene is paused (logic, tweens, timers, hazards all stop). */
export class PauseScene extends Phaser.Scene {
  private d!: PauseData;
  private confirming: 'restart' | 'menu' | null = null;

  constructor() {
    super('PauseScene');
  }

  init(d: PauseData): void {
    this.d = d;
    this.confirming = null;
  }

  create(): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.6).setOrigin(0).setScrollFactor(0);
    panel(this, 400, 110, 480, 500);
    title(this, 640, 160, 'TẠM DỪNG', 44);
    const resume = new MenuButton(this, 640, 250, 'Tiếp tục', () => this.resumeGame(), { width: 380 });
    const restart: MenuButton = new MenuButton(this, 640, 330, 'Chơi lại màn', () => {
      if (this.confirming !== 'restart') {
        this.confirming = 'restart';
        restart.setLabel('Mất tiến trình màn — Xác nhận?');
        return;
      }
      this.leave(() => this.scene.start('GameScene', { stageId: this.d.stageId, hard: this.d.hard }), 'GameScene');
    }, { width: 380 });
    const settings = new MenuButton(this, 640, 410, 'Cài đặt âm thanh', () => {
      this.scene.pause();
      this.scene.launch('SettingsScene', { back: 'PauseScene' });
      this.scene.bringToTop('SettingsScene');
    }, { width: 380 });
    const menu: MenuButton = new MenuButton(this, 640, 490, 'Về menu', () => {
      if (this.confirming !== 'menu') {
        this.confirming = 'menu';
        menu.setLabel('Thoát màn — Xác nhận?');
        return;
      }
      this.leave(() => this.scene.start('MenuScene'), 'MenuScene');
    }, { width: 380, color: 0x6a1e1e });
    new MenuNav(this, [resume, restart, settings, menu], 1, () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    TouchController.get().reset();
    AudioSystem.get().setDuck(false);
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  private leave(go: () => void, _target: string): void {
    AudioSystem.get().setDuck(false);
    this.scene.stop('HUDScene');
    this.scene.stop('GameScene');
    go();
  }
}
