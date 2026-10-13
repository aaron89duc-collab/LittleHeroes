import { HEADS } from '../art/registry';
import { BossAI } from '../ai/BossAI';
import { CreatureView } from '../rig/CreatureView';
import { Rig } from '../rig/Rig';
import { SpriteView, spriteReady } from '../rig/SpriteView';
import type { BossConfig, BossPhase } from '../types/game';
import type { HitEvent, HitResult } from '../types/world';
import { Actor } from './Actor';
import type { GameWorldApi } from './WorldApi';

export interface BossWorldApi extends GameWorldApi {
  onBossDefeated(b: Boss): void;
  onBossPhase(b: Boss, phase: BossPhase, index: number): void;
  isNearHeater(x: number, y: number): boolean;
  setBlizzard(on: boolean): void;
}

function makeBossView(w: GameWorldApi, cfg: BossConfig, rigOverride?: string): Rig | CreatureView | SpriteView {
  if (cfg.sprite && spriteReady(w.scene, cfg.sprite.key)) return new SpriteView(w.scene, cfg.sprite.key, cfg.sprite.scale, cfg.sprite.tint);
  if (cfg.body === 'spider' || cfg.body === 'crab' || cfg.body === 'bat') {
    return new CreatureView(w.scene, cfg.body, cfg.scale * (cfg.body === 'bat' ? 1 : 1.1), cfg.palette);
  }
  const head = HEADS[cfg.head] ?? HEADS['head-boss'];
  return new Rig(w.scene, {
    partKey: rigOverride ?? `rig-${cfg.id}`,
    headKey: head.key,
    headHeight: head.height * (cfg.id === 'darkShadow' ? 1 : 1.05),
    headAnchorY: head.anchorY,
    scale: cfg.scale,
    bulk: 1,
    headDeco: cfg.body === 'bear' ? 'bearEars' : cfg.id === 'iceKing' ? 'crown' : cfg.id === 'darkShadow' ? 'horns' : undefined,
    tint: cfg.id === 'iceKing' ? 0xd8f4ff : undefined,
  });
}

export class Boss extends Actor {
  readonly team = 'enemy' as const;
  readonly ai: BossAI;
  phaseIndex = 0;
  shieldMul = 1;
  curlArmor = false;
  enraged = false;
  speedMul = 1;
  damageMul = 1;
  lastHitAt = 0;
  private staggerWindowStart = 0;
  private staggerCount = 0;
  transformed = false;
  hovering = false;

  constructor(readonly w: BossWorldApi, readonly cfg: BossConfig, x: number, y: number, hpMul = 1, dmgMul = 1) {
    super(w, makeBossView(w, cfg), x, y, cfg.scale * 1.1);
    this.isBoss = true;
    this.grabbable = false;
    this.maxHp = Math.round(cfg.maxHp * hpMul);
    this.hp = this.maxHp;
    this.damageMul = dmgMul;
    this.damageReceivedMultiplier = cfg.damageReceivedMultiplier;
    this.mass = 4;
    this.height = 140 * cfg.scale;
    this.halfWidth = 26 * cfg.scale;
    this.halfDepth = 18;
    this.facing = -1;
    this.ai = new BossAI(this);
    if (cfg.body === 'bat') {
      this.hovering = true;
      this.gravityScale = 0;
      this.z = 180;
      this.height = 110;
    }
  }

  get phase(): BossPhase {
    return this.cfg.phases[this.phaseIndex];
  }

  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  get effectiveSpeed(): number {
    return this.cfg.moveSpeed * this.phase.speedMul * this.speedMul * this.speedFactor;
  }

  dmg(base: number): number {
    return base * this.phase.damageMul * this.damageMul;
  }

  /** Twin guardian rule: the survivor gets stronger (GDD §9 Màn 9). */
  enrage(): void {
    if (this.enraged || !this.alive) return;
    this.enraged = true;
    this.speedMul *= 1.25;
    this.damageMul *= 1.25;
    this.view?.setTintAll(0xffb0b0);
    this.w.fx.text(this.x, this.y - this.height - 30, 'NỔI GIẬN!', '#ff4d4d', 34);
    this.w.audio.play('roar');
  }

