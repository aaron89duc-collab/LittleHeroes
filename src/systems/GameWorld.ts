import Phaser from 'phaser';
import { CombatSystem } from '../combat/CombatSystem';
import { getEnemy } from '../config/enemies';
import type { Actor } from '../entities/Actor';
import { Boss, type BossWorldApi } from '../entities/Boss';
import { Enemy } from '../entities/Enemy';
import { Npc } from '../entities/Npc';
import { Pickup, type PickupKind } from '../entities/Pickup';
import { Pillar } from '../entities/Pillar';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import type { ProjectileOpts } from '../entities/WorldApi';
import { FLOOR_BOTTOM, FLOOR_TOP, GAME_W, MAX_ENEMIES_ON_SCREEN } from '../game/constants';
import type { BossPhase, CharacterId, EnemyConfig, InputState, SaveSettings, StageConfig } from '../types/game';
import type { WorldBounds } from '../types/world';
import { AudioSystem } from './AudioSystem';
import { EffectsSystem } from './EffectsSystem';
import { TelegraphSystem } from './TelegraphSystem';

export interface WorldEvents {
  enemyDefeated(e: Actor, cfg?: EnemyConfig): void;
  bossDefeated(b: Boss): void;
  bossPhase(b: Boss, phase: BossPhase, index: number): void;
  playerDefeated(p: Player): void;
}

export interface RunStats {
  kills: number;
  maxCombo: number;
  rescued: number;
  damageTaken: number;
  timeMs: number;
}

/**
 * Owns all live entities of a stage and implements the API they use (BossWorldApi).
 * Logic time (`now`) advances only while the scene updates, so pause freezes everything.
 */
export class GameWorld implements BossWorldApi {
  now = 0;
  readonly fx: EffectsSystem;
  readonly audio = AudioSystem.get();
  readonly combat: CombatSystem;
  readonly telegraph: TelegraphSystem;
  /** players[0] = local / host hero, players[1] = online co-op partner (host simulates both). */
  players: Player[] = [];
  enemies: Enemy[] = [];
  bosses: Boss[] = [];
  pillars: Pillar[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  npcs: Npc[] = [];
  heaters: Array<{ x: number; y: number }> = [];
  score = 0;
  stats: RunStats = { kills: 0, maxCombo: 0, rescued: 0, damageTaken: 0, timeMs: 0 };
  assistMode = false;
  freezeReduction = 1;
  /** camera-locked arena, or null when travelling */
  lock: { left: number; right: number } | null = null;
  stageWidth = 6000;
  private hitStopMs = 0;
  private events: WorldEvents | null = null;
  private blizzard = false;
  timeScale = 1;
  /** Logical play-field width: GAME_W, or the narrower of both screens in online co-op. */
  viewW = GAME_W;
  /** Left edge of the play field in world space (the camera is centred on it). */
  viewLeft = 0;
  private targetMemo = new WeakMap<object, { p: Player; at: number }>();

  constructor(
    readonly scene: Phaser.Scene,
    readonly stage: StageConfig,
    readonly settings: SaveSettings,
  ) {
    this.fx = new EffectsSystem(scene);
    this.fx.reduceFlash = settings.reduceFlash;
    this.telegraph = new TelegraphSystem(scene, () => this.now);
    this.combat = new CombatSystem(
      () => this.now,
      (team) => (team === 'hero' ? this.hostileTargets() : this.players),
    );
  }

  /** Host hero (also the only hero in single player). */
  get player(): Player {
    return this.players[0];
  }

  get coop(): boolean {
    return this.players.length > 1;
  }

  alivePlayers(): Player[] {
    return this.players.filter((p) => p.alive);
  }

  /** x of the hero furthest to the right (stage progress). */
  get leadX(): number {
    let x = -Infinity;
    for (const p of this.players) x = Math.max(x, p.x);
    return x;
  }

  /**
   * Which hero an enemy should chase: the nearest living one, kept for a while so enemies do not flip
   * back and forth between two heroes standing close together.
   */
  targetFor(a: { x: number; y: number }): Player {
    if (this.players.length === 1) return this.players[0];
    const alive = this.alivePlayers();
    if (!alive.length) return this.players[0];
    const d = (p: Player) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y) * 1.5;
    let best = alive[0];
    for (const p of alive) if (d(p) < d(best)) best = p;
    const memo = this.targetMemo.get(a);
    if (memo && memo.p.alive && memo.p !== best && this.now - memo.at < 2500 && d(memo.p) - d(best) < 220) return memo.p;
    if (!memo || memo.p !== best) this.targetMemo.set(a, { p: best, at: this.now });
    return best;
  }

  /** Puts the camera so that the logical play field [viewLeft, viewLeft + viewW] sits in the middle of the screen. */
  syncCamera(): void {
    this.cam.scrollX = this.viewLeft - (GAME_W - this.viewW) / 2;
  }

