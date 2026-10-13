import Phaser from 'phaser';
import { ENEMY_RIG, HEADS } from '../art/registry';
import { EnemyAI } from '../ai/EnemyAI';
import { CreatureView } from '../rig/CreatureView';
import { Rig } from '../rig/Rig';
import { SpriteView, spriteReady } from '../rig/SpriteView';
import type { EnemyConfig } from '../types/game';
import type { HitEvent, HitResult } from '../types/world';
import { Actor } from './Actor';
import type { GameWorldApi } from './WorldApi';

export type EnemyAIState = 'spawn' | 'approach' | 'telegraph' | 'attack' | 'recover' | 'guard' | 'hurt' | 'down';

export class Enemy extends Actor {
  readonly team = 'enemy' as const;
  readonly cfg: EnemyConfig;
  readonly ai: EnemyAI;
  aiState: EnemyAIState = 'spawn';
  aiTime = 0;
  dmgMul: number;
  hasToken = false;

  constructor(readonly w: GameWorldApi, cfg: EnemyConfig, x: number, y: number, hpMul: number, dmgMul: number) {
    let view: Rig | CreatureView | SpriteView;
    if (cfg.sprite && spriteReady(w.scene, cfg.sprite.key)) {
      view = new SpriteView(w.scene, cfg.sprite.key, cfg.sprite.scale, cfg.sprite.tint);
    } else if (cfg.archetype === 'flyer') {
      view = new CreatureView(w.scene, 'drone', cfg.scale, cfg.palette);
    } else {
      const head = HEADS[cfg.head] ?? HEADS['head-thug'];
      view = new Rig(w.scene, {
        partKey: ENEMY_RIG[cfg.id] ?? 'rig-thug',
        headKey: head.key,
        headHeight: head.height,
        headAnchorY: head.anchorY,
        scale: 1.12 * cfg.scale,
        bulk: cfg.archetype === 'brute' ? 1.15 : 1,
        tint: cfg.id === 'clone' ? 0xd8c8ff : cfg.id === 'elite' ? 0xe0b8ff : cfg.id === 'minion' ? 0xe8c8ff : undefined,
      });
    }
    super(w, view, x, y, cfg.scale);
    this.cfg = cfg;
    this.maxHp = Math.round(cfg.maxHp * hpMul);
    this.hp = this.maxHp;
    this.dmgMul = dmgMul;
    this.damageReceivedMultiplier = cfg.damageReceivedMultiplier;
    this.height = 140 * cfg.scale;
    this.halfWidth = 20 * cfg.scale;
    this.mass = cfg.archetype === 'brute' ? 1.6 : 1;
    this.facing = x < w.player.x ? 1 : -1;
    if (cfg.id === 'clone') view.setAlpha(0.85);
    this.ai = new EnemyAI(this);
    if (cfg.archetype === 'flyer') {
      this.z = 120;
      this.gravityScale = 0;
    }
  }

  get damage(): number {
    return this.cfg.damage * this.dmgMul;
  }

  receiveHit(e: HitEvent): HitResult {
    const prevState = this.aiState;
    const r = super.receiveHit(e);
    if (r.landed) {
      this.w.audio.play('enemyHurt');
      if (!r.blocked && (this.state === 'hurt' || this.state === 'knockdown')) {
        // interrupt telegraphs/attacks (GDD §8.1 Runner: "dễ bị ngắt nếu trúng đòn đúng lúc")
        this.w.combat.cancelAttacksOf(this);
        this.aiState = this.state === 'knockdown' ? 'down' : 'hurt';
        this.aiTime = 0;
        if (this.cfg.archetype === 'flyer' && this.state === 'knockdown') this.gravityScale = 1;
        if (prevState === 'telegraph' || prevState === 'attack') this.releaseToken();
      }
      if (e.grab && this.alive && this.state === 'knockdown') this.vz = 760;
    }
    return r;
  }

  protected canBeLaunched(): boolean {
    return true;
  }

  releaseToken(): void {
    if (this.hasToken) {
      this.w.combat.releaseToken(this.id);
      this.hasToken = false;
    }
  }

  protected onDefeated(): void {
    this.releaseToken();
    this.w.combat.cancelAttacksOf(this);
    this.w.onEnemyDefeated(this, this.cfg);
    if (this.cfg.archetype === 'flyer') this.gravityScale = 1;
  }

  protected onGotUp(): void {
    this.aiState = 'approach';
    this.aiTime = 0;
    if (this.cfg.archetype === 'flyer') {
      this.gravityScale = 0;
      this.vz = 260;
    }
  }

  update(dt: number): void {
    this.stateTime += dt;
    this.aiTime += dt;
    const v = this.view;
    v?.update(dt);
    if (this.updateKnockdown(dt)) {
      if (!this.alive && v) v.setAlpha(Math.max(0, 1 - this.deathTimer / 700) * (Math.floor(this.deathTimer / 70) % 2 ? 0.4 : 1));
      this.physics(dt);
      this.syncView();
      return;
    }
    if (this.isFrozen) {
      this.physics(dt);
      this.syncView();
      return;
    }
    if (this.state === 'hurt') {
      if (this.now >= this.hitstunUntil) {
        this.setState('idle');
        this.aiState = 'approach';
        this.aiTime = 0;
        v?.play('idle', true);
      }
      this.physics(dt);
      this.syncView();
      return;
    }
    this.ai.update(dt);
    this.physics(dt);
    // flyers hover
    if (this.cfg.archetype === 'flyer' && this.gravityScale === 0 && this.alive) {
      this.z = Phaser.Math.Clamp(this.z, 0, 220);
    }
    this.syncView();
  }

  destroy(): void {
    this.releaseToken();
    super.destroy();
  }
}
