import Phaser from 'phaser';
import { ComboSystem } from '../combat/ComboSystem';
import { CooldownTracker, EN_GAIN_FINISHER, EN_GAIN_LIGHT, EnergyMeter } from '../combat/SkillSystem';
import { BASE_WALK_SPEED, CHARACTERS } from '../config/characters';
import { getMove, moveDuration } from '../config/moves';
import { HERO_SCALE } from '../game/constants';
import { DODGE, FROZEN, JUMP_FALL, JUMP_UP, VICTORY } from '../rig/Poses';
import type { ActorView } from '../rig/ActorView';
import { createHeroView } from '../rig/HeroSpriteView';
import type { CharacterId, CharacterStats, InputState, MoveConfig } from '../types/game';
import type { HitEvent, HitResult } from '../types/world';
import { Actor } from './Actor';
import type { GameWorldApi } from './WorldApi';

export const DODGE_MS = 220;
export const DODGE_IFRAME: [number, number] = [50, 170];
export const DODGE_COOLDOWN = 550;
const JUMP_V = 860;

export class Player extends Actor {
  readonly team = 'hero' as const;
  readonly stats: CharacterStats;
  readonly combo: ComboSystem;
  readonly energy: EnergyMeter;
  readonly cooldowns = new CooldownTracker();
  selectedSkill = 0;
  currentMove: MoveConfig | null = null;
  private moveStart = 0;
  private attackBuffered = false;
  private dodgeReadyAt = 0;
  private dodgeDir: 1 | -1 = 1;
  private airAttackUsed = false;
  private countered = false;
  private walkDust = 0;
  private lastSkillAt = -9999;
  controlsLocked = false;
  hitsTaken = 0;

  constructor(protected w: GameWorldApi, id: CharacterId, x: number, y: number) {
    const stats = CHARACTERS[id];
    const rig = createHeroView(w.scene, id, HERO_SCALE);
    super(w, rig, x, y);
    this.stats = stats;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.damageReceivedMultiplier = stats.damageReceivedMultiplier;
    this.combo = new ComboSystem(3, stats.comboWindowMs, 1200);
    this.energy = new EnergyMeter(stats.maxEnergy, 0);
    this.height = 150;
    this.halfWidth = 20;
  }

  get rig(): ActorView & Phaser.GameObjects.Container {
    return this.view as ActorView & Phaser.GameObjects.Container;
  }

  get skillIds(): [string, string, string] {
    return this.stats.skills;
  }

  get selectedSkillMove(): MoveConfig {
    return getMove(this.stats.skills[this.selectedSkill]);
  }

  get dodgeCooldownLeft(): number {
    return Math.max(0, this.dodgeReadyAt - this.now);
  }

  get skillCooldownLeft(): number {
    return Math.max(0, this.lastSkillAt + 400 - this.now);
  }

  protected incomingMultiplier(): number {
    return this.w.assistMode ? 0.9 : 1;
  }

  protected downDuration(): number {
    return 520;
  }

  onAttackedWhileInvulnerable(): void {
    if (this.currentMove?.counter && !this.countered && this.state === 'skill') {
      this.countered = true;
      this.w.fx.text(this.x, this.y - 190, 'PHẢN ĐÒN!', '#ffe066', 30);
      this.energy.add(10);
    }
  }

  receiveHit(e: HitEvent): HitResult {
    const r = super.receiveHit(e);
    if (r.landed) {
      this.hitsTaken++;
      this.energy.gainFromHurt();
      this.combo.chainStep = 0;
      this.currentMove = null;
      this.attackBuffered = false;
      this.w.combat.cancelAttacksOf(this);
      this.w.audio.play('hurt');
      this.w.fx.hitSpark(this.x, this.y - this.z - 90, 0xff4d4d, e.heavy);
      this.w.fx.damageNumber(this.x, this.y - this.z - 150, r.damage, '#ff6b6b');
      this.w.shake(e.heavy ? 0.008 : 0.004, e.heavy ? 180 : 90);
      if (!this.settingsReduceFlash && e.heavy) this.w.fx.flashScreen(0xff0000, 120);
    }
    return r;
  }

