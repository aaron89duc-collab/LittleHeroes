import Phaser from 'phaser';
import { paintBackground } from '../art/registry';
import { getStage, STAGE_COUNT } from '../config/stages';
import { FLOOR_TOP, FONT, GAME_H, GAME_W } from '../game/constants';
import { AudioSystem } from '../systems/AudioSystem';
import { GameWorld } from '../systems/GameWorld';
import { InputSystem } from '../systems/InputSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { StageManager } from '../systems/StageManager';
import { prepareStageSprites } from '../systems/StageAssets';
import { createSpriteAnims } from '../rig/SpriteView';
import type { StageConfig } from '../types/game';
import { CoopHost, type CoopStartData } from '../net/CoopHost';
import type { Player } from '../entities/Player';
import type { HUDScene, HudPlayer, HudSource } from './HUDScene';

export interface GameSceneData {
  stageId: number;
  hard?: boolean;
  checkpoint?: boolean;
  checkpointScore?: number;
  /** online co-op: this browser is the host and simulates both heroes */
  coop?: CoopStartData;
}

/** Thin scene: wires world, stage flow, input, background and HUD. Combat/AI live in their own modules. */
export class GameScene extends Phaser.Scene implements HudSource {
  world!: GameWorld;
  sm!: StageManager;
  stage!: StageConfig;
  private inputSys!: InputSystem;
  private d!: GameSceneData;
  private far!: Phaser.GameObjects.TileSprite;
  private mid!: Phaser.GameObjects.TileSprite;
  private floor!: Phaser.GameObjects.TileSprite;
  private comboText!: Phaser.GameObjects.Text;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private ended = false;
  coopHost: CoopHost | null = null;
  private tags: Phaser.GameObjects.Text[] = [];
  private combo2: Phaser.GameObjects.Text | null = null;
  private waitText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('GameScene');
  }

  init(d: GameSceneData): void {
    this.d = d;
    this.ended = false;
    this.weather = null;
    this.coopHost = null;
    this.tags = [];
    this.combo2 = null;
    this.waitText = null;
  }

  preload(): void {
    // usually already fetched while the stage briefing was on screen
    prepareStageSprites(this, getStage(this.d.stageId));
    const t = this.add.text(GAME_W / 2, GAME_H / 2, 'Đang tải…', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f' }).setOrigin(0.5);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => t.destroy());
    if (!this.load.list.size) t.destroy();
  }

  create(): void {
    createSpriteAnims(this);
    const base = getStage(this.d.stageId);
    this.stage = this.d.hard ? { ...base, enemyHpMul: base.enemyHpMul * 1.5, enemyDmgMul: base.enemyDmgMul * 1.4 } : base;
    const save = SaveSystem.get();
    const settings = save.data.settings;
    const bg = paintBackground(this, this.stage.theme);
    this.far = this.add.tileSprite(0, 0, GAME_W, GAME_H, bg.far).setOrigin(0).setScrollFactor(0).setDepth(-20);
    this.mid = this.add.tileSprite(0, 0, GAME_W, FLOOR_TOP, bg.mid).setOrigin(0).setScrollFactor(0).setDepth(-19);
    this.floor = this.add.tileSprite(0, FLOOR_TOP - 40, GAME_W, GAME_H - FLOOR_TOP + 40, bg.floor).setOrigin(0).setScrollFactor(0).setDepth(-18);

    this.world = new GameWorld(this, this.stage, settings);
    const coop = this.d.coop;
    if (coop) {
      // the play field is the narrower of the two screens so both players always see everything
      this.world.viewW = Math.min(GAME_W, Math.max(960, coop.guestW));
      this.world.combat.maxTokens = 3;
    }
    const losses = (this.registry.get(`losses-${this.stage.id}`) as number | undefined) ?? 0;
    this.world.assistMode = !!this.registry.get(`assist-${this.stage.id}`) && losses >= 3;
    const hud = {
      banner: (t: string, s?: string, c?: string) => {
        this.hud()?.banner(t, s, c);
        this.coopHost?.banner(t, s, c);
      },
      setGo: (on: boolean) => {
        this.hud()?.setGo(on);
        this.coopHost?.setGo(on);
      },
    };
    this.sm = new StageManager(this, this.world, this.stage, hud, { onClear: () => this.onClear(), onGameOver: () => this.onGameOver() }, !!this.d.checkpoint);
    this.world.createPlayer(coop ? coop.hostChar : save.data.selectedCharacter, this.sm.playerStartX, coop ? 560 : 590);
    if (coop) {
      this.world.createPlayer(coop.guestChar, this.sm.playerStartX - 40, 650);
      this.coopHost = new CoopHost(this, this.world, () => this.sm, () => this.onPartnerLeft());
      // P1 / P2 name tags + a combo counter for the partner (mirrored to the guest like everything else)
      this.tags = this.world.players.map((p, i) =>
        this.add
          .text(p.x, p.y - 200, i === 0 ? 'P1' : 'P2', { fontFamily: FONT, fontSize: '18px', fontStyle: '800', color: i === 0 ? '#ffd23f' : '#3fd5ff', stroke: '#0b1230', strokeThickness: 5 })
          .setOrigin(0.5)
          .setDepth(3900),
      );
      this.combo2 = this.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: '#3fd5ff', stroke: '#0b1230', strokeThickness: 6 })
        .setOrigin(0.5)
        .setDepth(4000)
        .setVisible(false);
      this.waitText = this.add
        .text(GAME_W / 2, 300, 'Đang chờ bạn đồng hành tải màn chơi…', { fontFamily: FONT, fontSize: '28px', fontStyle: '800', color: '#ffffff', stroke: '#0b1230', strokeThickness: 6 })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(6000)
        .setData('noMirror', true);
    }
    if (this.d.checkpoint && this.d.checkpointScore) this.world.score = this.d.checkpointScore;
    this.inputSys = new InputSystem(this);

    this.comboText = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '30px', fontStyle: '800', color: '#ffd23f', stroke: '#3a0a0a', strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(4000);

    if (this.stage.rain) this.makeWeather('fx-rain', true);
    if (this.stage.snow) this.makeWeather('fx-snow', false);

    this.scene.launch('HUDScene', { game: this });
    this.scene.bringToTop('HUDScene');
    // HUD must exist before the first banner
    this.time.delayedCall(30, () => this.sm.init());
    this.cameras.main.fadeIn(300, 0, 0, 0);
    AudioSystem.get().setDuck(false);
    AudioSystem.get().playMusic(this.stage.music);

    // co-op host: clicking another window must not stop the partner's game; hiding the tab does pause it
    this.game.events.on(coop ? Phaser.Core.Events.HIDDEN : Phaser.Core.Events.BLUR, this.autoPause, this);
    this.events.once('shutdown', () => this.cleanup());
    this.events.on('resume', () => this.coopHost?.paused(false));
  }

  // ── HudSource ──
  hudPartner(): HudPlayer | null {
    return this.world.players[1] ?? null;
  }

  hudPartnerTag(): string {
    return 'P2';
  }

  hudNote(): string {
    const c = this.coopHost;
    if (!c) return '';
    if (c.partnerGone) return '🌐 Bạn đồng hành đã rời phòng';
    return `🌐 Co-op • ping ${c.net.rtt} ms`;
  }

  private onPartnerLeft(): void {
    const p2 = this.world.players[1] as Player | undefined;
    if (p2) this.world.removePlayer(p2);
    this.tags[1]?.destroy();
    this.combo2?.destroy();
    this.combo2 = null;
    this.waitText?.destroy();
    this.waitText = null;
    this.hud()?.banner('Bạn đồng hành đã rời phòng', 'Bạn tiếp tục chiến đấu một mình', '#3fd5ff');
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

  private autoPause(): void {
    if (this.scene.isActive() && !this.ended) this.pauseGame();
  }

  pauseGame(): void {
    if (this.ended || this.sm.state === 'victory' || this.sm.state === 'gameover') return;
    AudioSystem.get().setDuck(true);
    this.scene.pause();
    this.coopHost?.paused(true);
    this.scene.launch('PauseScene', { stageId: this.stage.id, hard: this.d.hard, coop: this.coopHost ? 'host' : undefined });
    this.scene.bringToTop('PauseScene');
  }

  private onClear(): void {
    if (this.ended) return;
    this.ended = true;
    const save = SaveSystem.get();
    const w = this.world;
    const timeBonus = Math.max(0, Math.round(3000 - w.stats.timeMs / 200));
    const total = w.score + this.stage.rewardScore + timeBonus;
    save.completeStage(this.stage.id, total);
    this.registry.set(`losses-${this.stage.id}`, 0);
    const result = {
      victory: true,
      stageId: this.stage.id,
      hard: this.d.hard,
      score: w.score,
      reward: this.stage.rewardScore,
      timeBonus,
      total,
      stats: { ...w.stats },
      lastStage: this.stage.id === STAGE_COUNT,
    };
    if (this.coopHost && !this.coopHost.partnerGone) {
      this.coopHost.end(result);
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.stop('HUDScene');
        this.scene.start('CoopLobbyScene', { result });
      });
      return;
    }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HUDScene');
      this.scene.start(this.stage.id === STAGE_COUNT ? 'EndingScene' : 'ResultScene', result);
    });
  }

  private onGameOver(): void {
    if (this.ended) return;
    this.ended = true;
    const key = `losses-${this.stage.id}`;
    const losses = ((this.registry.get(key) as number | undefined) ?? 0) + 1;
    this.registry.set(key, losses);
    this.scene.stop('HUDScene');
    if (this.coopHost && !this.coopHost.partnerGone) {
      const result = { victory: false, stageId: this.stage.id, hard: this.d.hard, score: this.world.score, stats: { ...this.world.stats } };
      this.coopHost.end(result);
      this.scene.start('CoopLobbyScene', { result });
      return;
    }
    this.scene.start('ResultScene', {
      victory: false,
      stageId: this.stage.id,
      hard: this.d.hard,
      score: this.world.score,
      checkpoint: this.sm.checkpointReached,
      checkpointScore: this.world.score,
      losses,
      stats: { ...this.world.stats },
    });
  }

  update(_t: number, dt: number): void {
    if (this.ended && this.sm.state !== 'victory') return;
    const input = this.inputSys.poll();
    if (input.pause) {
      this.pauseGame();
      return;
    }
    const ch = this.coopHost;
    if (ch && !ch.ready && !ch.partnerGone) {
      // co-op: hold the stage until the partner has loaded it (max 25 s)
      ch.waitedMs += dt;
      if (ch.waitedMs < 25000) return;
      ch.ready = true;
    }
    if (this.waitText) {
      this.waitText.destroy();
      this.waitText = null;
    }
    this.world.update(dt, input, ch?.input2());
    ch?.consume();
    this.sm.update(Math.min(dt, 50));
    const sx = this.cameras.main.scrollX;
    // mid (buildings/props) and floor come from one composed picture: scroll them together so they never split
    this.far.tilePositionX = sx * 0.2;
    this.mid.tilePositionX = sx;
    this.floor.tilePositionX = sx;
    // combo counter near (not over) the hero
    const p = this.world.player;
    const c = p.combo;
    if (c.visible) {
      const cx = Phaser.Math.Clamp(p.x - 110 * p.facing, this.world.camLeft + 90, this.world.camRight - 90);
      if (this.comboText.text !== `${c.hitCount} HIT!`) this.comboText.setText(`${c.hitCount} HIT!`);
      this.comboText.setVisible(true).setPosition(cx, p.y - p.z - 190);
      this.comboText.setScale(1 + Math.min(0.6, c.hitCount * 0.02));
    } else this.comboText.setVisible(false);
    if (this.weather && this.stage.snow) this.weather.frequency = this.world.blizzardOn ? 6 : 60;
    if (ch) {
      this.world.players.forEach((q, i) => this.tags[i]?.setPosition(q.x, q.y - q.z - 178).setVisible(q.alive));
      const p2 = this.world.players[1];
      if (p2 && this.combo2) {
        const c2 = p2.combo;
        this.combo2.setVisible(c2.visible);
        if (c2.visible) {
          if (this.combo2.text !== `${c2.hitCount} HIT!`) this.combo2.setText(`${c2.hitCount} HIT!`);
          this.combo2.setPosition(Phaser.Math.Clamp(p2.x - 110 * p2.facing, this.world.camLeft + 90, this.world.camRight - 90), p2.y - p2.z - 190);
        }
      }
      ch.tick(dt);
    }
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.game.events.off(Phaser.Core.Events.HIDDEN, this.autoPause, this);
    this.coopHost?.destroy();
    this.coopHost = null;
    this.sm?.destroy();
    this.world?.destroy();
  }
}
