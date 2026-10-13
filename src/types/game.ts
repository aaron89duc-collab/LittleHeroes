// Core shared types. Pure data only: no Phaser imports here so configs/tests stay engine-free.

export type CharacterId = 'dau-dau' | 'shu-shu' | 'bap';

export type FighterState =
  | 'idle'
  | 'move'
  | 'jump'
  | 'attack'
  | 'skill'
  | 'dodge'
  | 'hurt'
  | 'knockdown'
  | 'getup'
  | 'victory'
  | 'defeat';

export interface CharacterStats {
  id: CharacterId;
  displayName: string;
  title: string;
  description: string;
  maxHp: number;
  attackMultiplier: number;
  moveSpeed: number; // relative (1 = 200 px/s)
  damageReceivedMultiplier: number;
  reach: number;
  maxEnergy: number;
  comboWindowMs: number;
  palette: HeroPalette;
  /** UI stat bars 0..5 */
  ui: { power: number; speed: number; defense: number };
  lightChain: [string, string, string];
  jumpAttack: string;
  skills: [string, string, string];
  ultimate: string;
}

export interface HeroPalette {
  suit: number;
  suitDark: number;
  accent: number;
  vest: number;
  glove: number;
  boot: number;
  skin: number;
  tail?: number;
}

export type HitShape = 'front' | 'around' | 'line';

export interface MoveHit {
  /** ms after the move starts when this hit becomes active */
  at: number;
  /** active window length */
  activeMs: number;
  damage: number;
  knockback: number;
  /** horizontal reach in px in front of the fighter (or radius for 'around') */
  range: number;
  /** vertical (lane) tolerance */
  depth: number;
  shape: HitShape;
  launch?: boolean; // causes knockdown
  stun?: number; // ms hitstun override
  slow?: number; // ms of slow applied
  grab?: boolean; // grab-throw (cannot affect bosses beyond damage + stagger)
  breaksArmor?: boolean;
}

export interface MoveConfig {
  id: string;
  name: string;
  kind: 'light' | 'finisher' | 'jump' | 'skill' | 'ultimate';
  baseDamage: number; // total design damage (sum of hits) – documentation / tests
  startupMs: number;
  activeMs: number;
  recoveryMs: number;
  energyCost: number;
  cooldownMs: number;
  knockback: number;
  multiHit?: boolean;
  canHitBoss?: boolean;
  /** forward dash distance over the move duration */
  dash?: number;
  iframes?: [number, number]; // invulnerable window [from, to] ms
  hits: MoveHit[];
  /** animation id used by the rig */
  anim: string;
  /** Damage multiplier applied from the third simultaneous target onwards */
  extraTargetFalloff?: number;
  color?: number;
  /** ms window during which the next chain input may cancel recovery */
  cancelFrom?: number;
  counter?: boolean; // dodge-counter move (Shu Shu skill 2)
}

export type EnemyArchetype = 'grunt' | 'runner' | 'brute' | 'leaper' | 'flyer' | 'spitter' | 'summoner' | 'clone';

/** Sprite-sheet body from the user's asset packs (replaces the puppet rig). */
export interface SpriteRef {
  key: string;
  scale: number;
  tint?: number;
}

export interface EnemyConfig {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  maxHp: number;
  moveSpeed: number; // px/s
  damage: number;
  damageReceivedMultiplier: number;
  contactRange: number;
  attackCooldownMs: number;
  telegraphMs: number;
  scale: number;
  head: string; // texture key
  palette: { body: number; dark: number; skin: number; accent: number };
  score: number;
  drops: { health: number; energy: number; token: number };
  armor?: boolean;
  projectile?: { speed: number; damage: number; color: number; kind: 'spit' | 'sonic' | 'energy' | 'web' };
  sprite?: SpriteRef;
}

export type BossMoveKind =
  | 'combo'
  | 'charge'
  | 'slam'
  | 'projectile'
  | 'summon'
  | 'teleport'
  | 'clones'
  | 'leap'
  | 'dive'
  | 'freezeZone'
  | 'iceWall'
  | 'blizzard'
  | 'wave'
  | 'curl';

export interface BossMove {
  kind: BossMoveKind;
  damage: number;
  telegraphMs: number;
  recoveryMs: number;
  weight: number;
  range?: number;
  count?: number;
  summon?: string;
  color?: number;
}

export interface BossPhase {
  hpBelow: number; // phase active when hp ratio <= this (first phase uses 1)
  speedMul: number;
  damageMul: number;
  moves: BossMove[];
  message?: string;
}

export type BossBody = 'humanoid' | 'spider' | 'crab' | 'bat' | 'bear';

export interface BossConfig {
  id: string;
  name: string;
  maxHp: number;
  moveSpeed: number;
  damageReceivedMultiplier: number;
  scale: number;
  body: BossBody;
  head: string;
  palette: { body: number; dark: number; skin: number; accent: number };
  phases: BossPhase[];
  maxStaggerPerWindow: number; // anti stun-lock: how many flinches per 4s window
  armored?: boolean; // e.g. needs pillars destroyed
  score: number;
  sprite?: SpriteRef;
  /** sprite used after the phase-2 transformation (Hắc Ảnh) */
  transformSprite?: SpriteRef;
}

export type HazardKind =
  | 'falling'
  | 'train'
  | 'steam'
  | 'conveyor'
  | 'container'
  | 'energyFloor'
  | 'wind'
  | 'ice'
  | 'icicle'
  | 'laser'
  | 'shelf'
  | 'chaos';

export interface HazardConfig {
  kind: HazardKind;
  intervalMs: number;
  warningMs: number;
  damage: number;
}

export interface WaveConfig {
  enemies: Array<{ type: string; count: number }>;
  delayBeforeNextMs?: number;
  /** maximum simultaneously alive enemies for this wave */
  maxAlive?: number;
}

export type StageTheme =
  | 'street'
  | 'mall'
  | 'subway'
  | 'factory'
  | 'port'
  | 'lab'
  | 'rooftop'
  | 'ice'
  | 'tower'
  | 'chaos';

export interface StageConfig {
  id: number;
  name: string;
  theme: StageTheme;
  backgroundKey: string;
  cardKey?: string;
  story: string;
  waves: WaveConfig[];
  bossId: string;
  secondBossId?: string;
  objectives: string[];
  rewardScore: number;
  reward: string;
  hazards: HazardConfig[];
  rescueNpcs?: number;
  pillars?: { count: number; hp: number; label: string };
  enemyHpMul: number;
  enemyDmgMul: number;
  music: number; // music pattern index
  rain?: boolean;
  snow?: boolean;
}

export interface SaveSettings {
  musicVolume: number;
  sfxVolume: number;
  cameraShake: boolean;
  touchControlsOpacity: number;
  reduceFlash: boolean;
  showTouch: 'auto' | 'on' | 'off';
}

export interface SaveData {
  version: 1;
  selectedCharacter: CharacterId;
  highestUnlockedStage: number;
  completedStages: number[];
  bestScores: Record<string, number>;
  settings: SaveSettings;
  hardModeUnlocked: boolean;
}

export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  attack: boolean; // pressed this frame
  skill: boolean;
  dodge: boolean;
  jump: boolean;
  ultimate: boolean;
  cycleSkill: boolean;
  selectSkill: number; // -1 none, 0..2
  pause: boolean;
}
