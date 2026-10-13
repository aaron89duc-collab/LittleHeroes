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
import type { HUDScene } from './HUDScene';

export interface GameSceneData {
  stageId: number;
  hard?: boolean;
  checkpoint?: boolean;
  checkpointScore?: number;
}

/** Thin scene: wires world, stage flow, input, background and HUD. Combat/AI live in their own modules. */
export class GameScene extends Phaser.Scene {
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

  constructor() {
    super('GameScene');
  }

  init(d: GameSceneData): void {
    this.d = d;
    this.ended = false;
    this.weather = null;
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
    const losses = (this.registry.get(`losses-${this.stage.id}`) as number | undefined) ?? 0;
    this.world.assistMode = !!this.registry.get(`assist-${this.stage.id}`) && losses >= 3;
    const hud = {
      banner: (t: string, s?: string, c?: string) => this.hud()?.banner(t, s, c),
      setGo: (on: boolean) => this.hud()?.setGo(on),
    };
    this.sm = new StageManager(this, this.world, this.stage, hud, { onClear: () => this.onClear(), onGameOver: () => this.onGameOver() }, !!this.d.checkpoint);
    this.world.createPlayer(save.data.selectedCharacter, this.sm.playerStartX, 590);
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

    this.game.events.on(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.events.once('shutdown', () => this.cleanup());
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
    this.scene.launch('PauseScene', { stageId: this.stage.id, hard: this.d.hard });
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
    this.world.update(dt, input);
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
  }

  private cleanup(): void {
    this.game.events.off(Phaser.Core.Events.BLUR, this.autoPause, this);
    this.sm?.destroy();
    this.world?.destroy();
  }
}
