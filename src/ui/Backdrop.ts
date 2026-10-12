import Phaser from 'phaser';
import { paintBackground } from '../art/registry';
import { FLOOR_TOP, GAME_H, GAME_W } from '../game/constants';
import type { StageTheme } from '../types/game';

/** Slowly scrolling parallax background used behind menus. */
export class Backdrop {
  private far: Phaser.GameObjects.TileSprite;
  private mid: Phaser.GameObjects.TileSprite;
  private floor: Phaser.GameObjects.TileSprite;
  private t = 0;

  constructor(scene: Phaser.Scene, theme: StageTheme = 'street', dim = 0.35) {
    const k = paintBackground(scene, theme);
    this.far = scene.add.tileSprite(0, 0, GAME_W, GAME_H, k.far).setOrigin(0).setScrollFactor(0);
    this.mid = scene.add.tileSprite(0, 0, GAME_W, FLOOR_TOP, k.mid).setOrigin(0).setScrollFactor(0);
    this.floor = scene.add.tileSprite(0, FLOOR_TOP - 40, GAME_W, GAME_H - FLOOR_TOP + 40, k.floor).setOrigin(0).setScrollFactor(0);
    if (dim > 0) scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x05081a, dim).setOrigin(0);
    const fn = (_t: number, dt: number): void => this.update(dt);
    scene.events.on('update', fn);
    scene.events.once('shutdown', () => scene.events.off('update', fn));
  }

  update(dt: number): void {
    this.t += dt * 0.03;
    this.far.tilePositionX = this.t * 0.15;
    this.mid.tilePositionX = this.t * 0.5;
    this.floor.tilePositionX = this.t;
  }
}
