import Phaser from 'phaser';
import type { PlaneBody } from '../combat/Hitbox';
import { FLOOR_BOTTOM, FLOOR_TOP, GRAVITY } from '../game/constants';
import { DOWN, GETUP, HURT, HURT2 } from '../rig/Poses';
import type { ActorView } from '../rig/ActorView';
import type { FighterState } from '../types/game';
import type { HitEvent, HitResult, WorldLike } from '../types/world';

let NEXT_ID = 1;

/**
 * Base class for everything that fights or can be hit. Logic coordinates:
 * x = horizontal, y = floor depth (lane), z = height above floor.
 */
export abstract class Actor {
  readonly id = NEXT_ID++;
  abstract readonly team: 'hero' | 'enemy' | 'object';
  x: number;
  y: number;
  z = 0;
  vx = 0; // knockback / external velocity
  vy = 0;
  vz = 0;
  facing: 1 | -1 = 1;
  hp = 1;
  maxHp = 1;
  alive = true;
  removed = false;
  state: FighterState = 'idle';
  stateTime = 0;
  halfWidth = 22;
  halfDepth = 14;
  height = 150;
  mass = 1;
  invulnUntil = 0;
  hitstunUntil = 0;
  slowUntil = 0;
  frozenUntil = 0;
  downUntil = 0;
  armorActive = false;
  isBoss = false;
  grabbable = true;
  damageReceivedMultiplier = 1;
  /** external push (conveyors, wind) applied this frame */
  pushX = 0;
  pushY = 0;
  slippery = false;
  protected deathTimer = 0;
  readonly shadow: Phaser.GameObjects.Image;

  constructor(
    protected world: WorldLike,
    public view: ActorView | null,
    x: number,
    y: number,
    shadowScale = 1,
  ) {
    this.x = x;
    this.y = y;
    this.shadow = world.scene.add.image(x, y, 'fx-shadow').setDepth(-5).setScale(1.3 * shadowScale, 1.1 * shadowScale);
  }

  get plane(): PlaneBody {
    return { x: this.x, y: this.y, z: this.z, halfWidth: this.halfWidth, halfDepth: this.halfDepth, height: this.height };
  }

  get now(): number {
    return this.world.now;
  }

  get isInvulnerable(): boolean {
    return this.now < this.invulnUntil || this.state === 'knockdown' || this.state === 'getup' || this.state === 'defeat';
  }

  get isGrounded(): boolean {
    return this.z <= 0 && this.vz === 0;
  }

  get speedFactor(): number {
    return this.now < this.slowUntil ? 0.5 : 1;
  }

  get isFrozen(): boolean {
    return this.now < this.frozenUntil;
  }

  setState(s: FighterState): void {
    this.state = s;
    this.stateTime = 0;
  }