  private get settingsReduceFlash(): boolean {
    return this.w.settings.reduceFlash;
  }

  protected applyFreeze(ms: number): void {
    const m = ms * this.w.playerFreezeMultiplier();
    this.frozenUntil = this.now + m;
    this.w.audio.play('freeze');
  }

  protected onDefeated(): void {
    this.w.combat.cancelAttacksOf(this);
    this.w.audio.play('defeat');
    this.w.onPlayerDefeated();
  }

  /** Respawn after losing a life. */
  revive(): void {
    this.alive = true;
    this.hp = this.maxHp;
    this.deathTimer = 0;
    this.z = 0;
    this.vz = 0;
    this.vx = 0;
    this.setState('idle');
    this.frozenUntil = 0;
    this.invulnUntil = this.now + 2200;
    this.rig.setLie(0);
    this.rig.play('idle', true);
    this.w.fx.ring(this.x, this.y - 60, 90, 0xffffff, 500);
  }

  celebrate(): void {
    if (!this.alive) return;
    this.setState('victory');
    this.currentMove = null;
    this.rig.hold('victory', VICTORY, 200);
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  update(dt: number, input?: InputState): void {
    this.stateTime += dt;
    this.energy.update(dt);
    this.combo.update(dt);
    const rig = this.rig;
    rig.update(dt);
    // blink while respawn-invulnerable
    rig.setAlpha(this.now < this.invulnUntil && this.state !== 'dodge' && this.state !== 'skill' && Math.floor(this.now / 80) % 2 === 0 ? 0.55 : 1);

    if (this.updateKnockdown(dt)) {
      this.physics(dt);
      this.syncView();
      return;
    }
    if (!this.alive) {
      this.physics(dt);
      this.syncView();
      return;
    }
    if (this.state === 'victory') {
      this.physics(dt);
      this.syncView();
      return;
    }
    const inp = this.controlsLocked || !input ? null : input;

    // frozen: mash attack to break out faster
    if (this.isFrozen) {
      if (rig.currentAnim !== 'frozen') {
        rig.hold('frozen', FROZEN, 60);
        rig.setTintAll(0x9be7ff);
      }
      rig.setWobble(1.2);
      if (inp?.attack || inp?.jump || inp?.dodge) this.frozenUntil -= 140;
      this.physics(dt);
      this.syncView();
      return;
    } else if (rig.currentAnim === 'frozen') {
      rig.setWobble(0);
      rig.setTintAll(null);
      rig.play('idle', true);
      this.setState('idle');
    }

    if (this.state === 'hurt') {
      if (this.now >= this.hitstunUntil) this.setState('idle');
      this.physics(dt);
      this.syncView();
      return;
    }

    if (inp) {
      if (inp.cycleSkill) this.selectedSkill = (this.selectedSkill + 1) % 3;
      if (inp.selectSkill >= 0) this.selectedSkill = inp.selectSkill;
      if (inp.ultimate) this.tryUltimate();
      else if (inp.skill) this.trySkill();
      else if (inp.dodge) this.tryDodge(inp);
      else if (inp.jump) this.tryJump();
      else if (inp.attack) this.tryAttack();
    }

    switch (this.state) {
      case 'idle':
      case 'move':
        this.updateLocomotion(dt, inp);
        break;
      case 'jump':
        this.updateJump(dt, inp);
        break;
      case 'dodge':
        this.updateDodge(dt);
        break;
      case 'attack':
      case 'skill':
        this.updateMove(dt, inp);
        break;
      default:
        break;
    }
    this.physics(dt);
    this.syncView();
  }

  private canAct(): boolean {
    return this.state === 'idle' || this.state === 'move' || this.isCancellable();
  }

  private isCancellable(): boolean {
    const m = this.currentMove;
    if (!m || (this.state !== 'attack' && this.state !== 'skill')) return false;
    if (m.kind === 'ultimate' || m.kind === 'skill') return false;
    const t = this.now - this.moveStart;
    return t >= (m.cancelFrom ?? moveDuration(m) - m.recoveryMs * 0.4);
  }

  private tryAttack(): void {
    if (this.state === 'jump') {
      if (!this.airAttackUsed) {
        this.airAttackUsed = true;
        this.startMove(getMove(this.stats.jumpAttack), true);
      }
      return;
    }
    if (this.state === 'attack' && this.currentMove && this.currentMove.kind !== 'finisher') {
      this.attackBuffered = true;
      if (this.isCancellable()) this.startChain();
      return;
    }
    if (this.state === 'idle' || this.state === 'move') this.startChain();
  }

  private startChain(): void {
    const step = this.combo.nextChainStep();
    this.attackBuffered = false;
    this.startMove(getMove(this.stats.lightChain[step]));
  }

  private trySkill(): void {
    const m = this.selectedSkillMove;
    if (!this.canAct() || !this.isGrounded) return;
    if (!this.cooldowns.ready(m.id, this.now) || this.now - this.lastSkillAt < 400) return;
    if (!this.energy.spend(m.energyCost)) {
      this.w.fx.text(this.x, this.y - 200, 'Thiếu năng lượng!', '#9ad0ff', 22);
      return;
    }
    this.cooldowns.trigger(m.id, this.now, m.cooldownMs);
    this.lastSkillAt = this.now;
    this.w.audio.play('skill');
    this.w.fx.text(this.x, this.y - 205, m.name, '#ffffff', 24);
    this.startMove(m);
  }

  private tryUltimate(): void {
    const m = getMove(this.stats.ultimate);
    if (!this.canAct() || !this.isGrounded) return;
    if (!this.energy.spend(m.energyCost)) {
      this.w.fx.text(this.x, this.y - 200, 'Tuyệt kỹ cần 100 EN', '#9ad0ff', 22);
      return;
    }
    this.lastSkillAt = this.now;
    this.w.audio.play('ultimate');
    this.w.fx.text(this.x, this.y - 230, m.name.toUpperCase() + '!', '#ffd23f', 40);
    if (!this.w.settings.reduceFlash) this.w.fx.flashScreen(m.color ?? 0xffffff, 160);
    this.w.shake(0.006, 260);
    this.w.hitStop(180);
    this.startMove(m);
  }

  private tryDodge(inp: InputState): void {
    if (this.now < this.dodgeReadyAt || !this.isGrounded) return;
    if (!(this.state === 'idle' || this.state === 'move' || this.state === 'attack')) return;
    this.w.combat.cancelAttacksOf(this);
    this.currentMove = null;
    this.dodgeDir = inp.moveX > 0.2 ? 1 : inp.moveX < -0.2 ? -1 : ((-this.facing) as 1 | -1);
    this.dodgeVy = inp.moveY * 260;
    this.setState('dodge');
    this.dodgeReadyAt = this.now + DODGE_COOLDOWN;
    this.invulnUntil = Math.max(this.invulnUntil, this.now + DODGE_IFRAME[1]);
    this.rig.hold('dodge', DODGE, 40);
    this.w.audio.play('dodge');
    this.w.fx.afterimage(this.rig, this.stats.palette.accent);
  }

  private dodgeVy = 0;

  private tryJump(): void {
    if (!(this.state === 'idle' || this.state === 'move') || !this.isGrounded) return;
    this.setState('jump');
    this.vz = JUMP_V;
    this.z = 1;
    this.airAttackUsed = false;
    this.rig.hold('jumpUp', JUMP_UP, 80);
    this.w.audio.play('jump');
  }

  private startMove(m: MoveConfig, inAir = false): void {
    this.currentMove = m;
    this.moveStart = this.now;
    this.countered = false;
    if (!inAir) this.setState(m.kind === 'skill' || m.kind === 'ultimate' ? 'skill' : 'attack');
    if (m.iframes) this.invulnUntil = Math.max(this.invulnUntil, this.now + m.iframes[1]);
    this.rig.playMove(m);
    this.w.audio.play('whoosh');
    const accent = m.color ?? this.stats.palette.accent;
    if (m.kind === 'skill' || m.kind === 'ultimate') this.w.fx.afterimage(this.rig, accent);
    this.w.combat.startAttack({
      owner: this,
      hits: m.hits,
      attackMultiplier: this.stats.attackMultiplier,
      comboCount: () => this.combo.hitCount,
      falloff: m.extraTargetFalloff,
      color: accent,
      heavy: m.kind === 'finisher' || m.kind === 'ultimate',
      onHit: (target, res, hit, idx) => this.onMoveHit(m, target, res, hit.knockback, idx),
    });
  }

  private onMoveHit(m: MoveConfig, target: Actor, res: HitResult, kb: number, idx: number): void {
    if (m.counter && this.countered && target.alive) {
      // counter bonus: +50% on the riposte
      const bonus = Math.round(res.damage * 0.5);
      target.hp = Math.max(1, target.hp - bonus);
    }
    const count = this.combo.registerHit();
    if (m.kind === 'light' || m.kind === 'jump') this.energy.add(EN_GAIN_LIGHT);
    else if (m.kind === 'finisher') this.energy.add(EN_GAIN_FINISHER);
    const hy = target.y - target.z - target.height * 0.55;
    const heavy = kb >= 200 || m.kind === 'finisher' || m.kind === 'ultimate';
    this.w.fx.hitSpark(target.x - this.facing * 10, hy, res.blocked ? 0x9ad0ff : m.color ?? 0xfff2a8, heavy);
    this.w.fx.damageNumber(target.x, hy - 40, res.damage, res.blocked ? '#9ad0ff' : count >= 10 ? '#ffd23f' : '#ffffff');
    if (res.blocked) this.w.audio.play('guard');
    else this.w.audio.play(heavy ? 'heavy' : m.anim.toLowerCase().includes('kick') ? 'kick' : 'punch');
    if (heavy) {
      this.w.hitStop(m.kind === 'ultimate' && idx < m.hits.length - 1 ? 40 : 70);
      this.w.shake(0.005, 110);
    }
    this.w.addScore(res.damage * 10 + (count >= 5 ? count * 5 : 0));
  }

  private slideX = 0;
  private slideY = 0;

  private updateLocomotion(dt: number, inp: InputState | null): void {
    const mx = inp?.moveX ?? 0;
    const my = inp?.moveY ?? 0;
    const moving = Math.abs(mx) > 0.15 || Math.abs(my) > 0.15;
    const sp = BASE_WALK_SPEED * this.stats.moveSpeed * this.speedFactor;
    const len = Math.max(1, Math.hypot(mx, my));
    const wantX = moving ? (mx / len) * sp : 0;
    const wantY = moving ? (my / len) * sp * 0.72 : 0;
    if (this.slippery) {
      // icy floor: momentum carries you (GDD Màn 8)
      const k = Math.min(1, 2.2 * (dt / 1000));
      this.slideX += (wantX - this.slideX) * k;
      this.slideY += (wantY - this.slideY) * k;
    } else {
      this.slideX = wantX;
      this.slideY = wantY;
    }
    this.x += this.slideX * (dt / 1000);
    this.y += this.slideY * (dt / 1000);
    if (moving) {
      if (Math.abs(mx) > 0.15) this.facing = mx > 0 ? 1 : -1;
      if (this.state !== 'move') this.setState('move');
      this.rig.play('walk');
      this.walkDust += dt;
      if (this.walkDust > 260) {
        this.walkDust = 0;
        this.w.fx.dust(this.x - this.facing * 14, this.y, 1);
      }
    } else {
      if (this.state !== 'idle') this.setState('idle');
      this.rig.play('idle');
    }
  }

  private updateJump(dt: number, inp: InputState | null): void {
    const mx = inp?.moveX ?? 0;
    this.x += mx * BASE_WALK_SPEED * this.stats.moveSpeed * 0.85 * (dt / 1000);
    this.y += (inp?.moveY ?? 0) * BASE_WALK_SPEED * 0.4 * (dt / 1000);
    if (Math.abs(mx) > 0.2 && !this.currentMove) this.facing = mx > 0 ? 1 : -1;
    if (!this.currentMove) {
      if (this.vz < 0 && this.rig.currentAnim !== 'jumpFall') this.rig.hold('jumpFall', JUMP_FALL, 140);
    }
  }

  protected onLand(impact: number): void {
    super.onLand(impact);
    if (this.state === 'jump') {
      this.w.audio.play('land');
      this.w.fx.dust(this.x, this.y, 3);
      const m = this.currentMove;
      if (m && m.kind === 'jump' && m.hits[0].shape === 'around') {
        // Bắp stomp: shockwave on landing
        this.w.combat.startAttack({ owner: this, hits: [{ ...m.hits[0], at: 0, activeMs: 80 }], color: 0xff8a3d, heavy: true });
        this.w.fx.ring(this.x, this.y, 80, 0xff8a3d, 300);
        this.w.shake(0.004, 120);
      }
      this.w.combat.cancelAttacksOf(this);
      this.currentMove = null;
      this.setState('idle');
      this.rig.play('idle', true);
    }
  }

  private updateDodge(dt: number): void {
    const t = this.stateTime;
    const k = 1 - t / DODGE_MS;
    this.x += this.dodgeDir * 600 * Math.max(0.2, k) * (dt / 1000);
    this.y += this.dodgeVy * Math.max(0.2, k) * (dt / 1000);
    if (t > 110 && t - dt <= 110) this.w.fx.afterimage(this.rig, this.stats.palette.accent);
    if (t >= DODGE_MS) {
      this.setState('idle');
      this.rig.play('idle', true);
    }
  }

  /** Is the given time inside the dodge's invulnerability frames? (exposed for tests/HUD) */
  get dodgeProgress(): number {
    return this.state === 'dodge' ? Phaser.Math.Clamp(this.stateTime / DODGE_MS, 0, 1) : 0;
  }

  private updateMove(dt: number, inp: InputState | null): void {
    const m = this.currentMove;
    if (!m) {
      this.setState('idle');
      return;
    }
    const t = this.now - this.moveStart;
    const total = moveDuration(m);
    // dash movement
    if (m.dash) {
      const first = m.hits[0];
      const dashEnd = m.kind === 'ultimate' ? m.hits[m.hits.length - 1].at : first.at + first.activeMs;
      if (m.counter) {
        if (t < first.at) this.x -= this.facing * 300 * (dt / 1000);
        else if (t < dashEnd) this.x += this.facing * (m.dash / Math.max(60, dashEnd - first.at)) * dt;
      } else if (t < dashEnd) {
        this.x += this.facing * (m.dash / Math.max(80, dashEnd)) * dt;
      }
      if (Math.floor(t / 70) !== Math.floor((t - dt) / 70) && t < dashEnd) this.w.fx.afterimage(this.rig, m.color ?? this.stats.palette.accent);
    }
    // small steer on depth during light attacks keeps targeting forgiving
    if (inp && m.kind === 'light') this.y += inp.moveY * 40 * (dt / 1000);
    if (this.attackBuffered && this.isCancellable() && (m.kind === 'light')) {
      this.startChain();
      return;
    }
    if (t >= total) {
      this.currentMove = null;
      this.setState('idle');
      this.rig.play('idle', true);
      if (this.attackBuffered) this.startChain();
    }
  }
}