  setEvents(e: WorldEvents): void {
    this.events = e;
  }

  createPlayer(id: CharacterId, x: number, y: number): Player {
    const p = new Player(this, id, x, y);
    p.slot = this.players.length;
    this.players.push(p);
    return p;
  }

  /** Online partner left: remove their hero, the stage continues solo. */
  removePlayer(p: Player): void {
    const i = this.players.indexOf(p);
    if (i <= 0) return;
    this.combat.cancelAttacksOf(p);
    p.destroy();
    this.players.splice(i, 1);
  }

  get cam(): Phaser.Cameras.Scene2D.Camera {
    return this.scene.cameras.main;
  }

  get camLeft(): number {
    return this.viewLeft;
  }

  get camRight(): number {
    return this.viewLeft + this.viewW;
  }

  bounds(actor?: { team: 'hero' | 'enemy' | 'object' }): WorldBounds {
    const left = this.lock ? this.lock.left : this.camLeft;
    const right = this.lock ? this.lock.right : Math.min(this.stageWidth, this.camRight);
    if (actor && actor.team === 'enemy' && (actor as Enemy).aiState === 'spawn') {
      return { minX: this.camLeft - 220, maxX: this.camRight + 220, minY: FLOOR_TOP, maxY: FLOOR_BOTTOM };
    }
    return { minX: left, maxX: right, minY: FLOOR_TOP, maxY: FLOOR_BOTTOM };
  }

  /** co-op host: camera shakes are forwarded to the guest */
  onShake: ((intensity: number, ms: number) => void) | null = null;
  /** co-op host: screen flashes meant for the guest's hero */
  onFlash: ((color: number, ms: number) => void) | null = null;

  flashFor(slot: number, color: number, ms: number): void {
    if (slot === 0) this.fx.flashScreen(color, ms);
    else this.onFlash?.(color, ms);
  }

  shake(intensity: number, ms: number, only?: number): void {
    if (only !== 0) this.onShake?.(intensity, ms);
    if (only === 1) return;
    if (!this.settings.cameraShake) return;
    this.cam.shake(ms, intensity * 0.8);
  }

  hitStop(ms: number): void {
    this.hitStopMs = Math.max(this.hitStopMs, ms);
  }

  hostiles(): Actor[] {
    const out: Actor[] = [];
    for (const e of this.enemies) if (e.alive) out.push(e);
    for (const b of this.bosses) if (b.alive) out.push(b);
    return out;
  }

  private hostileTargets(): Actor[] {
    const out = this.hostiles();
    for (const p of this.pillars) if (p.alive) out.push(p);
    return out;
  }

  addScore(n: number): void {
    this.score += Math.round(n);
  }

  playerFreezeMultiplier(p: Player = this.player): number {
    return (this.isNearHeater(p.x, p.y) ? 0.4 : 1) * this.freezeReduction;
  }

  isNearHeater(x: number, y: number): boolean {
    return this.heaters.some((h) => Math.abs(h.x - x) < 120 && Math.abs(h.y - y) < 70);
  }

  setBlizzard(on: boolean): void {
    this.blizzard = on;
  }

  get blizzardOn(): boolean {
    return this.blizzard;
  }

  spawnProjectile(o: ProjectileOpts): void {
    this.projectiles.push(new Projectile(this, o));
  }

  spawnEnemy(type: string, x?: number, y?: number): Actor | null {
    if (this.hostiles().length >= MAX_ENEMIES_ON_SCREEN) return null;
    const cfg = getEnemy(type);
    let sx = x;
    if (sx === undefined) {
      const fromLeft = Math.random() < 0.4 && Math.min(...this.players.map((q) => q.x)) - this.camLeft > 260;
      sx = fromLeft ? this.camLeft - 70 : this.camRight + 70;
    }
    let sy = y ?? Phaser.Math.Between(FLOOR_TOP + 20, FLOOR_BOTTOM - 10);
    // never on top of a hero (GDD §8.2)
    for (const p of this.players) {
      if (Math.abs(sx - p.x) < 120 && Math.abs(sy - p.y) < 60) sy = sy > p.y ? Math.min(FLOOR_BOTTOM, sy + 80) : Math.max(FLOOR_TOP, sy - 80);
    }
    // co-op: tougher crowds so two heroes still have to work for it
    const e = new Enemy(this, cfg, sx, sy, this.stage.enemyHpMul * (this.coop ? 1.4 : 1), this.stage.enemyDmgMul);
    if (x !== undefined) e.aiState = 'approach';
    this.enemies.push(e);
    this.onSpawnHook?.(e);
    return e;
  }

  onSpawnHook: ((e: Enemy) => void) | null = null;

