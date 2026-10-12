import type Phaser from 'phaser';
import type { AudioSystem } from '../systems/AudioSystem';
import type { SaveSettings } from './game';

/** What entities/systems may ask of the running stage. Implemented by GameWorld (avoids circular imports). */
export interface Team {
  readonly team: 'hero' | 'enemy' | 'object';
}

export interface HitEvent {
  attackerId: number;
  attackerX: number;
  dirX: 1 | -1;
  damage: number;
  knockback: number;
  launch: boolean;
  stunMs: number;
  slowMs: number;
  grab: boolean;
  breaksArmor: boolean;
  heavy: boolean;
  color: number;
  /** freeze duration for ice attacks */
  freezeMs?: number;
  fromHazard?: boolean;
}

export interface HitResult {
  landed: boolean;
  damage: number;
  blocked: boolean;
  killed: boolean;
  countered?: boolean;
}

export interface WorldFx {
  hitSpark(x: number, y: number, color: number, big: boolean): void;
  damageNumber(x: number, y: number, value: number, color: string): void;
  dust(x: number, y: number, n?: number): void;
  ring(x: number, y: number, radius: number, color: number, ms?: number): void;
  text(x: number, y: number, msg: string, color?: string, size?: number): void;
  slash(x: number, y: number, facing: 1 | -1, color: number, scale?: number): void;
  afterimage(target: Phaser.GameObjects.Container, color: number): void;
  flashScreen(color: number, ms: number): void;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface WorldLike {
  readonly scene: Phaser.Scene;
  readonly now: number;
  readonly fx: WorldFx;
  readonly audio: AudioSystem;
  readonly settings: SaveSettings;
  bounds(actor?: { team: 'hero' | 'enemy' | 'object' }): WorldBounds;
  shake(intensity: number, ms: number): void;
  hitStop(ms: number): void;
}