  /** Integrate external velocity, gravity and clamp to the floor band / bounds. */
  protected physics(dt: number): void {
    const s = dt / 1000;
    this.x += (this.vx + this.pushX) * s;
    this.y += (this.vy + this.pushY) * s;
    this.pushX = 0;
    this.pushY = 0;
    const fr = this.slippery ? 500 : 2200;
    const decay = (v: number): number => (Math.abs(v) <= fr * s ? 0 : v - Math.sign(v) * fr * s);
    if (this.z <= 0) {
      this.vx = decay(this.vx);
      this.vy = decay(this.vy);
    }
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= GRAVITY * s * this.gravityScale;
      this.z += this.vz * s;
      if (this.z <= 0) {
        this.z = 0;
        const impact = this.vz;
        this.vz = 0;
        this.onLand(impact);
      }
    }
    const b = this.world.bounds(this);
    this.x = Phaser.Math.Clamp(this.x, b.minX + this.halfWidth, b.maxX - this.halfWidth);
    this.y = Phaser.Math.Clamp(this.y, Math.max(b.minY, FLOOR_TOP), Math.min(b.maxY, FLOOR_BOTTOM));
  }

  gravityScale = 1;

  protected onLand(_impact: number): void {
    if (this.state === 'knockdown') {
      this.world.fx.dust(this.x, this.y, 5);
      this.world.audio.play('down');
      this.downUntil = this.now + this.downDuration();
    }
  }

  protected downDuration(): number {
    return 650;
  }

  /** Shared knockdown → getup flow. Returns true while it owns the actor. */
  protected updateKnockdown(dt: number): boolean {
    if (this.state === 'knockdown') {
      const v = this.view;
      if (v) {
        const target = this.z > 0 ? Math.min(80, this.stateTime * 0.35) : 88;
        v.setLie(target);
        if (v.currentAnim !== 'down') v.hold('down', DOWN, 120);
      }
      if (this.z <= 0 && this.downUntil > 0 && this.now >= this.downUntil) {
        if (!this.alive) {
          this.deathTimer += dt;
          return true;
        }
        this.setState('getup');
        this.downUntil = 0;
        this.view?.hold('getup', GETUP, 120);
      }
      return true;
    }
    if (this.state === 'getup') {
      this.view?.setLie(Math.max(0, 88 - this.stateTime * 0.5));
      if (this.stateTime > 360) {
        this.view?.setLie(0);
        this.setState('idle');
        this.invulnUntil = Math.max(this.invulnUntil, this.now + 250);
        this.onGotUp();
      }
      return true;
    }
    return false;
  }

  protected onGotUp(): void {}

  /** Optional hook to modify incoming damage (boss phases, assist mode...). */
  protected incomingMultiplier(_e: HitEvent): number {
    return 1;
  }

  /** Whether this hit should make the actor flinch (anti stun-lock for bosses). */
  protected canFlinch(_e: HitEvent): boolean {
    return true;
  }

  receiveHit(e: HitEvent): HitResult {
    const miss: HitResult = { landed: false, damage: 0, blocked: false, killed: false };
    if (!this.alive || this.isInvulnerable) return miss;
    let mul = this.damageReceivedMultiplier * this.incomingMultiplier(e);
    const armored = this.armorActive && !e.breaksArmor;
    if (armored) mul *= 0.3;
    const dmg = Math.max(1, Math.round(e.damage * mul));
    this.hp = Math.max(0, this.hp - dmg);
    this.facing = e.dirX === 1 ? -1 : 1;
    const killed = this.hp <= 0;
    if (killed) {
      this.alive = false;
      this.view?.setDead?.();
      this.onDefeated(e);
      this.launch(e, Math.max(260, e.knockback));
      return { landed: true, damage: dmg, blocked: armored, killed: true };
    }
    if (e.slowMs > 0) this.slowUntil = this.now + e.slowMs;
    if (e.freezeMs) this.applyFreeze(e.freezeMs);
    if (armored) {
      this.view?.flash(60);
      this.vx = e.dirX * e.knockback * 0.15;
      return { landed: true, damage: dmg, blocked: true, killed: false };
    }
    if (!this.canFlinch(e)) {
      this.view?.flash(60);
      return { landed: true, damage: dmg, blocked: false, killed: false };
    }
    if (e.launch && this.canBeLaunched()) {
      this.launch(e, e.knockback);
    } else {
      this.hurt(e);
    }
    return { landed: true, damage: dmg, blocked: false, killed: false };
  }

  protected canBeLaunched(): boolean {
    return true;
  }

  protected applyFreeze(ms: number): void {
    this.frozenUntil = this.now + ms;
  }

  protected launch(e: HitEvent, kb: number): void {
    this.setState('knockdown');
    this.vz = 560;
    this.z = Math.max(this.z, 1);
    this.vx = (e.dirX * kb * 0.85) / this.mass;
    this.vy = 0;
    this.downUntil = 0;
    this.view?.flash(80);
    this.onHurt(e);
  }

  protected hurt(e: HitEvent): void {
    this.setState('hurt');
    this.hitstunUntil = this.now + (e.stunMs > 0 ? e.stunMs : 280);
    this.vx = (e.dirX * e.knockback) / this.mass;
    this.view?.flash(80);
    this.view?.hold('hurt', Math.random() < 0.5 ? HURT : HURT2, 50);
    this.onHurt(e);
  }

  protected onHurt(_e: HitEvent): void {}
  protected onDefeated(_e: HitEvent): void {}

  syncView(): void {
    const v = this.view;
    if (v) {
      v.setPosition(this.x, this.y - this.z);
      v.setDepth(this.y);
      v.setFacing(this.facing);
    }
    const zs = Math.max(0.45, 1 - this.z / 400);
    this.shadow.setPosition(this.x, this.y + 2).setAlpha(zs);
    this.shadow.scaleX = 1.3 * zs * this.shadowScale;
    this.shadow.scaleY = 1.1 * zs * this.shadowScale;
  }

  shadowScale = 1;

  /** Time in ms the corpse stays before fading. */
  get deathDone(): boolean {
    return !this.alive && this.deathTimer > 700;
  }

  abstract update(dt: number): void;

  destroy(): void {
    if (this.removed) return;
    this.removed = true;
    this.view?.destroy();
    this.view = null;
    this.shadow.destroy();
  }
}