  spawnBoss(id: Boss['cfg'], x: number, y: number): Boss {
    const b = new Boss(this, id, x, y, this.coop ? 1.6 : 1, this.stage.enemyDmgMul > 1 ? 1 + (this.stage.enemyDmgMul - 1) * 0.5 : 1);
    this.bosses.push(b);
    return b;
  }

  spawnPillar(x: number, y: number, hp: number, color: number, name: string, onBroken: (p: Pillar) => void): Pillar {
    const p = new Pillar(this, x, y, hp, color, name, onBroken);
    this.pillars.push(p);
    return p;
  }

  dropPickup(kind: PickupKind, x: number, y: number): void {
    this.pickups.push(new Pickup(this, kind, x, y));
  }

  onEnemyDefeated(e: Actor, cfg?: EnemyConfig): void {
    this.stats.kills++;
    if (cfg) {
      this.addScore(cfg.score);
      const r = Math.random();
      if (r < cfg.drops.health) this.dropPickup('health', e.x, e.y);
      else if (r < cfg.drops.health + cfg.drops.energy) this.dropPickup('energy', e.x, e.y);
      else if (r < cfg.drops.health + cfg.drops.energy + cfg.drops.token) this.dropPickup('token', e.x, e.y);
    }
    this.events?.enemyDefeated(e, cfg);
  }

  onBossDefeated(b: Boss): void {
    this.addScore(b.cfg.score);
    this.dropPickup('health', b.x - 30, b.y);
    this.dropPickup('token', b.x + 30, b.y);
    this.events?.bossDefeated(b);
  }

  onBossPhase(b: Boss, phase: BossPhase, index: number): void {
    this.events?.bossPhase(b, phase, index);
  }

  onPlayerDefeated(p: Player = this.player): void {
    this.events?.playerDefeated(p);
  }

  /** Push overlapping enemies apart so crowds stay readable. */
  private separate(): void {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.z > 40) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b.alive || b.z > 40) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < 46 && Math.abs(dy) < 18) {
          const push = (46 - Math.abs(dx)) * 0.5 * (dx >= 0 ? 1 : -1);
          a.x -= push * 0.5;
          b.x += push * 0.5;
          if (Math.abs(dy) < 8) {
            a.y -= 1;
            b.y += 1;
          }
        }
      }
    }
  }

  update(rawDt: number, input: InputState, input2?: InputState): void {
    if (this.hitStopMs > 0) {
      this.hitStopMs -= rawDt;
      // keep rigs breathing visually but freeze logic (hit pause)
      return;
    }
    const dt = Math.min(rawDt, 50) * this.timeScale;
    this.now += dt;
    this.stats.timeMs += dt;
    const p = this.player;
    const hpBefore = this.players.map((q) => q.hp);
    p.update(dt, input);
    for (let i = 1; i < this.players.length; i++) this.players[i].update(dt, input2);
    for (const e of this.enemies) e.update(dt);
    for (const b of this.bosses) b.update(dt);
    for (const pl of this.pillars) pl.update();
    this.separate();
    this.combat.update();
    for (const pr of this.projectiles) pr.update(dt, this.players);
    for (const pk of this.pickups) pk.update(dt);
    for (const n of this.npcs) n.update(dt);
    this.telegraph.update();
    this.players.forEach((q, i) => {
      if (q.hp < hpBefore[i]) this.stats.damageTaken += hpBefore[i] - q.hp;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, q.combo.hitCount);
    });
    // cleanup
    if (this.enemies.some((e) => e.deathDone || e.removed)) {
      for (const e of this.enemies) if (e.deathDone && !e.removed) e.destroy();
      this.enemies = this.enemies.filter((e) => !e.removed);
    }
    if (this.projectiles.some((x) => x.dead)) this.projectiles = this.projectiles.filter((x) => !x.dead);
    if (this.pickups.some((x) => x.dead)) this.pickups = this.pickups.filter((x) => !x.dead);
    if (this.npcs.some((x) => x.done)) this.npcs = this.npcs.filter((x) => !x.done);
    if (this.pillars.some((x) => x.removed)) this.pillars = this.pillars.filter((x) => !x.removed);
  }

  /** Cleans every entity (scene shutdown / restart). */
  destroy(): void {
    this.combat.clear();
    this.telegraph.clear();
    for (const p of this.players) p.destroy();
    this.players = [];
    for (const e of this.enemies) e.destroy();
    for (const b of this.bosses) b.destroy();
    for (const p of this.pillars) p.destroy();
    for (const p of this.projectiles) p.destroy();
    for (const p of this.pickups) p.destroy();
    for (const n of this.npcs) n.destroy();
    this.enemies = [];
    this.bosses = [];
    this.pillars = [];
    this.projectiles = [];
    this.pickups = [];
    this.npcs = [];
  }
}
