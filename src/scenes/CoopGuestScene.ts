import Phaser from 'phaser';
import { paintBackground } from '../art/registry';
import { getBoss } from '../config/bosses';
import { CHARACTERS } from '../config/characters';
import { getMove } from '../config/moves';
import { getStage } from '../config/stages';
import { FLOOR_TOP, FONT, GAME_H, GAME_W } from '../game/constants';
import { IN_FLAGS } from '../net/CoopHost';
import { MirrorGuest } from '../net/Mirror';
import { CoopNet, type NetMsg } from '../net/Net';
import { createSpriteAnims } from '../rig/SpriteView';
import { AudioSystem, type Sfx } from '../systems/AudioSystem';
import { InputSystem } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { prepareStageSprites } from '../systems/StageAssets';
import type { CharacterId, StageConfig } from '../types/game';
import type { HUDScene, HudBoss, HudPlayer, HudSource } from './HUDScene';

export interface CoopGuestData {
  stageId: number;
  hostChar: CharacterId;
  guestChar: CharacterId;
}

/** A hero as seen by the guest: filled from the host's snapshots, shaped like what the HUD reads. */
class RemoteHero implements HudPlayer {
  readonly stats;
  readonly skillIds: readonly string[];
  hp = 1;
  maxHp = 1;
  alive = true;
  energy = { current: 0, max: 100 };
  selectedSkill = 0;
  skillCooldownLeft = 0;
  dodgeCooldownLeft = 0;

  constructor(id: CharacterId) {
    const s = CHARACTERS[id];
    this.stats = s;
    this.skillIds = s.skills;
    this.maxHp = this.hp = s.maxHp;
    this.energy.max = s.maxEnergy;
  }

  get selectedSkillMove(): { energyCost: number } {
    return getMove(this.skillIds[this.selectedSkill] ?? this.skillIds[0]);
  }

  read(row: unknown[]): void {
    this.hp = Number(row[1]);
    this.maxHp = Number(row[2]);
    this.energy.current = Number(row[3]);
    this.selectedSkill = Number(row[4]);
    this.skillCooldownLeft = Number(row[5]);
    this.dodgeCooldownLeft = Number(row[6]);
    this.alive = row[7] === 1;
  }
}

/**
 * Online co-op, guest side. Nothing is simulated here: the host's picture is rebuilt from snapshots
 * (see net/Mirror.ts) and this player's inputs are sent to the host. Background, weather and HUD are local.
 */
export class CoopGuestScene extends Phaser.Scene implements HudSource {
  private d!: CoopGuestData;
  private net = CoopNet.get();
  private offs: Array<() => void> = [];
  private mirror!: MirrorGuest;
  private inputSys!: InputSystem;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private floor!: Phaser.GameObjects.TileSprite;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private pausedText!: Phaser.GameObjects.Text;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private camTarget = 0;
  private hostW = GAME_W;
  private gotFirst = false;
  private lastNeedFull = 0;
  private flags = 0;
  private sel = -1;
  private lastSent = { x: 0, y: 0, at: 0 };
  private ended = false;
  // HudSource
  stage!: StageConfig;
  world!: { player: HudPlayer; score: number };
  sm = {
    lives: 3,
    state: 'travel',
    isBossFight: false,
    waveInfo: null as { index: number; total: number; remaining: number } | null,
    bosses: [] as HudBoss[],
  };
  private me!: RemoteHero;
  private mate!: RemoteHero;

  constructor() {
    super('CoopGuestScene');
  }

  init(d: CoopGuestData): void {
    this.d = d;
    this.offs = [];
    this.gotFirst = false;
    this.ended = false;
    this.flags = 0;
    this.sel = -1;
    this.weather = null;
  }

  preload(): void {
    prepareStageSprites(this, getStage(this.d.stageId));
    const t = this.add.text(GAME_W / 2, GAME_H / 2, 'Đang tải…', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => t.destroy());
    if (!this.load.list.size) t.destroy();
  }

