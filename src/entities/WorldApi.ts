import type { CombatSystem } from '../combat/CombatSystem';
import type { TelegraphSystem } from '../systems/TelegraphSystem';
import type { EnemyConfig } from '../types/game';
import type { WorldLike } from '../types/world';
import type { Actor } from './Actor';
import type { Player } from './Player';

export interface ProjectileOpts {
  owner: Actor;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy?: number;
  damage: number;
  color: number;
  kind: 'spit' | 'sonic' | 'energy' | 'web' | 'wave' | 'ice';
  lifeMs?: number;
  slowMs?: number;
  /** passes through targets (waves) */
  pierce?: boolean;
  /** half depth of the hit band */
  depth?: number;
  radius?: number;
  launch?: boolean;
}

/** Everything entities may ask the running stage for. Implemented by GameWorld. */
export interface GameWorldApi extends WorldLike {
  readonly combat: CombatSystem;
  readonly player: Player;
  readonly players: Player[];
  targetFor(a: { x: number; y: number }): Player;
  readonly telegraph: TelegraphSystem;
  readonly camLeft: number;
  readonly camRight: number;
  readonly assistMode: boolean;
  hostiles(): Actor[];
  spawnProjectile(o: ProjectileOpts): void;
  spawnEnemy(type: string, x?: number, y?: number): Actor | null;
  onEnemyDefeated(e: Actor, cfg?: EnemyConfig): void;
  onPlayerDefeated(p?: Player): void;
  addScore(n: number): void;
  playerFreezeMultiplier(p?: Player): number;
  /** red/white screen flash for one hero's screen (slot 0 = host, 1 = co-op guest) */
  flashFor(slot: number, color: number, ms: number): void;
}
