import Phaser from 'phaser';
import type { Boss } from '../entities/Boss';
import { BLOCK, CROUCH, TELEGRAPH, VICTORY } from '../rig/Poses';
import type { BossMove, MoveHit } from '../types/game';

type AIState = 'intro' | 'idle' | 'position' | 'execute' | 'recover' | 'phase' | 'stopped';

interface Step {
  at: number;
  fn: () => void;
  done?: boolean;
}

interface Run {
  move: BossMove;
  steps: Step[];
  end: number;
  tick?: (dt: number, t: number) => void;
}

/**
 * Boss behaviour: weighted move selection per phase, positioning, telegraphed execution and a
 * recovery window that is the player's chance to counter (GDD §8.3). Super armor while telegraphing/executing.
 */
export class BossAI {
  state: AIState = 'intro';
  private t = 0;
  private run: Run | null = null;
  private lastKind: string | null = null;
  private idleWait = 900;
  private positionTimeout = 0;
  private recoverMs = 800;
  private cancels: Array<() => void> = [];

  constructor(private b: Boss) {}

  private get w() {
    return this.b.w;
  }

  private get p() {
    return this.b.w.targetFor(this.b);
  }

  get canFlinch(): boolean {
    return this.state === 'idle' || this.state === 'position' || this.state === 'recover';
  }

  stop(): void {
    this.state = 'stopped';
    this.clearTelegraphs();
    this.b.curlArmor = false;
  }

  onFlinch(): void {
    if (this.state === 'position') this.state = 'idle';
  }

  onPhaseChange(): void {
    this.clearTelegraphs();
    this.run = null;
    this.state = 'phase';
    this.t = 0;
    this.b.curlArmor = false;
    this.b.view?.hold('roar', VICTORY, 200);
    this.w.audio.play('roar');
    this.w.shake(0.008, 500);
  }

  private clearTelegraphs(): void {
    for (const c of this.cancels) c();
    this.cancels = [];
  }

  private set(s: AIState): void {
    this.state = s;
    this.t = 0;
  }

  private face(): void {
    const b = this.b;
    if (Math.abs(this.p.x - b.x) > 6) b.facing = this.p.x > b.x ? 1 : -1;
  }