  /** Swap to the giant monster form (Hắc Ảnh phase 2). */
  transform(): void {
    if (this.transformed) return;
    this.transformed = true;
    const old = this.view;
    const ts = this.cfg.transformSprite;
    const rig = ts && spriteReady(this.w.scene, ts.key)
      ? new SpriteView(this.w.scene, ts.key, ts.scale, ts.tint)
      : new Rig(this.w.scene, {
      partKey: 'rig-darkBeast',
      headKey: 'head-shadow',
      headHeight: 72,
      headAnchorY: 0.96,
      scale: this.cfg.scale * 1.4,
      headDeco: 'horns',
    });
    this.view = rig;
    old?.destroy();
    this.height *= 1.35;
    this.halfWidth *= 1.3;
    this.shadowScale = 1.4;
    this.w.fx.ring(this.x, this.y, 220, 0xb44dff, 600);
    this.w.shake(0.01, 500);
  }

  protected incomingMultiplier(): number {
    return this.shieldMul * (this.curlArmor ? 0.2 : 1);
  }

  protected canBeLaunched(): boolean {
    return false;
  }

  protected canFlinch(_e: HitEvent): boolean {
    if (!this.ai.canFlinch) return false;
    const now = this.now;
    if (now - this.staggerWindowStart > 4000) {
      this.staggerWindowStart = now;
      this.staggerCount = 0;
    }
    if (this.staggerCount >= this.cfg.maxStaggerPerWindow) return false;
    this.staggerCount++;
    return true;
  }

  receiveHit(e: HitEvent): HitResult {
    if (this.curlArmor && e.breaksArmor) {
      this.curlArmor = false;
      this.w.fx.text(this.x, this.y - this.height, 'PHÁ GIÁP!', '#ffd23f', 30);
      this.w.audio.play('break');
    }
    const r = super.receiveHit(e);
    if (r.landed) {
      this.lastHitAt = this.now;
      this.w.audio.play(r.blocked || this.shieldMul < 1 ? 'guard' : 'enemyHurt');
      if (this.state === 'hurt') {
        this.hitstunUntil = this.now + 220;
        this.ai.onFlinch();
      }
      if (this.alive) this.checkPhase();
    }
    return r;
  }

  private checkPhase(): void {
    const next = this.phaseIndex + 1;
    if (next < this.cfg.phases.length && this.hpRatio <= this.cfg.phases[next].hpBelow) {
      this.phaseIndex = next;
      this.w.combat.cancelAttacksOf(this);
      this.invulnUntil = this.now + 1300;
      this.ai.onPhaseChange();
      this.w.onBossPhase(this, this.phase, next);
      if (this.cfg.id === 'darkShadow' && next === 1) this.transform();
    }
  }

  protected onDefeated(): void {
    this.w.combat.cancelAttacksOf(this);
    this.ai.stop();
    this.curlArmor = false;
    this.gravityScale = 1;
    this.w.audio.play('explosion');
    this.w.onBossDefeated(this);
  }

  protected launch(e: HitEvent, kb: number): void {
    // bosses only get launched by the final blow
    super.launch(e, kb * 0.5);
  }

  protected downDuration(): number {
    return 99999;
  }

  update(dt: number): void {
    this.stateTime += dt;
    this.view?.update(dt);
    if (this.updateKnockdown(dt)) {
      this.physics(dt);
      this.syncView();
      return;
    }
    if (this.state === 'hurt' && this.now >= this.hitstunUntil) {
      this.setState('idle');
      this.view?.play('idle', true);
    }
    if (this.isFrozen) {
      this.physics(dt);
      this.syncView();
      return;
    }
    if (this.state !== 'hurt') this.ai.update(dt);
    this.physics(dt);
    this.syncView();
  }

  destroy(): void {
    this.ai.stop();
    super.destroy();
  }
}
