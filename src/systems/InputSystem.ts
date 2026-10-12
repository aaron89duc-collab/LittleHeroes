import Phaser from 'phaser';
import { KeyboardController } from '../input/KeyboardController';
import { TouchController } from '../input/TouchController';
import type { InputState } from '../types/game';

/** Merges keyboard + touch into one device-agnostic InputState per frame (GDD §13.2). */
export class InputSystem {
  private kb: KeyboardController;
  private touch = TouchController.get();
  readonly state: InputState = {
    moveX: 0, moveY: 0, attack: false, skill: false, dodge: false, jump: false, ultimate: false, cycleSkill: false, selectSkill: -1, pause: false,
  };

  constructor(scene: Phaser.Scene) {
    this.kb = new KeyboardController(scene);
    this.touch.reset();
  }

  poll(): InputState {
    const s = this.state;
    let mx = (this.kb.down('right') ? 1 : 0) - (this.kb.down('left') ? 1 : 0);
    let my = (this.kb.down('down') ? 1 : 0) - (this.kb.down('up') ? 1 : 0);
    if (Math.abs(this.touch.moveX) > 0.2 || Math.abs(this.touch.moveY) > 0.2) {
      mx = this.touch.moveX;
      my = this.touch.moveY;
    }
    s.moveX = Phaser.Math.Clamp(mx, -1, 1);
    s.moveY = Phaser.Math.Clamp(my, -1, 1);
    s.attack = this.kb.pressed('attack') || this.touch.consume('attack');
    s.skill = this.kb.pressed('skill') || this.touch.consume('skill');
    s.dodge = this.kb.pressed('dodge') || this.touch.consume('dodge');
    s.jump = this.kb.pressed('jump') || this.touch.consume('jump');
    s.ultimate = this.kb.pressed('ultimate') || this.touch.consume('ultimate');
    s.cycleSkill = this.kb.pressed('cycle') || this.touch.consume('cycleSkill');
    s.selectSkill = this.kb.pressed('s1') ? 0 : this.kb.pressed('s2') ? 1 : this.kb.pressed('s3') ? 2 : -1;
    s.pause = this.kb.pressed('pause') || this.touch.consume('pause');
    return s;
  }
}
