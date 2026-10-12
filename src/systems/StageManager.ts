import Phaser from 'phaser';
import { getBoss } from '../config/bosses';
import type { Actor } from '../entities/Actor';
import type { Boss } from '../entities/Boss';
import { Npc } from '../entities/Npc';
import type { Pillar } from '../entities/Pillar';
import { FLOOR_BOTTOM, FLOOR_TOP, GAME_W } from '../game/constants';
import type { BossPhase, StageConfig } from '../types/game';
import type { GameWorld } from './GameWorld';
import { HazardSystem } from './HazardSystem';
import { EncounterLatch, WaveTracker } from './WaveTracker';

export interface StageHud {
  banner(title: string, sub?: string, color?: string): void;
  setGo(on: boolean): void;
}

export interface StageCallbacks {
  onClear(): void;
  onGameOver(): void;
}

export type FlowState = 'travel' | 'wave' | 'bossIntro' | 'boss' | 'victory' | 'dead' | 'gameover';

const ARENA_STEP = 1700;
const FIRST_ARENA = 320;
const REST_LEN = 1500;

/**
 * Stage flow (GDD §6.3/§9): travel → locked wave arenas → safe rest area (checkpoint) → boss arena → result.
 * Also owns the camera, lives, stage mechanics (pillars, heaters, rescue NPCs) and hazards.
 */
export class StageManager {
  state: FlowState = 'travel';
  waveIndex = 0;
  tracker: WaveTracker | null = null;
  lives = 3;
  checkpointReached = false;
  readonly arenas: number[];
  readonly restX: number;
  readonly bossX: number;
  readonly hazards: HazardSystem;
  bosses: Boss[] = [];
  private minScroll = 0;
  private spawnCooldown = 0;
  private fromTracker = false;
  private latch = new EncounterLatch();
  private timers: Array<{ at: number; fn: () => void }> = [];
  private restDone = false;
  private bossIntroAt = 0;
  private healTick = 0;
  private bossShieldPillars = 0;

  constructor(
    private scene: Phaser.Scene,
    private world: GameWorld,
    readonly stage: StageConfig,
    private hud: StageHud,
    private cb: StageCallbacks,
    startAtCheckpoint: boolean,
  ) {
    this.arenas = stage.waves.map((_, i) => FIRST_ARENA + i * ARENA_STEP);
    this.restX = FIRST_ARENA + stage.waves.length * ARENA_STEP;
    this.bossX = this.restX + REST_LEN;
    world.stageWidth = this.bossX + GAME_W;
    this.hazards = new HazardSystem(world, stage.hazards, world.stageWidth);
    world.setEvents({
      enemyDefeated: (e) => this.onEnemyDefeated(e),
      bossDefeated: (b) => this.onBossDefeated(b),
      bossPhase: (b, p, i) => this.onBossPhase(b, p, i),
      playerDefeated: () => this.onPlayerDefeated(),
    });
    world.onSpawnHook = () => {
      if (!this.fromTracker && this.state === 'wave') this.tracker?.addExtra();
    };
    if (startAtCheckpoint) {
      this.waveIndex = stage.waves.length;
      this.checkpointReached = true;
    }
    if (stage.rescueNpcs && !startAtCheckpoint) {
      const xs = [this.arenas[0] + 1450, this.arenas[1] + 1450, this.restX + 500];
      for (let i = 0; i < stage.rescueNpcs; i++) {
        const npc = new Npc(world, xs[i % xs.length], Phaser.Math.Between(FLOOR_TOP + 40, FLOOR_BOTTOM - 40), i, () => {
          world.stats.rescued++;
          world.addScore(500);
        });
        world.npcs.push(npc);
      }
    }
  }

  get playerStartX(): number {
    return this.checkpointReached ? this.restX + 160 : 200;
  }

  init(): void {
    const cam = this.world.cam;
    cam.scrollX = Math.max(0, this.playerStartX - 300);
    this.minScroll = cam.scrollX;
    this.hazards.active = !this.checkpointReached;
    if (this.checkpointReached) {
      this.restDone = true;
      this.hud.banner('CHECKPOINT', 'Chuẩn bị đối đầu boss!', '#7dff6a');
      this.dropRestPickups();
    } else this.hud.banner(`MÀN ${this.stage.id}`, this.stage.name);
  }

  private after(ms: number, fn: () => void): void {
    this.timers.push({ at: this.world.now + ms, fn });
  }

  get isBossFight(): boolean {
    return this.state === 'boss' || this.state === 'bossIntro';
  }

  get waveInfo(): { index: number; total: number; remaining: number } | null {
    if (this.state !== 'wave' || !this.tracker) return null;
    return { index: this.waveIndex + 1, total: this.stage.waves.length, remaining: this.tracker.remaining };
  }

