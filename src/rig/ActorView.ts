import type { MoveConfig } from '../types/game';
import type { Pose } from './Poses';

/** Visual contract shared by the puppet Rig and the procedural CreatureView. */
export interface ActorView {
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
  setPosition(x: number, y: number): unknown;
  setDepth(d: number): unknown;
  setAlpha(a: number): unknown;
  setVisible(v: boolean): unknown;
  setFacing(f: 1 | -1): void;
  setBaseScale(s: number): void;
  play(name: string, force?: boolean): void;
  hold(name: string, pose: Pose, blendMs?: number): void;
  playMove(move: MoveConfig, speed?: number): void;
  playAttack(name: string, telegraphMs: number, activeMs: number, recoveryMs: number): void;
  flash(ms?: number): void;
  setLie(deg: number): void;
  setTintAll(color: number | null): void;
  setWobble(v: number): void;
  update(dtMs: number): void;
  /** optional: play a death animation (sprite bodies) */
  setDead?(): void;
  destroy(): void;
  readonly currentAnim: string;
  readonly animDone: boolean;
  readonly visualHeight: number;
}
