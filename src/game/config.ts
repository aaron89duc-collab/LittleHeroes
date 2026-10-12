import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene';
import { EndingScene } from '../scenes/EndingScene';
import { GameScene } from '../scenes/GameScene';
import { HUDScene } from '../scenes/HUDScene';
import { InfoScene } from '../scenes/InfoScene';
import { MenuScene } from '../scenes/MenuScene';
import { PauseScene } from '../scenes/PauseScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { ResultScene } from '../scenes/ResultScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { StageIntroScene } from '../scenes/StageIntroScene';
import { StageSelectScene } from '../scenes/StageSelectScene';
import { GAME_H, GAME_W } from './constants';

const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export const gameConfig: Phaser.Types.Core.GameConfig = {
  // ?renderer=canvas forces the Canvas renderer (debug / very old devices)
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0b1230',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  input: { activePointers: 4 },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  fps: { target: 60, min: 30 },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    CharacterSelectScene,
    StageSelectScene,
    StageIntroScene,
    GameScene,
    HUDScene,
    PauseScene,
    SettingsScene,
    ResultScene,
    EndingScene,
    InfoScene,
  ],
};
