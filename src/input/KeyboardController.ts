import Phaser from 'phaser';

type KeyName = 'left' | 'right' | 'up' | 'down' | 'attack' | 'skill' | 'dodge' | 'jump' | 'ultimate' | 'pause' | 'cycle' | 's1' | 's2' | 's3';

const BINDINGS: Record<KeyName, number[]> = {
  left: [Phaser.Input.Keyboard.KeyCodes.A, Phaser.Input.Keyboard.KeyCodes.LEFT],
  right: [Phaser.Input.Keyboard.KeyCodes.D, Phaser.Input.Keyboard.KeyCodes.RIGHT],
  up: [Phaser.Input.Keyboard.KeyCodes.W, Phaser.Input.Keyboard.KeyCodes.UP],
  down: [Phaser.Input.Keyboard.KeyCodes.S, Phaser.Input.Keyboard.KeyCodes.DOWN],
  attack: [Phaser.Input.Keyboard.KeyCodes.J],
  skill: [Phaser.Input.Keyboard.KeyCodes.K],
  dodge: [Phaser.Input.Keyboard.KeyCodes.L],
  jump: [Phaser.Input.Keyboard.KeyCodes.SPACE],
  ultimate: [Phaser.Input.Keyboard.KeyCodes.U],
  pause: [Phaser.Input.Keyboard.KeyCodes.ESC, Phaser.Input.Keyboard.KeyCodes.P],
  cycle: [Phaser.Input.Keyboard.KeyCodes.I, Phaser.Input.Keyboard.KeyCodes.Q],
  s1: [Phaser.Input.Keyboard.KeyCodes.ONE],
  s2: [Phaser.Input.Keyboard.KeyCodes.TWO],
  s3: [Phaser.Input.Keyboard.KeyCodes.THREE],
};

/** Keyboard bindings from GDD §6.1 (+ I/Q or 1-3 to choose the active skill). */
export class KeyboardController {
  private keys = new Map<KeyName, Phaser.Input.Keyboard.Key[]>();

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    for (const [name, codes] of Object.entries(BINDINGS) as Array<[KeyName, number[]]>) {
      this.keys.set(name, codes.map((c) => kb.addKey(c, true, false)));
    }
  }

  down(name: KeyName): boolean {
    return (this.keys.get(name) ?? []).some((k) => k.isDown);
  }

  pressed(name: KeyName): boolean {
    let any = false;
    for (const k of this.keys.get(name) ?? []) if (Phaser.Input.Keyboard.JustDown(k)) any = true;
    return any;
  }
}
