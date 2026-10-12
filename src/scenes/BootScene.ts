import Phaser from 'phaser';
import { FONT } from '../game/constants';

/** Loads the UI web font (with a timeout fallback) before anything renders text. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.add.text(640, 360, 'Đang tải...', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const load = fonts
      ? Promise.all([fonts.load(`800 32px ${FONT}`), fonts.load(`400 20px ${FONT}`)]).catch(() => undefined)
      : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2500));
    void Promise.race([load, timeout]).then(() => this.scene.start('PreloadScene'));
  }
}
