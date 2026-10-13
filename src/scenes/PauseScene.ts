import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, UI_OFFSET } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { TouchController } from '../input/TouchController';
import { MenuButton, MenuNav, panel, title } from '../ui/MenuComponents';
import { CoopNet } from '../net/Net';

interface PauseData {
  stageId: number;
  hard?: boolean;
  /** online co-op: 'host' pauses the stage for both, 'guest' only opens this menu (the host keeps playing) */
  coop?: 'host' | 'guest';
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
    if (this.d.coop) {
      this.createCoop(this.d.coop);
      return;
    }
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

  /** Co-op menu: continue / sound / leave the room (no restart: the stage is shared). */
  private createCoop(mode: 'host' | 'guest'): void {
    panel(this, 400, 130, 480, 440);
    title(this, 640, 180, mode === 'host' ? 'TẠM DỪNG' : 'MENU', 44);
    this.add
      .text(640, 226, mode === 'host' ? 'Trận đấu đang dừng cho cả hai người' : 'Trận đấu vẫn đang tiếp diễn!', { fontFamily: FONT, fontSize: '18px', color: '#c9d6ff' })
      .setOrigin(0.5);
    const resume = new MenuButton(this, 640, 290, 'Tiếp tục', () => this.resumeGame(), { width: 380 });
    const settings = new MenuButton(this, 640, 370, 'Cài đặt âm thanh', () => {
      this.scene.pause();
      this.scene.launch('SettingsScene', { back: 'PauseScene' });
      this.scene.bringToTop('SettingsScene');
    }, { width: 380 });
    const leave: MenuButton = new MenuButton(this, 640, 450, 'Rời phòng', () => {
      if (this.confirming !== 'menu') {
        this.confirming = 'menu';
        leave.setLabel('Rời phòng — Xác nhận?');
        return;
      }
      CoopNet.get().leave();
      AudioSystem.get().setDuck(false);
      this.scene.stop('HUDScene');
      this.scene.stop(mode === 'host' ? 'GameScene' : 'CoopGuestScene');
      this.scene.start('MenuScene');
    }, { width: 380, color: 0x6a1e1e });
    new MenuNav(this, [resume, settings, leave], 1, () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    // the co-op guest scene polls Esc too: don't let the same key press reopen this menu
    this.registry.set('pauseClosedAt', performance.now());
    TouchController.get().reset();
    AudioSystem.get().setDuck(false);
    this.scene.stop();
    if (this.d.coop === 'guest') return; // the guest scene never paused
    this.scene.resume('GameScene');
  }

  private leave(go: () => void, _target: string): void {
    AudioSystem.get().setDuck(false);
    this.scene.stop('HUDScene');
    this.scene.stop('GameScene');
    go();
  }
}
