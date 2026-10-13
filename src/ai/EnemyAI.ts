import Phaser from 'phaser';
import type { Enemy } from '../entities/Enemy';
import { BLOCK, CROUCH, TELEGRAPH } from '../rig/Poses';
import type { MoveHit } from '../types/game';

/**
 * Regular enemy state machine (GDD §8.2): spawn → approach → telegraph → attack → recover → approach,
 * with hurt/down handled by the entity. Archetypes vary positioning and the attack performed.
 */
export class EnemyAI {
  private nextAttackAt = 0;
  private laneOffset = Phaser.Math.Between(-50, 50);
  private sideBias: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  private chargeDir: 1 | -1 = 1;
  private leapTarget = { x: 0, y: 0 };
  private telegraphCancel: (() => void) | null = null;
  private guardUntil = 0;
  private lastPlayerMove: unknown = null;
  private pauseUntil = 0;

  constructor(private e: Enemy) {
    this.nextAttackAt = e.w.now + Phaser.Math.Between(500, 1300);
  }

  private get p() {
    return this.e.w.targetFor(this.e);
  }

  private moveToward(tx: number, ty: number, speed: number, dt: number): boolean {
    const e = this.e;
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return true;
    const sp = speed * e.speedFactor * (dt / 1000);
    e.x += Math.sign(dx) * Math.min(Math.abs((dx / d) * sp), Math.abs(dx));
    e.y += Math.sign(dy) * Math.min(Math.abs((dy / d) * sp * 0.75), Math.abs(dy));
    return false;
  }

  private faceTarget(): void {
    const e = this.e;
    if (Math.abs(this.p.x - e.x) > 4) e.facing = this.p.x > e.x ? 1 : -1;
  }

  private setAI(s: Enemy['aiState']): void {
    this.e.aiState = s;
    this.e.aiTime = 0;
  }

  update(dt: number): void {
    const e = this.e;
    const cfg = e.cfg;
    const p = this.p;
    const v = e.view;
    if (!v) return;
    if (!p.alive && e.aiState !== 'spawn') {
      // player down: back off a little and idle
      e.releaseToken();
      v.play('idle');
      return;
    }
    switch (e.aiState) {
      case 'spawn': {
        const inside = e.x > e.w.camLeft + 60 && e.x < e.w.camRight - 60;
        const tx = Phaser.Math.Clamp(e.x, e.w.camLeft + 90, e.w.camRight - 90);
        this.moveToward(tx, e.y, cfg.moveSpeed * 1.1, dt);
        e.facing = tx > e.x ? 1 : tx < e.x ? -1 : e.facing;
        v.play('walk');
        if (inside || e.aiTime > 2500) this.setAI('approach');
        break;
      }
      case 'approach':
        this.approach(dt);
        break;
      case 'guard':
        v.hold('block', BLOCK, 60);
        if (e.w.now > this.guardUntil) {
          e.armorActive = false;
          this.setAI('approach');
        }
        break;
      case 'telegraph':
        this.telegraph(dt);
        break;
      case 'attack':
        this.attack(dt);
        break;
      case 'recover':
        if (cfg.archetype === 'flyer' && e.z < 120) e.z = Math.min(120, e.z + 260 * (dt / 1000));
        if (e.aiTime > 420) {
          e.releaseToken();
          this.nextAttackAt = e.w.now + cfg.attackCooldownMs * Phaser.Math.FloatBetween(0.75, 1.35);
          this.setAI('approach');
        }
        break;
      case 'hurt':
      case 'down':
        this.telegraphCancel?.();
        this.telegraphCancel = null;
        this.setAI('approach');
        break;
    }
    this.maybeGuard();
  }

  /** Brutes raise their guard when the player swings at them from the front (GDD §8.1). */
  private maybeGuard(): void {
    const e = this.e;
    if (e.cfg.archetype !== 'brute' || e.aiState !== 'approach') return;
    const p = this.p;
    const pm = p.currentMove;
    if (!pm || pm === this.lastPlayerMove) return;
    this.lastPlayerMove = pm;
    const front = (p.x - e.x) * e.facing > 0;
    if (front && Math.abs(p.x - e.x) < 150 && Math.abs(p.y - e.y) < 40 && Math.random() < 0.45) {
      e.armorActive = true;
      this.guardUntil = e.w.now + 900;
      this.setAI('guard');
    }
  }

