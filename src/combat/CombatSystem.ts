import type { Actor } from '../entities/Actor';
import { MAX_SIMULTANEOUS_ATTACKERS } from '../game/constants';
import type { MoveHit } from '../types/game';
import type { HitEvent, HitResult } from '../types/world';
import { comboMultiplier, targetFalloff } from './DamageSystem';
import { hitAreaOverlaps, HitRegistry } from './Hitbox';

export interface AttackSpec {
  owner: Actor;
  hits: MoveHit[];
  attackMultiplier?: number;
  damageMultiplier?: number;
  comboCount?: () => number;
  falloff?: number;
  color?: number;
  /** fixed world origin (AoE at a point) instead of following the owner */
  origin?: { x: number; y: number; z?: number };
  /** forward offset of the hit origin from the owner position */
  offsetX?: number;
  freezeMs?: number;
  heavy?: boolean;
  onHit?: (target: Actor, result: HitResult, hit: MoveHit, hitIndex: number) => void;
}

interface ActiveAttack extends AttackSpec {
  start: number;
  registry: HitRegistry;
  end: number;
  dead: boolean;
}

/**
 * Resolves attack hitboxes against hurtboxes. Hitboxes only exist during their active window
 * and each (hit, target) pair lands at most once (GDD §7.3).
 */
export class CombatSystem {
  private attacks: ActiveAttack[] = [];
  private tokens = new Set<number>();
  /** simultaneous attackers allowed (raised in co-op: two heroes to share them) */
  maxTokens = MAX_SIMULTANEOUS_ATTACKERS;

  constructor(
    private now: () => number,
    private targetsFor: (team: Actor['team']) => Actor[],
  ) {}

  startAttack(spec: AttackSpec): ActiveAttack {
    const end = spec.hits.reduce((m, h) => Math.max(m, h.at + h.activeMs), 0);
    const a: ActiveAttack = { ...spec, start: this.now(), registry: new HitRegistry(), end, dead: false };
    this.attacks.push(a);
    return a;
  }

  cancelAttacksOf(owner: Actor): void {
    for (const a of this.attacks) if (a.owner === owner) a.dead = true;
  }

  hasActive(owner: Actor): boolean {
    return this.attacks.some((a) => a.owner === owner && !a.dead);
  }

  update(): void {
    const now = this.now();
    for (const a of this.attacks) {
      if (a.dead) continue;
      if (!a.owner.alive && a.owner.team !== 'object') {
        a.dead = true;
        continue;
      }
      const t = now - a.start;
      if (t > a.end) {
        a.dead = true;
        continue;
      }
      a.hits.forEach((h, i) => {
        if (t < h.at || t > h.at + h.activeMs) return;
        this.resolveHit(a, h, i);
      });
    }
    if (this.attacks.some((a) => a.dead)) this.attacks = this.attacks.filter((a) => !a.dead);
  }

  private resolveHit(a: ActiveAttack, h: MoveHit, index: number): void {
    const o = a.owner;
    const ox = a.origin ? a.origin.x : o.x + (a.offsetX ?? 0) * o.facing;
    const oy = a.origin ? a.origin.y : o.y;
    const oz = a.origin ? a.origin.z ?? 0 : o.z;
    const area = { originX: ox, originY: oy, originZ: oz, facing: o.facing, range: h.range, depth: h.depth, shape: h.shape };
    for (const target of this.targetsFor(o.team)) {
      if (target === o || !target.alive) continue;
      if (!hitAreaOverlaps(area, target.plane)) continue;
      if (target.isInvulnerable) {
        // still let the target know it was "attacked" (Shu Shu counter) without consuming the hit
        (target as Actor & { onAttackedWhileInvulnerable?: () => void }).onAttackedWhileInvulnerable?.();
        continue;
      }
      if (!a.registry.tryRegister(index, target.id)) continue;
      const targetIndex = a.registry.countFor(index) - 1;
      const combo = a.comboCount ? a.comboCount() : 0;
      const raw =
        h.damage * (a.attackMultiplier ?? 1) * comboMultiplier(combo) * targetFalloff(targetIndex, a.falloff) * (a.damageMultiplier ?? 1);
      const dirX: 1 | -1 = h.shape === 'around' ? (target.x >= ox ? 1 : -1) : o.facing;
      const ev: HitEvent = {
        attackerId: o.id,
        attackerX: ox,
        dirX,
        damage: raw,
        knockback: h.knockback,
        launch: !!h.launch,
        stunMs: h.stun ?? 0,
        slowMs: h.slow ?? 0,
        grab: !!h.grab,
        breaksArmor: !!h.breaksArmor,
        heavy: !!a.heavy || h.knockback >= 200 || !!h.launch,
        color: a.color ?? 0xffffff,
        freezeMs: a.freezeMs,
      };
      const res = target.receiveHit(ev);
      if (res.landed) a.onHit?.(target, res, h, index);
    }
  }

  /** Limits how many enemies may attack the player at once (anti stun-lock, GDD §8.2). */
  requestToken(enemyId: number): boolean {
    if (this.tokens.has(enemyId)) return true;
    if (this.tokens.size >= this.maxTokens) return false;
    this.tokens.add(enemyId);
    return true;
  }

  releaseToken(enemyId: number): void {
    this.tokens.delete(enemyId);
  }

  clear(): void {
    this.attacks = [];
    this.tokens.clear();
  }
}
