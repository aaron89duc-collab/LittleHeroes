import { AudioSystem } from './systems/AudioSystem';
import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { TouchController } from './input/TouchController';
import { installAutoFullscreen, installFullscreenGate } from './systems/Fullscreen';

const game = new Phaser.Game(gameConfig);
installAutoFullscreen();
installFullscreenGate();

// keep the canvas fitted when the browser bars / orientation change on phones
const refit = (): void => {
  setTimeout(() => game.scale.refresh(), 250);
};
window.addEventListener('orientationchange', refit);
window.visualViewport?.addEventListener('resize', refit);
document.addEventListener('fullscreenchange', refit);

// Debug handles (used by automated smoke tests in tools/). Harmless in production.
(window as unknown as { __game: Phaser.Game; __touch: TouchController }).__game = game;
(window as unknown as { __audio: AudioSystem }).__audio = AudioSystem.get();
(window as unknown as { __touch: TouchController }).__touch = TouchController.get();