  private walkTo(tx: number, ty: number, dt: number, speedMul = 1): boolean {
    const b = this.b;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) return true;
    const sp = b.effectiveSpeed * speedMul * (dt / 1000);
    b.x += Math.sign(dx) * Math.min(Math.abs((dx / d) * sp), Math.abs(dx));
    b.y += Math.sign(dy) * Math.min(Math.abs((dy / d) * sp * 0.8), Math.abs(dy));
    return false;
  }

  update(dt: number): void {
    const b = this.b;
    const v = b.view;
    if (!v || this.state === 'stopped') return;
    this.t += dt;
    if (!this.p.alive && this.state !== 'intro') {
      v.play('idle');
      return;
    }
    switch (this.state) {
      case 'intro': {
        const tx = this.w.camRight - 260;
        const arrived = this.walkTo(tx, (this.p.y + b.y) / 2, dt, 0.9);
        b.facing = -1;
        v.play(arrived ? 'idle' : 'walk');
        if (arrived || this.t > 3500) this.set('idle');
        break;
      }
      case 'phase':
        if (this.t > 1300) {
          v.play('idle', true);
          this.set('idle');
          this.idleWait = 300;
        }
        break;
      case 'idle':
        this.face();
        v.play('idle');
        this.hover(dt);
        if (this.t > this.idleWait) this.chooseMove();
        break;
      case 'position':
        this.position(dt);
        break;
      case 'execute':
        this.execute(dt);
        break;
      case 'recover':
        if (b.cfg.body === 'bat' && this.t > this.recoverMs * 0.6) this.hover(dt, true);
        if (this.t > this.recoverMs) {
          this.set('idle');
          this.idleWait = Phaser.Math.Between(250, 650);
          v.play('idle', true);
          b.view?.setWobble(0);
        }
        break;
    }
  }

  /** Bat boss hovers at height; others drift towards a comfortable distance. */
  private hover(dt: number, climb = false): void {
    const b = this.b;
    if (b.cfg.body === 'bat') {
      b.gravityScale = 0;
      b.vz = 0;
      if (b.z < 180) b.z = Math.min(180, b.z + (climb ? 260 : 140) * (dt / 1000));
      const tx = this.p.x + (b.x > this.p.x ? 220 : -220);
      this.walkTo(tx, this.p.y - 10, dt, 0.6);
      return;
    }
    const dx = Math.abs(this.p.x - b.x);
    if (dx < 100) this.walkTo(b.x + (b.x > this.p.x ? 60 : -60), b.y, dt, 0.5);
  }

  private chooseMove(): void {
    const moves = this.b.phase.moves;
    const dist = Math.abs(this.p.x - this.b.x);
    const pool = moves.map((m) => {
      let w = m.weight;
      if (m.kind === this.lastKind && moves.length > 1) w *= 0.35;
      const ranged = ['charge', 'projectile', 'leap', 'teleport', 'wave', 'dive', 'iceWall'].includes(m.kind);
      if (dist > 420 && ranged) w *= 2;
      if (dist < 160 && (m.kind === 'combo' || m.kind === 'slam')) w *= 1.6;
      if ((m.kind === 'summon' || m.kind === 'clones') && this.w.hostiles().length > 5) w = 0;
      return w;
    });
    const total = pool.reduce((a, c) => a + c, 0);
    let r = Math.random() * total;
    let move = moves[0];
    for (let i = 0; i < moves.length; i++) {
      r -= pool[i];
      if (r <= 0) {
        move = moves[i];
        break;
      }
    }
    this.lastKind = move.kind;
    this.positionTimeout = 2600;
    this.set('position');
    this.pending = move;
  }

  private pending: BossMove | null = null;

  private position(dt: number): void {
    const b = this.b;
    const m = this.pending!;
    const v = b.view!;
    this.face();
    let ready = true;
    if (m.kind === 'combo') {
      const range = 60 + 34 * b.cfg.scale;
      const tx = this.p.x + (b.x > this.p.x ? range : -range);
      ready = this.walkTo(tx, this.p.y, dt) || (Math.abs(this.p.x - b.x) <= range + 10 && Math.abs(this.p.y - b.y) < 14);
    } else if (m.kind === 'slam' || m.kind === 'freezeZone') {
      const tx = this.p.x + (b.x > this.p.x ? 90 : -90);
      ready = m.kind === 'freezeZone' ? true : this.walkTo(tx, this.p.y, dt) || Math.abs(this.p.x - b.x) < (m.range ?? 140) * 0.8;
    } else if (m.kind === 'charge' || m.kind === 'wave' || m.kind === 'iceWall' || m.kind === 'projectile') {
      // get some distance first
      const dx = Math.abs(this.p.x - b.x);
      if (dx < 260) {
        const tx = Phaser.Math.Clamp(b.x + (b.x > this.p.x ? 200 : -200), this.w.camLeft + 80, this.w.camRight - 80);
        ready = this.walkTo(tx, b.y, dt) || this.t > 900;
      }
    }
    v.play(ready ? 'idle' : 'walk');
    if (ready || this.t > this.positionTimeout) this.begin(m);
  }

  private melee(hit: Partial<MoveHit> & { range: number }, origin?: { x: number; y: number }, freezeMs?: number): void {
    const b = this.b;
    this.w.combat.startAttack({
      owner: b,
      origin,
      color: b.cfg.palette.accent,
      heavy: true,
      freezeMs,
      hits: [{ at: 0, activeMs: 130, damage: 10, knockback: 160, depth: 30, shape: 'front', ...hit }],
    });
  }

  private tele(shape: Parameters<Boss['w']['telegraph']['add']>[0], ms: number, color = 0xff3b3b, follow?: () => { x: number; y: number }): void {
    const h = this.w.telegraph.add(shape, ms, color, follow);
    this.cancels.push(h.cancel);
  }

  private begin(m: BossMove): void {
    const b = this.b;
    const v = b.view!;
    const steps: Step[] = [];
    let end = m.telegraphMs + 200;
    let tick: Run['tick'];
    const T = m.telegraphMs;
    const sc = b.cfg.scale;
    const dmg = b.dmg(m.damage);
    const color = m.color ?? 0xff3b3b;
    this.face();
    switch (m.kind) {
      case 'combo': {
        const n = m.count ?? 1;
        let at = 0;
        for (let i = 0; i < n; i++) {
          const tt = i === 0 ? T : Math.max(240, T * 0.55);
          const anim = i % 2 === 0 ? 'punchA' : 'hook';
          steps.push({ at, fn: () => { this.face(); v.playAttack(anim, tt, 140, 180); if (i === 0) this.w.fx.text(b.x, b.y - b.height - 20, '!', '#ff5050', 34); } });
          steps.push({ at: at + tt, fn: () => this.melee({ range: 70 + 30 * sc, damage: dmg, knockback: i === n - 1 ? 240 : 90, launch: i === n - 1, depth: 34 }) });
          at += tt + 180;
        }
        end = at;
        tick = (d, t) => {
          if (t < at - 100) b.x += b.facing * 40 * (d / 1000);
        };
        break;
      }
      case 'charge': {
        const dir: 1 | -1 = this.p.x > b.x ? 1 : -1;
        b.facing = dir;
        v.hold('telegraph', TELEGRAPH, 150);
        const len = 760;
        steps.push({ at: 0, fn: () => this.tele({ kind: 'rect', x: dir === 1 ? b.x : b.x - len, y: b.y - 26, w: len, h: 52 }, T, 0xff7a3d) });
        let traveled = 0;
        steps.push({
          at: T,
          fn: () => {
            v.hold('charge', CROUCH, 60);
            this.w.audio.play('whoosh');
            this.w.combat.startAttack({ owner: b, color, heavy: true, hits: [{ at: 0, activeMs: 900, damage: dmg, knockback: 300, range: 50 + 20 * sc, depth: 34, shape: 'front', launch: true }] });
          },
        });
        tick = (d, t) => {
          if (t < T * 0.6) {
            // align lane during the wind-up
            b.y += Phaser.Math.Clamp(this.p.y - b.y, -1, 1) * 90 * (d / 1000);
          } else if (t >= T && traveled < len) {
            const step = 680 * b.phase.speedMul * b.speedMul * (d / 1000);
            b.x += dir * step;
            traveled += step;
            if (Math.floor(t / 90) !== Math.floor((t - d) / 90)) this.w.fx.dust(b.x - dir * 30, b.y, 2);
            if (b.x <= this.w.camLeft + b.halfWidth + 4 || b.x >= this.w.camRight - b.halfWidth - 4) {
              traveled = len;
              this.w.shake(0.006, 200);
            }
          }
        };
        end = T + 1200;
        steps.push({ at: T + 1150, fn: () => this.w.combat.cancelAttacksOf(b) });
        break;
      }
      case 'slam': {
        const r = (m.range ?? 150) * (b.transformed ? 1.2 : 1);
        const cone = b.cfg.id === 'streetBoss';
        steps.push({
          at: 0,
          fn: () => {
            v.playAttack('slam', T, 160, 300);
            if (cone) this.tele({ kind: 'cone', x: b.x, y: b.y, facing: b.facing, len: r * 1.5, spread: 0.6 }, T, color);
            else this.tele({ kind: 'circle', x: b.x, y: b.y, r }, T, color);
          },
        });
        steps.push({
          at: T,
          fn: () => {
            if (cone) this.melee({ range: r * 1.5, damage: dmg, knockback: 260, launch: true, depth: r * 0.6 });
            else this.melee({ range: r, damage: dmg, knockback: 260, launch: true, shape: 'around', depth: r * 0.45 }, { x: b.x, y: b.y });
            this.w.fx.ring(b.x, b.y, r, color, 360);
            this.w.fx.dust(b.x, b.y, 8);
            this.w.shake(0.012, 260);
            this.w.audio.play('explosion');
          },
        });
        end = T + 300;
        break;
      }
      case 'projectile': {
        const n = m.count ?? 1;
        for (let i = 0; i < n; i++) {
          const at = i * 320;
          steps.push({ at, fn: () => { this.face(); v.playAttack('spit', i === 0 ? T : 220, 120, 160); } });
          steps.push({
            at: at + (i === 0 ? T : 220),
            fn: () => {
              const kind = b.cfg.body === 'spider' ? 'web' : b.cfg.body === 'bat' ? 'sonic' : 'energy';
              const sx = b.x + b.facing * 50 * sc;
              const tt = Math.max(0.4, Math.abs(this.p.x - sx) / 420);
              this.w.spawnProjectile({
                owner: b,
                x: sx,
                y: b.y,
                z: Math.max(60, b.z * 0.5 + 60),
                vx: b.facing * 420,
                vy: Phaser.Math.Clamp((this.p.y - b.y) / tt, -160, 160),
                damage: dmg,
                color: m.color ?? 0xffffff,
                kind,
                slowMs: kind === 'web' ? 2000 : 0,
                pierce: kind === 'sonic',
                radius: kind === 'sonic' ? 40 : 26,
              });
              this.w.audio.play('spit');
            },
          });
        }
        end = (n - 1) * 320 + T + 260;
        break;
      }
      case 'summon':
      case 'clones': {
        steps.push({ at: 0, fn: () => { v.hold('roar', VICTORY, 150); this.w.fx.ring(b.x, b.y, 140, color, T); this.w.audio.play('roar'); } });
        steps.push({
          at: T,
          fn: () => {
            const n = m.count ?? 2;
            for (let i = 0; i < n; i++) {
              const side = i % 2 === 0 ? -1 : 1;
              const x = m.kind === 'clones' ? b.x + side * (80 + i * 30) : side < 0 ? this.w.camLeft + 30 : this.w.camRight - 30;
              const e = this.w.spawnEnemy(m.summon ?? 'minion', x, Phaser.Math.Clamp(b.y + Phaser.Math.Between(-60, 60), 470, 680));
              if (e && m.kind === 'clones') this.w.fx.ring(x, e.y, 60, 0x7c4dff, 300);
            }
          },
        });
        end = T + 200;
        break;
      }
      case 'teleport': {
        let dest = { x: 0, y: 0 };
        steps.push({
          at: 0,
          fn: () => {
            b.invulnUntil = this.w.now + 360;
            this.w.fx.ring(b.x, b.y, 90, 0x7c4dff, 300);
            this.w.scene.tweens.add({ targets: b.view, alpha: 0.05, duration: 200 });
          },
        });
        steps.push({
          at: 220,
          fn: () => {
            const side = this.p.facing === 1 ? -1 : 1;
            dest = {
              x: Phaser.Math.Clamp(this.p.x + side * 95, this.w.camLeft + 60, this.w.camRight - 60),
              y: this.p.y,
            };
            this.tele({ kind: 'circle', x: dest.x, y: dest.y, r: 70 }, Math.max(320, T - 220), 0x7c4dff);
          },
        });
        steps.push({
          at: Math.max(540, T),
          fn: () => {
            b.x = dest.x;
            b.y = dest.y;
            this.face();
            this.w.scene.tweens.add({ targets: b.view, alpha: 1, duration: 100 });
            v.playAttack('punchA', 120, 140, 240);
          },
        });
        steps.push({ at: Math.max(540, T) + 120, fn: () => this.melee({ range: 80 + 25 * sc, damage: dmg, knockback: 240, launch: true, depth: 34 }) });
        end = Math.max(540, T) + 420;
        break;
      }
      case 'leap': {
        let target = { x: this.p.x, y: this.p.y };
        steps.push({ at: 0, fn: () => { v.hold('crouch', CROUCH, 150); } });
        steps.push({
          at: 250,
          fn: () => {
            b.vz = 1250;
            b.z = 1;
            b.gravityScale = 0.0001;
            this.w.audio.play('jump');
            this.tele({ kind: 'circle', x: this.p.x, y: this.p.y, r: 100 }, T, color, () => {
              target = { x: this.p.x, y: this.p.y };
              return target;
            });
          },
        });
        tick = (d, t) => {
          if (t > 250 && t < 250 + T) {
            b.z = Math.min(620, b.z + 1500 * (d / 1000));
            b.vz = 0;
          }
        };
        steps.push({
          at: 250 + T,
          fn: () => {
            b.x = target.x;
            b.y = target.y;
            b.gravityScale = 3;
            b.vz = -400;
          },
        });
        steps.push({
          at: 250 + T + 260,
          fn: () => {
            b.gravityScale = 1;
            b.z = 0;
            b.vz = 0;
            this.melee({ range: 100, damage: dmg, knockback: 260, launch: true, shape: 'around', depth: 46 }, { x: b.x, y: b.y });
            this.w.fx.ring(b.x, b.y, 120, color, 320);
            this.w.fx.dust(b.x, b.y, 8);
            this.w.shake(0.012, 240);
            this.w.audio.play('explosion');
            v.play('idle', true);
          },
        });
        end = 250 + T + 300;
        break;
      }
      case 'dive': {
        const n = m.count ?? 1;
        let at = 0;
        for (let i = 0; i < n; i++) {
          let target = { x: this.p.x, y: this.p.y };
          const tt = i === 0 ? T : T * 0.8;
          steps.push({
            at,
            fn: () => {
              b.gravityScale = 0;
              v.play('telegraph', true);
              this.w.audio.play('roar');
              this.tele({ kind: 'circle', x: this.p.x, y: this.p.y, r: 90 }, tt + 260, 0xff3b6b, () => {
                if (this.diving) return target;
                target = { x: this.p.x, y: this.p.y };
                return target;
              });
              this.diving = false;
            },
          });
          steps.push({ at: at + tt, fn: () => { this.diving = true; this.diveFrom = { x: b.x, y: b.y, z: b.z }; this.diveTarget = target; v.playAttack('dive', 0, 260, 400); } });
          steps.push({
            at: at + tt + 260,
            fn: () => {
              this.diving = false;
              b.x = target.x;
              b.y = target.y;
              b.z = 0;
              this.melee({ range: 90, damage: dmg, knockback: 250, launch: true, shape: 'around', depth: 44 }, { x: b.x, y: b.y });
              this.w.fx.ring(b.x, b.y, 110, 0xff3b6b, 300);
              this.w.fx.dust(b.x, b.y, 6);
              this.w.shake(0.01, 220);
            },
          });
          at += tt + 260 + (i < n - 1 ? 500 : 0);
          if (i < n - 1) {
            steps.push({ at: at - 480, fn: () => { b.z = 1; } });
          }
        }
        tick = (d, t) => {
          if (this.diving) {
            const f = this.diveFrom;
            const tg = this.diveTarget;
            b.x += (tg.x - b.x) * Math.min(1, (d / 1000) * 14);
            b.y += (tg.y - b.y) * Math.min(1, (d / 1000) * 14);
            b.z = Math.max(0, b.z - (f.z / 0.26) * (d / 1000));
          } else if (b.z > 0 && b.z < 420 && t < end - 200) {
            b.z = Math.min(420, b.z + 600 * (d / 1000));
          }
        };
        end = at;
        this.recoverOverride = m.recoveryMs;
        break;
      }
      case 'freezeZone': {
        const n = this.b.phaseIndex > 0 ? 3 : 1;
        const spots: Array<{ x: number; y: number }> = [];
        steps.push({
          at: 0,
          fn: () => {
            v.hold('roar', VICTORY, 150);
            for (let i = 0; i < n; i++) {
              const s = i === 0 ? { x: this.p.x, y: this.p.y } : { x: this.p.x + Phaser.Math.Between(-220, 220), y: Phaser.Math.Clamp(this.p.y + Phaser.Math.Between(-80, 80), 470, 680) };
              spots.push(s);
              this.tele({ kind: 'circle', x: s.x, y: s.y, r: m.range ?? 120 }, T, color);
            }
          },
        });
        steps.push({
          at: T,
          fn: () => {
            for (const s of spots) {
              this.melee({ range: m.range ?? 120, damage: dmg, knockback: 30, shape: 'around', depth: (m.range ?? 120) * 0.45, stun: 200 }, s, 1500);
              this.w.fx.ring(s.x, s.y, m.range ?? 120, 0xbff4ff, 400);
            }
            this.w.audio.play('freeze');
          },
        });
        end = T + 250;
        break;
      }
      case 'iceWall':
      case 'wave': {
        const n = m.count ?? 1;
        for (let i = 0; i < n; i++) {
          const at = i * 520;
          steps.push({
            at,
            fn: () => {
              this.face();
              v.playAttack('slam', i === 0 ? T : 420, 160, 200);
              const laneY = i === 0 ? this.p.y : Phaser.Math.Clamp(this.p.y + (Math.random() < 0.5 ? -70 : 70), 470, 680);
              this.waveLanes[i] = laneY;
              const dir = b.facing;
              this.tele({ kind: 'rect', x: dir === 1 ? b.x : this.w.camLeft, y: laneY - 30, w: dir === 1 ? this.w.camRight - b.x : b.x - this.w.camLeft, h: 60 }, i === 0 ? T : 420, color);
            },
          });
          steps.push({
            at: at + (i === 0 ? T : 420),
            fn: () => {
              this.w.spawnProjectile({
                owner: b,
                x: b.x + b.facing * 40,
                y: this.waveLanes[i],
                z: 0,
                vx: b.facing * (m.kind === 'iceWall' ? 480 : 540),
                damage: dmg,
                color,
                kind: m.kind === 'iceWall' ? 'ice' : 'wave',
                pierce: true,
                depth: 30,
                radius: 36,
                launch: true,
                lifeMs: 3000,
              });
              this.w.shake(0.006, 160);
              this.w.audio.play(m.kind === 'iceWall' ? 'freeze' : 'explosion');
            },
          });
        }
        end = (n - 1) * 520 + T + 300;
        break;
      }
      case 'blizzard': {
        steps.push({
          at: 0,
          fn: () => {
            v.hold('roar', VICTORY, 150);
            this.w.fx.text((this.w.camLeft + this.w.camRight) / 2, 300, 'BÃO TUYẾT! Đứng gần lò sưởi!', '#bff4ff', 34);
            this.w.audio.play('warning');
          },
        });
        steps.push({ at: T, fn: () => this.w.setBlizzard(true) });
        for (let k = 0; k < 6; k++) {
          steps.push({
            at: T + 300 + k * 500,
            fn: () => {
              const p = this.p;
              if (!this.w.isNearHeater(p.x, p.y) && p.alive && !p.isInvulnerable) {
                p.receiveHit({ attackerId: b.id, attackerX: b.x, dirX: 1, damage: dmg, knockback: 0, launch: false, stunMs: 60, slowMs: 600, grab: false, breaksArmor: false, heavy: false, color: 0xbff4ff, fromHazard: true });
              }
            },
          });
        }
        steps.push({ at: T + 3300, fn: () => this.w.setBlizzard(false) });
        end = T + 3400;
        break;
      }
      case 'curl': {
        steps.push({
          at: 0,
          fn: () => {
            b.curlArmor = true;
            v.hold('block', BLOCK, 120);
            v.setTintAll(0xb8c8e8);
            this.w.fx.text(b.x, b.y - b.height - 10, 'CUỘN GIÁP', '#ffb02e', 28);
            this.w.audio.play('guard');
          },
        });
        steps.push({
          at: 1500,
          fn: () => {
            b.curlArmor = false;
            v.setTintAll(null);
          },
        });
        end = 1550;
        break;
      }
    }
    this.run = { move: m, steps, end, tick };
    this.set('execute');
  }

  private diving = false;
  private diveFrom = { x: 0, y: 0, z: 0 };
  private diveTarget = { x: 0, y: 0 };
  private recoverOverride = 0;
  private waveLanes: number[] = [];

  private execute(dt: number): void {
    const r = this.run;
    if (!r) {
      this.set('idle');
      return;
    }
    for (const s of r.steps) {
      if (!s.done && this.t >= s.at) {
        s.done = true;
        s.fn();
      }
    }
    r.tick?.(dt, this.t);
    if (this.t >= r.end) {
      this.recoverMs = this.recoverOverride || r.move.recoveryMs;
      this.recoverOverride = 0;
      this.cancels = [];
      this.run = null;
      const b = this.b;
      if (b.cfg.body !== 'bat') b.gravityScale = 1;
      // visible "dazed" recovery = counter-attack window
      if (r.move.kind === 'charge' || r.move.kind === 'dive' || r.move.kind === 'leap') {
        b.view?.setWobble(1.5);
        this.w.fx.text(b.x, b.y - b.height - 10, '★ ★', '#ffd23f', 26);
      }
      b.view?.play('idle', true);
      this.set('recover');
    }
  }
}