  private approach(dt: number): void {
    const e = this.e;
    const cfg = e.cfg;
    const p = this.p;
    const v = e.view!;
    const now = e.w.now;
    const side: 1 | -1 = e.x >= p.x ? 1 : -1;
    const dx = Math.abs(p.x - e.x);
    const dy = Math.abs(p.y - e.y);
    const ready = now >= this.nextAttackAt;
    const canToken = ready && (e.hasToken || e.w.combat.requestToken(e.id));
    if (canToken) e.hasToken = true;
    this.faceTarget();

    if (now < this.pauseUntil) {
      v.play('idle');
      return;
    }
    const arch = cfg.archetype;
    if (arch === 'spitter' || arch === 'summoner') {
      const want = arch === 'summoner' ? 330 : 300;
      const tx = Phaser.Math.Clamp(p.x + side * want, e.w.camLeft + 50, e.w.camRight - 50);
      const ty = arch === 'spitter' ? p.y : p.y + this.laneOffset;
      const arrived = this.moveToward(tx, ty, cfg.moveSpeed, dt);
      v.play(arrived ? 'idle' : 'walk');
      this.faceTarget();
      if (e.hasToken && dy < (arch === 'spitter' ? 22 : 80) && dx > 160) this.beginTelegraph();
      return;
    }
    if (arch === 'runner' && e.hasToken && dy < 22 && dx > 150 && dx < 430) {
      this.beginTelegraph();
      return;
    }
    if (arch === 'leaper' && e.hasToken && dx > 140 && dx < 380) {
      this.beginTelegraph();
      return;
    }
    if (arch === 'flyer') {
      const tx = p.x + side * 130;
      const ty = p.y + 8;
      const arrived = this.moveToward(tx, ty, cfg.moveSpeed, dt);
      v.play(arrived ? 'idle' : 'walk');
      if (e.hasToken && arrived) this.beginTelegraph();
      return;
    }
    if (e.hasToken) {
      const tx = p.x + side * (cfg.contactRange * 0.85);
      const arrived = this.moveToward(tx, p.y, cfg.moveSpeed, dt);
      v.play(arrived ? 'idle' : 'walk');
      if (dx <= cfg.contactRange + 8 && dy <= 16) this.beginTelegraph();
    } else {
      // wait in a ring around the player, drifting naturally
      const ring = 200 + (e.id % 3) * 40;
      const s = (e.id % 2 === 0 ? side : this.sideBias) as 1 | -1;
      const tx = Phaser.Math.Clamp(p.x + s * ring, e.w.camLeft + 40, e.w.camRight - 40);
      const ty = p.y + this.laneOffset;
      const arrived = this.moveToward(tx, ty, cfg.moveSpeed * 0.7, dt);
      v.play(arrived ? 'idle' : 'walk');
      if (arrived && Math.random() < 0.004) {
        this.pauseUntil = now + Phaser.Math.Between(300, 800);
        this.laneOffset = Phaser.Math.Between(-60, 60);
      }
    }
  }

  private beginTelegraph(): void {
    const e = this.e;
    const cfg = e.cfg;
    const v = e.view!;
    this.setAI('telegraph');
    this.faceTarget();
    const arch = cfg.archetype;
    const t = cfg.telegraphMs;
    e.w.fx.text(e.x, e.y - e.height - 20, '!', '#ff5050', 30);
    switch (arch) {
      case 'runner':
        this.chargeDir = e.facing;
        v.hold('telegraph', TELEGRAPH, 120);
        this.telegraphCancel = e.w.telegraph.add({ kind: 'rect', x: e.facing === 1 ? e.x : e.x - 420, y: e.y - 18, w: 420, h: 36 }, t, 0xff7a3d).cancel;
        break;
      case 'leaper':
        this.leapTarget = { x: this.p.x, y: this.p.y };
        v.hold('crouch', CROUCH, 120);
        this.telegraphCancel = e.w.telegraph.add({ kind: 'circle', x: this.p.x, y: this.p.y, r: 70 }, t + 820, 0xff3b3b).cancel;
        break;
      case 'spitter':
        v.playAttack('spit', t, 120, 400);
        break;
      case 'summoner':
        v.hold('telegraph', TELEGRAPH, 120);
        e.w.fx.ring(e.x, e.y, 80, cfg.palette.accent, t);
        break;
      case 'flyer':
        (v as unknown as { setWobble(n: number): void }).setWobble(2);
        break;
      case 'brute':
        v.playAttack('slam', t, 140, 520);
        break;
      default:
        v.playAttack(Math.random() < 0.5 ? 'punchA' : 'hook', t, 120, 380);
    }
  }

