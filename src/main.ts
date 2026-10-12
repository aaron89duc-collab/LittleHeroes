import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { TouchController } from './input/TouchController';

const game = new Phaser.Game(gameConfig);

// Debug handles (used by automated smoke tests in tools/). Harmless in production.
(window as unknown as { __game: Phaser.Game; __touch: TouchController }).__game = game;
(window as unknown as { __touch: TouchController }).__touch = TouchController.get();
