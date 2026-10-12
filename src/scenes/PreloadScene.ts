import Phaser from 'phaser';
import { loadReferenceImages, paintAllArt } from '../art/registry';
import { FONT, GAME_W } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { SaveSystem } from '../systems/SaveSystem';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    const bar = this.add.graphics();
    const label = this.add.text(GAME_W / 2, 330, 'LITTLE HEROES', { fontFamily: FONT, fontSize: '48px', fontStyle: '800', color: '#ffd23f' }).setOrigin(0.5);
    void label;
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x1d3170, 1).fillRoundedRect(340, 390, 600, 24, 12);
      bar.fillStyle(0xffd23f, 1).fillRoundedRect(344, 394, 592 * v, 16, 8);
    });
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn(`[assets] Failed to load ${f.key} (${f.src}) – a placeholder will be used.`));
    loadReferenceImages(this);
  }

  create(): void {
    paintAllArt(this);
    const s = SaveSystem.get().data.settings;
    AudioSystem.get().setVolumes(s.musicVolume, s.sfxVolume);
    this.scene.start('MenuScene');
  }
}