  create(): void {
    createSpriteAnims(this);
    this.stage = getStage(this.d.stageId);
    this.me = new RemoteHero(this.d.guestChar);
    this.mate = new RemoteHero(this.d.hostChar);
    this.world = { player: this.me, score: 0 };
    const bg = paintBackground(this, this.stage.theme);
    this.far = this.add.tileSprite(0, 0, GAME_W, GAME_H, bg.far).setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.mid = this.add.tileSprite(0, 0, GAME_W, FLOOR_TOP, bg.mid).setOrigin(0).setScrollFactor(0).setDepth(-19);
    this.floor = this.add.tileSprite(0, FLOOR_TOP - 40, GAME_W, GAME_H - FLOOR_TOP + 40, bg.floor).setOrigin(0).setScrollFactor(0).setDepth(-18);
    if (this.stage.rain) this.makeWeather('fx-rain', true);
    if (this.stage.snow) this.makeWeather('fx-snow', false);
    this.pausedText = this.add
      .text(GAME_W / 2, 300, 'Chủ phòng đang tạm dừng…', { fontFamily: FONT, fontSize: '34px', fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 7, backgroundColor: '#0b1230aa', padding: { x: 18, y: 10 } })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9000)
      .setVisible(false);
    this.flashRect = this.add.rectangle(0, 0, GAME_W, GAME_H, 0xff0000, 0).setOrigin(0).setScrollFactor(0).setDepth(5000);
    this.mirror = new MirrorGuest(this, GAME_W);
    this.inputSys = new InputSystem(this);

