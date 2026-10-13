import type { Player } from '../entities/Player';
import { GAME_W } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import type { GameWorld } from '../systems/GameWorld';
import type { StageManager } from '../systems/StageManager';
import type { CharacterId, InputState } from '../types/game';
import { MirrorHost } from './Mirror';
import { CoopNet, type NetMsg } from './Net';

/** What GameScene needs to start an online co-op stage as host. */
export interface CoopStartData {
  hostChar: CharacterId;
  guestChar: CharacterId;
  /** guest screen width in game pixels (the play field uses the narrower of both screens) */
  guestW: number;
}

/** Bit flags of the one-shot buttons in an 'in' (input) message. */
export const IN_FLAGS = { attack: 1, skill: 2, dodge: 4, jump: 8, ultimate: 16, cycleSkill: 32 } as const;

const SNAPSHOT_MS = 50; // 20 snapshots per second

type Ev = Array<string | number>;

/**
 * Host side of online co-op, owned by GameScene: receives the partner's inputs, streams the picture
 * (display-list deltas), HUD numbers, sounds, banners and camera shakes to the guest.
 */
export class CoopHost {
  readonly net = CoopNet.get();
  private mirror: MirrorHost;
  private offs: Array<() => void> = [];
  private in2: InputState = { moveX: 0, moveY: 0, attack: false, skill: false, dodge: false, jump: false, ultimate: false, cycleSkill: false, selectSkill: -1, pause: false };
  private flags = 0;
  private sel = -1;
  private acc = 0;
  private events: Ev[] = [];
  private go = false;
  /** guest finished loading the stage */
  ready = false;
  waitedMs = 0;
  partnerGone = false;

  constructor(
    private scene: Phaser.Scene,
    private world: GameWorld,
    private sm: () => StageManager,
    private onPartnerLeft: () => void,
  ) {
    this.mirror = new MirrorHost(scene);
    const n = this.net;
    this.offs.push(
      n.on('in', (m) => this.onInput(m)),
      n.on('ready', () => {
        this.ready = true;
        this.mirror.reset();
      }),
      n.on('need-full', () => this.mirror.reset()),
      n.on('close', () => this.partnerLeft()),
      n.on('bye', () => this.partnerLeft()),
    );
    AudioSystem.get().tap = (name) => this.events.push(['a', name]);
    world.onShake = (i, ms) => this.events.push(['k', i, ms]);
    world.onFlash = (c, ms) => this.events.push(['f', c, ms]);
  }

  private onInput(m: NetMsg): void {
    this.in2.moveX = Number(m.x) || 0;
    this.in2.moveY = Number(m.y) || 0;
    this.flags |= Number(m.f) || 0;
    if (typeof m.s === 'number' && m.s >= 0) this.sel = m.s;
  }

  private partnerLeft(): void {
    if (this.partnerGone) return;
    this.partnerGone = true;
    this.ready = false;
    this.onPartnerLeft();
  }

  /** The partner's input for this frame (one-shot buttons are consumed by consume()). */
  input2(): InputState {
    const s = this.in2;
    const f = this.flags;
    s.attack = !!(f & IN_FLAGS.attack);
    s.skill = !!(f & IN_FLAGS.skill);
    s.dodge = !!(f & IN_FLAGS.dodge);
    s.jump = !!(f & IN_FLAGS.jump);
    s.ultimate = !!(f & IN_FLAGS.ultimate);
    s.cycleSkill = !!(f & IN_FLAGS.cycleSkill);
    s.selectSkill = this.sel;
    return s;
  }

  consume(): void {
    this.flags = 0;
    this.sel = -1;
  }

  banner(title: string, sub = '', color = '#ffd23f'): void {
    this.events.push(['b', title, sub, color]);
  }

  setGo(on: boolean): void {
    this.go = on;
  }

  /** Tell the guest the stage is paused / resumed on the host. */
  paused(on: boolean): void {
    this.net.send({ t: 'pause', on });
  }

  /** Stage finished: the guest gets the same result screen data. */
  end(result: Record<string, unknown>): void {
    this.flush();
    this.net.send({ t: 'end', r: result });
  }

  private heroRow(p: Player): Array<string | number> {
    return [p.stats.id, Math.ceil(p.hp), p.maxHp, Math.floor(p.energy.current), p.selectedSkill, Math.round(p.skillCooldownLeft), Math.round(p.dodgeCooldownLeft), p.alive ? 1 : 0];
  }

  private hud(): Record<string, unknown> {
    const w = this.world;
    const sm = this.sm();
    const wave = sm.waveInfo;
    return {
      s: w.score,
      l: sm.lives,
      st: sm.state,
      bf: sm.isBossFight ? 1 : 0,
      wv: wave ? [wave.index, wave.total, wave.remaining] : 0,
      go: this.go ? 1 : 0,
      b: sm.bosses.map((b) => [b.cfg.id, Math.ceil(b.hp), b.maxHp, b.shieldMul, b.curlArmor ? 1 : 0, b.enraged ? 1 : 0, b.phaseIndex, b.alive ? 1 : 0]),
      p: w.players.map((p) => this.heroRow(p)),
    };
  }

  /** Call once per frame after the world update. */
  tick(dt: number): void {
    if (!this.ready || !this.net.connected) {
      this.events.length = 0;
      return;
    }
    this.acc += dt;
    if (this.acc < SNAPSHOT_MS) return;
    this.acc = 0;
    this.flush();
  }

  private flush(): void {
    if (!this.net.connected) return;
    this.net.send({
      t: 's',
      m: this.mirror.diff(),
      v: [GAME_W, Math.round(this.scene.cameras.main.scrollX * 10) / 10],
      h: this.hud(),
      e: this.events.splice(0),
      mu: AudioSystem.get().musicIndex,
    });
  }

  destroy(): void {
    this.offs.forEach((f) => f());
    this.offs = [];
    AudioSystem.get().tap = null;
    this.world.onShake = null;
    this.world.onFlash = null;
  }
}