  private telegraph(_dt: number): void {
    const e = this.e;
    const cfg = e.cfg;
    if (cfg.archetype === 'leaper' || cfg.archetype === 'runner' || cfg.archetype === 'summoner') {
      // keep facing locked during windup
    } else this.faceTarget();
    if (e.aiTime >= cfg.telegraphMs) {
      this.telegraphCancel = null;
      (e.view as unknown as { setWobble(n: number): void }).setWobble(0);
      this.startAttack();
    }
  }

  private melee(hit: Partial<MoveHit> & { range: number }): void {
    const e = this.e;
    e.w.combat.startAttack({
      owner: e,
      color: e.cfg.palette.accent,
      hits: [{ at: 0, activeMs: 120, damage: e.damage, knockback: 120, depth: 26, shape: 'front', ...hit }],
    });
  }

  private startAttack(): void {
    const e = this.e;
    const cfg = e.cfg;
    const v = e.view!;
    this.setAI('attack');
    switch (cfg.archetype) {
      case 'runner':
        e.facing = this.chargeDir;
        v.hold('charge', CROUCH, 60);
        this.melee({ activeMs: 560, range: 40, knockback: 220, launch: true });
        e.w.audio.play('whoosh');
        break;
      case 'leaper': {
        const T = 0.8;
        e.vz = (2200 * T) / 2;
        e.z = 1;
        e.vx = (this.leapTarget.x - e.x) / T;
        e.vy = (this.leapTarget.y - e.y) / T;
        e.facing = e.vx >= 0 ? 1 : -1;
        v.hold('crouch', TELEGRAPH, 60);
        e.w.audio.play('jump');
        break;
      }
      case 'spitter': {
        const pr = cfg.projectile!;
        e.w.spawnProjectile({
          owner: e,
          x: e.x + e.facing * 40,
          y: e.y,
          z: 90,
          vx: e.facing * pr.speed,
          damage: pr.damage * e.dmgMul,
          color: pr.color,
          kind: pr.kind,
          slowMs: pr.kind === 'spit' ? 1200 : 0,
          pierce: pr.kind === 'sonic',
        });
        e.w.audio.play('spit');
        break;
      }
      case 'summoner':
        for (let i = 0; i < 2; i++) e.w.spawnEnemy('minion', e.x + (i ? 50 : -50), e.y + (i ? 20 : -20));
        e.w.audio.play('roar');
        break;
      case 'flyer':
        this.melee({ at: 160, activeMs: 240, range: 52, knockback: 140, depth: 30 });
        e.w.audio.play('whoosh');
        break;
      case 'brute':
        this.melee({ range: 84 * cfg.scale, knockback: 260, launch: true, depth: 32 });
        e.w.shake(0.003, 100);
        break;
      default:
        this.melee({ range: cfg.contactRange + 8 });
    }
  }

  private attack(dt: number): void {
    const e = this.e;
    const cfg = e.cfg;
    switch (cfg.archetype) {
      case 'runner':
        e.x += e.facing * 470 * (dt / 1000);
        if (e.aiTime % 120 < dt) e.w.fx.dust(e.x - e.facing * 20, e.y, 1);
        if (e.aiTime > 560 || e.x < e.w.camLeft + 30 || e.x > e.w.camRight - 30) {
          e.w.combat.cancelAttacksOf(e);
          e.view!.play('idle', true);
          this.setAI('recover');
        }
        return;
      case 'leaper':
        if (e.z <= 0 && e.aiTime > 200) {
          e.vx = 0;
          e.vy = 0;
          e.w.combat.startAttack({
            owner: e,
            origin: { x: e.x, y: e.y },
            color: cfg.palette.accent,
            hits: [{ at: 0, activeMs: 100, damage: e.damage, knockback: 200, range: 70, depth: 40, shape: 'around', launch: true }],
          });
          e.w.fx.ring(e.x, e.y, 80, cfg.palette.accent, 260);
          e.w.fx.dust(e.x, e.y, 4);
          e.w.audio.play('land');
          e.view!.play('idle', true);
          this.setAI('recover');
        }
        return;
      case 'flyer': {
        // swoop: dive down through the player then climb back
        const k = e.aiTime / 520;
        e.z = 120 - Math.sin(Math.min(1, k) * Math.PI) * 100;
        e.x += e.facing * 260 * (dt / 1000);
        if (k >= 1) this.setAI('recover');
        return;
      }
      default:
        if (e.aiTime > 160 + (cfg.archetype === 'brute' ? 520 : 380)) {
          e.view!.play('idle', true);
          this.setAI('recover');
          e.aiTime = 400; // recover immediately after the animation
        }
    }
  }
}