    const n = this.net;
    this.offs.push(
      n.on('s', (m) => this.onSnapshot(m)),
      n.on('pause', (m) => this.pausedText.setVisible(!!m.on)),
      n.on('end', (m) => this.onEnd(m)),
      n.on('close', (m) => this.hostLeft(String(m.reason ?? ''))),
      n.on('bye', () => this.hostLeft('Chủ phòng đã rời phòng.')),
    );
    this.scene.launch('HUDScene', { game: this });
    this.scene.bringToTop('HUDScene');
    this.cameras.main.fadeIn(300, 0, 0, 0);
    AudioSystem.get().setDuck(false);
    this.events.once('shutdown', () => this.cleanup());
    n.send({ t: 'ready' });
  }

  // ── HudSource ──
  hudPartner(): HudPlayer {
    return this.mate;
  }

  hudPartnerTag(): string {
    return 'P1';
  }

  hudNote(): string {
    return this.gotFirst ? `🌐 Co-op • ping ${this.net.rtt} ms` : '🌐 Đang đồng bộ với chủ phòng…';
  }

  private hud(): HUDScene | null {
    const h = this.scene.get('HUDScene') as HUDScene | null;
    return h && h.sys.isActive() ? h : null;
  }

  private makeWeather(key: string, rain: boolean): void {
    this.weather = this.add.particles(0, 0, key, {
      x: { min: -100, max: GAME_W + 100 },
      y: -20,
      lifespan: rain ? 900 : 5000,
      speedY: rain ? { min: 700, max: 900 } : { min: 40, max: 90 },
      speedX: rain ? { min: -160, max: -120 } : { min: -30, max: 30 },
      scale: rain ? { min: 0.8, max: 1.2 } : { min: 0.5, max: 1.4 },
      alpha: rain ? 0.6 : 0.85,
      rotate: rain ? 10 : 0,
      quantity: 1,
      frequency: rain ? 14 : 60,
    });
    this.weather.setScrollFactor(0).setDepth(3500);
  }

  private onSnapshot(m: NetMsg): void {
    if (this.ended) return;
    const v = m.v as [number, number];
    this.hostW = v[0];
    this.mirror.hostW = v[0];
    // centre our (maybe wider/narrower) screen on the host's view
    this.camTarget = v[1] + this.hostW / 2 - GAME_W / 2;
    const missing = this.mirror.apply(m.m as Parameters<MirrorGuest['apply']>[0]);
    if (!this.gotFirst) {
      this.gotFirst = true;
      this.cameras.main.scrollX = this.camTarget;
    }
    if (missing && performance.now() - this.lastNeedFull > 1000) {
      this.lastNeedFull = performance.now();
      this.net.send({ t: 'need-full' });
    }
    this.readHud(m.h as Record<string, unknown>);
    const audio = AudioSystem.get();
    for (const e of (m.e as Array<Array<string | number>>) ?? []) {
      if (e[0] === 'a') audio.play(e[1] as Sfx);
      else if (e[0] === 'b') this.hud()?.banner(String(e[1]), String(e[2]), String(e[3]));
      else if (e[0] === 'k' && SaveSystem.get().data.settings.cameraShake) this.cameras.main.shake(Number(e[2]), Number(e[1]) * 0.8);
      else if (e[0] === 'f' && !SaveSystem.get().data.settings.reduceFlash) {
        this.tweens.killTweensOf(this.flashRect);
        this.flashRect.setFillStyle(Number(e[1]), 1).setAlpha(0.25);
        this.tweens.add({ targets: this.flashRect, alpha: 0, duration: Number(e[2]) });
      }
    }
    const mu = Number(m.mu);
    if (mu !== audio.musicIndex) {
      if (mu < 0) audio.stopMusic();
      else audio.playMusic(mu);
    }
  }

  private readHud(h: Record<string, unknown>): void {
    if (!h) return;
    this.world.score = Number(h.s);
    this.sm.lives = Number(h.l);
    this.sm.state = String(h.st);
    this.sm.isBossFight = h.bf === 1;
    const wv = h.wv as number[] | 0;
    this.sm.waveInfo = wv ? { index: wv[0], total: wv[1], remaining: wv[2] } : null;
    this.sm.bosses = ((h.b as unknown[][]) ?? []).map((r) => {
      const cfg = getBoss(String(r[0]));
      return {
        cfg,
        hp: Number(r[1]),
        maxHp: Number(r[2]),
        shieldMul: Number(r[3]),
        curlArmor: r[4] === 1,
        enraged: r[5] === 1,
        phaseIndex: Number(r[6]),
        alive: r[7] === 1,
      };
    });
    const ps = (h.p as unknown[][]) ?? [];
    if (ps[0]) this.mate.read(ps[0]);
    if (ps[1]) this.me.read(ps[1]);
    this.hud()?.setGo(h.go === 1);
  }

  private onEnd(m: NetMsg): void {
    if (this.ended) return;
    this.ended = true;
    const r = (m.r ?? {}) as { victory?: boolean; stageId?: number; total?: number };
    if (r.victory && r.stageId) SaveSystem.get().completeStage(r.stageId, Number(r.total ?? 0));
    this.scene.stop('PauseScene');
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUDScene');
      this.scene.start('CoopLobbyScene', { result: r });
    });
  }

  private hostLeft(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    this.net.leave(false);
    this.scene.stop('HUDScene');
    this.scene.stop('PauseScene');
    this.scene.start('CoopLobbyScene', { error: reason || 'Mất kết nối với chủ phòng.' });
  }

  update(_t: number, dt: number): void {
    if (this.ended) return;
    const input = this.inputSys.poll();
    const closedAt = (this.registry.get('pauseClosedAt') as number | undefined) ?? 0;
    if (input.pause && !this.scene.isActive('PauseScene') && performance.now() - closedAt > 400) {
      // the host keeps playing: just open the menu over the game
      this.scene.launch('PauseScene', { stageId: this.d.stageId, coop: 'guest' });
      this.scene.bringToTop('PauseScene');
    }
    // inputs → host (one-shot buttons are accumulated until sent)
    if (input.attack) this.flags |= IN_FLAGS.attack;
    if (input.skill) this.flags |= IN_FLAGS.skill;
    if (input.dodge) this.flags |= IN_FLAGS.dodge;
    if (input.jump) this.flags |= IN_FLAGS.jump;
    if (input.ultimate) this.flags |= IN_FLAGS.ultimate;
    if (input.cycleSkill) this.flags |= IN_FLAGS.cycleSkill;
    if (input.selectSkill >= 0) this.sel = input.selectSkill;
    const x = Math.round(input.moveX * 10) / 10;
    const y = Math.round(input.moveY * 10) / 10;
    const now = performance.now();
    if (this.flags || this.sel >= 0 || x !== this.lastSent.x || y !== this.lastSent.y || now - this.lastSent.at > 250) {
      this.net.send({ t: 'in', x, y, f: this.flags, s: this.sel });
      this.flags = 0;
      this.sel = -1;
      this.lastSent = { x, y, at: now };
    }
    // picture
    this.mirror.update(dt);
    const cam = this.cameras.main;
    const d = this.camTarget - cam.scrollX;
    cam.scrollX += Math.abs(d) > 300 ? d : d * (1 - Math.exp(-dt / 60));
    const sx = cam.scrollX;
    this.far.tilePositionX = sx * 0.2;
    this.mid.tilePositionX = sx;
    this.floor.tilePositionX = sx;
  }

  private cleanup(): void {
    this.offs.forEach((f) => f());
    this.offs = [];
    this.mirror?.clear();
  }
}