  update(dt: number): void {
    const w = this.world;
    const p = w.player;
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => w.now >= t.at);
      this.timers = this.timers.filter((t) => w.now < t.at);
      for (const t of due) t.fn();
    }
    this.hazards.update(dt);
    this.updateCamera(dt);

    switch (this.state) {
      case 'travel': {
        if (this.waveIndex < this.arenas.length) {
          const L = this.arenas[this.waveIndex];
          if (p.x > L + 600) this.startWave();
        } else {
          if (!this.restDone && p.x > this.restX + 200) {
            this.restDone = true;
            this.checkpointReached = true;
            this.hazards.active = false;
            this.hud.banner('KHU AN TOÀN', 'Hồi sức trước trận đánh boss — Checkpoint!', '#7dff6a');
            this.dropRestPickups();
          }
          if (p.x > this.bossX + 620) this.startBoss();
        }
        break;
      }
      case 'wave': {
        const t = this.tracker!;
        this.spawnCooldown -= dt;
        if (this.spawnCooldown <= 0 && t.canSpawn() && w.hostiles().length < 12) {
          const type = t.nextSpawn();
          if (type) {
            this.fromTracker = true;
            const e = w.spawnEnemy(type);
            this.fromTracker = false;
            if (!e) t.onEnemyDefeated(); // could not spawn (cap) → do not soft-lock
          }
          this.spawnCooldown = 420;
        }
        if (t.isComplete) this.endWave();
        break;
      }
      case 'bossIntro':
        if (w.now > this.bossIntroAt) {
          this.state = 'boss';
          this.hazards.active = true;
        }
        break;
      case 'boss':
        this.updateBossMechanics(dt);
        break;
      default:
        break;
    }
  }

  private updateCamera(dt: number): void {
    const w = this.world;
    const cam = w.cam;
    const p = w.player;
    let target: number;
    if (w.lock) target = w.lock.left;
    else target = Phaser.Math.Clamp(p.x - 520, this.minScroll, w.stageWidth - GAME_W);
    const k = Math.min(1, dt * 0.007);
    cam.scrollX += (target - cam.scrollX) * k;
    if (!w.lock) this.minScroll = Math.max(this.minScroll, Math.min(cam.scrollX, p.x - GAME_W + 200));
    cam.scrollY = 0;
  }

  private startWave(): void {
    const L = this.arenas[this.waveIndex];
    this.world.lock = { left: L, right: L + GAME_W };
    this.tracker = new WaveTracker(this.stage.waves[this.waveIndex], 4);
    this.state = 'wave';
    this.spawnCooldown = 500;
    this.hazards.active = true;
    this.hud.setGo(false);
    this.hud.banner(`ĐỢT ${this.waveIndex + 1}/${this.stage.waves.length}`, 'Đánh bại tất cả kẻ địch!');
  }

  private endWave(): void {
    this.world.lock = null;
    this.state = 'travel';
    this.waveIndex++;
    this.tracker = null;
    this.hud.setGo(true);
    this.after(2600, () => this.hud.setGo(false));
    if (this.waveIndex >= this.stage.waves.length) this.hud.banner('DỌN SẠCH!', 'Tiến về phía trước →', '#7dff6a');
    else this.hud.banner('TIẾN LÊN!', '', '#ffd23f');
  }

  private dropRestPickups(): void {
    const w = this.world;
    const x = this.checkpointReached && w.player.x > this.restX ? w.player.x + 260 : this.restX + 520;
    w.dropPickup('health', x, 560);
    w.dropPickup('health', x + 60, 620);
    w.dropPickup('energy', x + 120, 560);
  }

  private startBoss(): void {
    const w = this.world;
    const L = this.bossX;
    w.lock = { left: L, right: L + GAME_W };
    this.state = 'bossIntro';
    this.bossIntroAt = w.now + 1800;
    this.hazards.active = false;
    this.checkpointReached = true;
    const cfg = getBoss(this.stage.bossId);
    const b1 = w.spawnBoss(cfg, L + GAME_W + 120, 580);
    this.bosses = [b1];
    if (this.stage.secondBossId) {
      const b2 = w.spawnBoss(getBoss(this.stage.secondBossId), L + GAME_W + 220, 500);
      this.bosses.push(b2);
    }
    w.audio.play('roar');
    this.hud.banner(`BOSS: ${this.bosses.map((b) => b.cfg.name).join(' & ')}`, this.stage.objectives[0], '#ff5a5a');
    w.audio.playMusic(this.stage.music);
    // stage mechanics
    const pl = this.stage.pillars;
    if (pl && this.stage.theme === 'factory') {
      this.bossShieldPillars = pl.count;
      b1.shieldMul = 0.35;
      this.spawnPillars(pl.count, pl.hp, 0x9dff3b, pl.label, () => {
        this.bossShieldPillars--;
        if (this.bossShieldPillars <= 0) {
          b1.shieldMul = 1;
          this.hud.banner('GIÁP BOSS ĐÃ VỠ!', 'Tấn công toàn lực!', '#9dff3b');
        } else this.hud.banner('Phá được 1 trụ!', `Còn ${this.bossShieldPillars} trụ`, '#9dff3b');
      });
      this.after(2200, () => this.hud.banner('Phá trụ năng lượng!', 'Boss đang được bảo vệ bởi giáp năng lượng', '#9dff3b'));
    }
    if (pl && this.stage.theme === 'ice') {
      this.spawnPillars(pl.count, pl.hp, 0x9be7ff, pl.label, () => {
        w.freezeReduction *= 0.65;
        this.hud.banner('Trụ băng vỡ!', 'Thời gian đóng băng giảm', '#9be7ff');
      });
      for (const [hx, hy] of [[L + 220, 620], [L + 1060, 520]]) {
        w.heaters.push({ x: hx, y: hy });
        const glow = this.scene.add.image(hx, hy - 10, 'fx-glow').setTint(0xff8a3d).setScale(4.5, 2.4).setAlpha(0.35).setDepth(-3).setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({ targets: glow, alpha: 0.55, yoyo: true, repeat: -1, duration: 700 });
        this.scene.add.image(hx, hy, 'prop-heater').setScale(0.6).setOrigin(0.5, 0.9).setDepth(hy);
      }
    }
  }

  private spawnPillars(n: number, hp: number, color: number, label: string, onBroken: (p: Pillar) => void): void {
    const L = this.bossX;
    const spots = [
      [L + 260, 520],
      [L + 1020, 650],
      [L + 640, 480],
    ];
    for (let i = 0; i < n; i++) {
      const [x, y] = spots[i % spots.length];
      this.world.spawnPillar(x, y, hp, color, label, onBroken);
    }
  }

  private updateBossMechanics(dt: number): void {
    const w = this.world;
    // Tiến Sĩ Điên: heals while clones live unless you keep hitting the real one
    for (const b of this.bosses) {
      if (!b.alive || b.cfg.id !== 'madDoctor') continue;
      const clones = w.enemies.some((e) => e.alive && e.cfg.id === 'clone');
      if (clones && w.now - b.lastHitAt > 2500) {
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.012 * (dt / 1000));
        this.healTick += dt;
        if (this.healTick > 900) {
          this.healTick = 0;
          w.fx.text(b.x, b.y - b.height - 10, '+ HỒI PHỤC', '#7dff6a', 22);
        }
      }
    }
  }

  private onBossPhase(b: Boss, phase: BossPhase, index: number): void {
    if (phase.message) this.hud.banner(phase.message.split('!')[0] + '!', `${b.cfg.name} — Giai đoạn ${index + 1}`, '#ff5a5a');
    if (b.cfg.id === 'darkShadow' && index === 2 && this.stage.pillars) {
      const pl = this.stage.pillars;
      this.bossShieldPillars = pl.count;
      b.shieldMul = 0.25;
      this.spawnPillars(pl.count, pl.hp, 0xd07bff, pl.label, () => {
        this.bossShieldPillars--;
        if (b.alive) {
          b.hp = Math.max(1, b.hp - Math.round(b.maxHp * 0.06));
          this.world.fx.text(b.x, b.y - b.height, '-6% LÕI', '#d07bff', 28);
        }
        if (this.bossShieldPillars <= 0) {
          b.shieldMul = 1;
          this.hud.banner('LÕI HỖN MANG SỤP ĐỔ!', 'Kết liễu Hắc Ảnh!', '#d07bff');
        }
      });
    }
  }

  private onEnemyDefeated(_e: Actor): void {
    if (this.state === 'wave' && this.tracker) this.tracker.onEnemyDefeated();
  }

  private onBossDefeated(b: Boss): void {
    const alive = this.bosses.filter((x) => x.alive);
    if (alive.length > 0) {
      for (const o of alive) o.enrage();
      this.hud.banner(`${b.cfg.name} đã gục!`, `${alive[0].cfg.name} nổi giận!`, '#ffd23f');
      return;
    }
    if (!this.latch.fire()) return;
    const w = this.world;
    this.state = 'victory';
    this.hazards.active = false;
    w.telegraph.clear();
    w.combat.clear();
    w.timeScale = 0.3;
    w.audio.stopMusic();
    w.audio.play('victory');
    this.hud.banner('CHIẾN THẮNG!', this.stage.reward, '#ffd23f');
    for (const e of w.enemies) if (e.alive) e.receiveHit({ attackerId: -1, attackerX: e.x - 1, dirX: 1, damage: 9999, knockback: 200, launch: true, stunMs: 0, slowMs: 0, grab: false, breaksArmor: true, heavy: true, color: 0xffffff });
    for (const pl of w.pillars) pl.destroy();
    this.after(300, () => {
      w.timeScale = 1;
      w.player.celebrate();
    });
    this.after(2600, () => this.cb.onClear());
  }

  private onPlayerDefeated(): void {
    const w = this.world;
    this.lives--;
    this.state = this.lives > 0 ? this.state : 'gameover';
    if (this.lives > 0) {
      this.hud.banner(`Còn ${this.lives} mạng`, 'Đứng dậy nào!', '#ff8fa3');
      this.after(1500, () => {
        w.player.revive();
        for (const e of w.hostiles()) {
          if (Math.abs(e.x - w.player.x) < 200 && !e.isBoss) e.vx = (e.x > w.player.x ? 1 : -1) * 400;
        }
      });
    } else {
      this.hazards.active = false;
      this.after(1700, () => this.cb.onGameOver());
    }
  }

  destroy(): void {
    this.hazards.destroy();
    this.timers = [];
  }
}
