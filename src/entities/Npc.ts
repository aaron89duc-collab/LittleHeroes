import type Phaser from 'phaser';
import { HEADS } from '../art/registry';
import { HURT, VICTORY } from '../rig/Poses';
import { Rig } from '../rig/Rig';
import type { GameWorldApi } from './WorldApi';

/** Civilian to rescue (Màn 1 side objective). Walk next to them to escort them to safety. */
export class Npc {
  rescued = false;
  done = false;
  private rig: Rig;
  private bubble: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Image;
  private t = 0;

  constructor(private w: GameWorldApi, public x: number, public y: number, variant: number, private onRescue: () => void) {
    const head = HEADS[`head-civ${variant % 3}`];
    this.rig = new Rig(w.scene, { partKey: 'rig-civ', headKey: head.key, headHeight: head.height, headAnchorY: head.anchorY, scale: 0.95 });
    this.rig.setFacing(-1);
    this.rig.hold('scared', HURT, 10);
    this.shadow = w.scene.add.image(x, y, 'fx-shadow').setDepth(-5);
    this.bubble = w.scene.add
      .text(x, y - 150, 'CỨU VỚI!', { fontFamily: 'Arial Black, Arial', fontSize: '18px', color: '#ffffff', backgroundColor: '#d62f2f', padding: { x: 6, y: 3 } })
      .setOrigin(0.5);
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    this.rig.update(dt);
    if (!this.rescued) {
      this.rig.setWobble(0.8);
      const p = this.w.players.find((q) => q.alive && Math.abs(q.x - this.x) < 70 && Math.abs(q.y - this.y) < 40);
      if (p) {
        this.rescued = true;
        this.rig.setWobble(0);
        this.rig.hold('cheer', VICTORY, 120);
        this.bubble.setText('CẢM ƠN!').setBackgroundColor('#22a35a');
        this.w.fx.text(this.x, this.y - 190, '+500 Giải cứu!', '#7dff6a', 26);
        this.w.audio.play('pickup');
        this.onRescue();
      }
    } else if (this.t > 0) {
      // run away to the left (safe zone)
      this.x -= 260 * (dt / 1000);
      this.rig.setFacing(-1);
      this.rig.play('walk');
      if (this.x < this.w.camLeft - 120) this.destroy();
    }
    this.rig.setPosition(this.x, this.y).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + 2);
    this.bubble.setPosition(this.x, this.y - 165 + Math.sin(this.t / 150) * 4).setDepth(this.y + 1);
  }

  destroy(): void {
    if (this.done) return;
    this.done = true;
    this.rig.destroy();
    this.bubble.destroy();
    this.shadow.destroy();
  }
}
