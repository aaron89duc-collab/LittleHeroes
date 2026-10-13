import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W, UI_OFFSET } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { Backdrop } from '../ui/Backdrop';
import { MenuButton, MenuNav, panel, title } from '../ui/MenuComponents';

interface SettingsData {
  back: 'MenuScene' | 'PauseScene';
}

/** Audio / accessibility / touch settings (GDD §12.5). Saved through SaveSystem only. */
export class SettingsScene extends Phaser.Scene {
  private d!: SettingsData;
  private confirmReset = false;

  constructor() {
    super('SettingsScene');
  }

  init(d: SettingsData): void {
    this.d = d;
    this.confirmReset = false;
  }

  create(): void {
    this.cameras.main.setScroll(-UI_OFFSET, 0);
    if (this.d.back === 'MenuScene') new Backdrop(this, 'mall', 0.6);
    else this.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.75).setOrigin(0).setScrollFactor(0);
    panel(this, 240, 40, 800, 620);
    title(this, 640, 84, 'CÀI ĐẶT', 40);
    const save = SaveSystem.get();
    const s = () => save.data.settings;
    const pct = (v: number): string => `${Math.round(v * 100)}%`;
    const applyAudio = (): void => AudioSystem.get().setVolumes(s().musicVolume, s().sfxVolume);
    const step = (v: number, d: number): number => Math.round(Math.min(1, Math.max(0, v + d)) * 10) / 10;

    const rows: Array<{ label: () => string; act: () => void }> = [
      { label: () => `Nhạc nền: ${pct(s().musicVolume)}`, act: () => { save.updateSettings({ musicVolume: s().musicVolume >= 1 ? 0 : step(s().musicVolume, 0.1) }); applyAudio(); } },
      { label: () => `Hiệu ứng âm thanh: ${pct(s().sfxVolume)}`, act: () => { save.updateSettings({ sfxVolume: s().sfxVolume >= 1 ? 0 : step(s().sfxVolume, 0.1) }); applyAudio(); AudioSystem.get().play('punch'); } },
      { label: () => `Rung màn hình: ${s().cameraShake ? 'BẬT' : 'TẮT'}`, act: () => save.updateSettings({ cameraShake: !s().cameraShake }) },
      { label: () => `Giảm hiệu ứng nháy sáng: ${s().reduceFlash ? 'BẬT' : 'TẮT'}`, act: () => save.updateSettings({ reduceFlash: !s().reduceFlash }) },
      { label: () => `Nút cảm ứng: ${{ auto: 'TỰ ĐỘNG', on: 'LUÔN HIỆN', off: 'ẨN' }[s().showTouch]}`, act: () => save.updateSettings({ showTouch: s().showTouch === 'auto' ? 'on' : s().showTouch === 'on' ? 'off' : 'auto' }) },
      { label: () => `Độ trong nút cảm ứng: ${pct(s().touchControlsOpacity)}`, act: () => save.updateSettings({ touchControlsOpacity: s().touchControlsOpacity >= 0.95 ? 0.2 : step(s().touchControlsOpacity, 0.15) }) },
    ];
    const buttons: MenuButton[] = rows.map((r, i) => {
      const b: MenuButton = new MenuButton(this, 640, 150 + i * 66, r.label(), () => {
        r.act();
        b.setLabel(r.label());
      }, { width: 620, height: 56, fontSize: 23 });
      return b;
    });
    this.add.text(640, 548, 'Nhấn để thay đổi • Âm lượng tăng 10% mỗi lần, quay về 0 sau 100%', { fontFamily: FONT, fontSize: '15px', color: '#c9d6ff' }).setOrigin(0.5);
    if (this.d.back === 'MenuScene') {
      const reset: MenuButton = new MenuButton(this, 820, 610, 'Xóa tiến trình', () => {
        if (!this.confirmReset) {
          this.confirmReset = true;
          reset.setLabel('Chắc chắn? Nhấn lần nữa');
          return;
        }
        save.resetProgress();
        reset.setLabel('Đã xóa tiến trình');
      }, { width: 320, height: 54, fontSize: 20, color: 0x6a1e1e });
      buttons.push(reset);
    }
    const back = new MenuButton(this, this.d.back === 'MenuScene' ? 460 : 640, 610, '◀ Xong', () => this.close(), { width: 240, height: 54, fontSize: 24 });
    buttons.push(back);
    new MenuNav(this, buttons, 1, () => this.close());
  }

  private close(): void {
    if (this.d.back === 'PauseScene') {
      this.scene.stop();
      this.scene.resume('PauseScene');
      this.scene.get('PauseScene').events.emit('settings-closed');
    } else this.scene.start('MenuScene');
  }
}
