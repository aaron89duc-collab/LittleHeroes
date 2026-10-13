import Phaser from 'phaser';
import { HEADS } from '../art/registry';
import type { CharacterId, MoveConfig } from '../types/game';
import type { ActorView } from './ActorView';
import type { Pose } from './Poses';
import { Rig } from './Rig';

/**
 * Hand-drawn 16-frame hero sheet (4×4, row-major), e.g. public/assets/characters/dau-dau/sheet.png:
 *  0 idle · 1 idle blink · 2-3 walk · 4-5 run · 6 jump · 7 crouch
 *  8 guard · 9 punch · 10 knee/chamber · 11 high kick · 12 hurt · 13 knocked back · 14 KO · 15 victory
 */
export const F = {
  IDLE: 0, BLINK: 1, WALK1: 2, WALK2: 3, RUN1: 4, RUN2: 5, JUMP: 6, CROUCH: 7,
  GUARD: 8, PUNCH: 9, KNEE: 10, KICK: 11, HURT: 12, KNOCK: 13, KO: 14, WIN: 15,
} as const;

export interface HeroSheetMeta {
  frameW: number;
  frameH: number;
  footY: number;
  bodyH: number;
  /** Sheets with their own frame order map each slot (F.*) to a frame index. */
  slots?: Partial<Record<keyof typeof F, number>>;
  /** Optional walk cycle / victory loop frame lists (frame indices in this sheet). */
  walk?: number[];
  win?: number[];
}

/** Heroes that ship a hand-drawn sheet (see tools/import_hero_sheet.py, tools/import_labeled_sheet.py). */
export const HERO_SHEETS: Partial<Record<CharacterId, string>> = {
  'dau-dau': 'assets/characters/dau-dau',
  'shu-shu': 'assets/characters/shu-shu',
  bap: 'assets/characters/bap',
};

export function heroSheetKey(id: CharacterId): string {
  return `hero-${id}-sheet`;
}

export function loadHeroSheets(scene: Phaser.Scene): void {
  for (const [id, dir] of Object.entries(HERO_SHEETS)) {
    scene.load.json(`${heroSheetKey(id as CharacterId)}-meta`, `${dir}/sheet.json`);
    scene.load.image(`${heroSheetKey(id as CharacterId)}-img`, `${dir}/sheet.png`);
  }
}

/** Slice the loaded sheet images into a 16-frame texture once metadata is available. */
export function registerHeroSheets(scene: Phaser.Scene): void {
  for (const id of Object.keys(HERO_SHEETS) as CharacterId[]) {
    const key = heroSheetKey(id);
    const meta = scene.cache.json.get(`${key}-meta`) as HeroSheetMeta | undefined;
    const imgKey = `${key}-img`;
    if (!meta || !scene.textures.exists(imgKey) || scene.textures.exists(key)) continue;
    const src = scene.textures.get(imgKey).getSourceImage() as HTMLImageElement;
    scene.textures.addSpriteSheet(key, src, { frameWidth: meta.frameW, frameHeight: meta.frameH });
    scene.registry.set(`${key}-meta`, meta);
  }
}

interface Key {
  t: number;
  f: number;
}

export type HeroViewT = ActorView & Phaser.GameObjects.Container;
type HeroView = HeroViewT;

/** Frame-by-frame hero body driven through the same ActorView contract as the puppet Rig. */
export class HeroSpriteView extends Phaser.GameObjects.Container implements ActorView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private keys: Key[] = [];
  private loop = false;
  private loopLen = 1;
  private time = 0;
  private animName = 'idle';
  private facingSign: 1 | -1 = 1;
  private spin: [number, number] | null = null;
  private flashMs = 0;
  private wobble = 0;
  private tint: number | null = null;
  private dead = false;
  private lie = 0;
  private baseScale: number;
  /** Slot → frame index for this sheet. */
  private f: Record<keyof typeof F, number>;

  constructor(scene: Phaser.Scene, readonly key: string, private meta: HeroSheetMeta, scale: number) {
    super(scene, 0, 0);
    this.baseScale = scale;
    this.f = { ...F, ...(meta.slots ?? {}) };
    this.sprite = scene.add.sprite(0, 0, key, this.f.IDLE).setOrigin(0.5, meta.footY);
    this.add(this.sprite);
    this.setScale(scale);
    this.play('idle', true);
    scene.add.existing(this);
  }

  get currentAnim(): string {
    return this.animName;
  }

  get animDone(): boolean {
    return !this.loop && this.time >= this.loopLen;
  }

  get visualHeight(): number {
    return this.meta.bodyH * this.baseScale;
  }

  setFacing(f: 1 | -1): void {
    this.facingSign = f;
  }

  setBaseScale(s: number): void {
    this.baseScale = s;
    this.setScale(s);
  }

  private seq(name: string, keys: Key[], loop: boolean, length?: number): void {
    this.animName = name;
    this.keys = keys;
    this.loop = loop;
    this.time = 0;
    this.spin = null;
    this.loopLen = length ?? Math.max(1, keys[keys.length - 1].t + 1);
    this.sprite.setFrame(keys[0].f);
  }

  private still(name: string, f: number): void {
    this.seq(name, [{ t: 0, f }], false, 1);
  }

  play(name: string, force = false): void {
    if (force) this.dead = false;
    if (this.dead) return;
    if (!force && this.animName === name) return;
    if (name === 'walk') {
      const cyc = this.meta.walk ?? [this.f.WALK1, this.f.RUN1, this.f.WALK2, this.f.RUN2];
      const step = cyc.length <= 2 ? 170 : 130;
      this.seq('walk', cyc.map((f, i) => ({ t: i * step, f })), true, cyc.length * step);
    } else {
      this.seq('idle', [
        { t: 0, f: this.f.IDLE },
        { t: 2600, f: this.f.BLINK },
        { t: 2760, f: this.f.IDLE },
      ], true, 2900);
    }
  }

  hold(name: string, _pose: Pose, _blend?: number): void {
    if (this.dead || this.animName === name) return;
    const map: Record<string, number> = {
      hurt: this.f.HURT,
      scared: this.f.HURT,
      down: this.f.KNOCK,
      getup: this.f.CROUCH,
      jumpUp: this.f.JUMP,
      jumpFall: this.f.JUMP,
      dodge: this.f.CROUCH,
      crouch: this.f.CROUCH,
      telegraph: this.f.GUARD,
      block: this.f.GUARD,
      frozen: this.f.GUARD,
      charge: this.f.RUN1,
      victory: this.f.WIN,
      v: this.f.WIN,
      cheer: this.f.WIN,
      roar: this.f.WIN,
    };
    const win = this.meta.win;
    if (win && win.length > 1 && map[name] === this.f.WIN) {
      this.seq(name, win.map((f, i) => ({ t: i * 420, f })), true, win.length * 420);
      return;
    }
    this.still(name, map[name] ?? this.f.GUARD);
  }

  /** Windup frame until each hit, strike frame through its active window, guard during recovery. */
  playMove(m: MoveConfig, speed = 1): void {
    if (this.dead) return;
    const kick = ['kickSide', 'lowKick', 'sweep', 'jumpKick', 'multiKick', 'spinKick'].includes(m.anim);
    const keys: Key[] = [{ t: 0, f: m.anim === 'groundPound' ? this.f.JUMP : kick ? this.f.KNEE : this.f.GUARD }];
    let end = 0;
    m.hits.forEach((h, i) => {
      const at = h.at / speed;
      const act = h.activeMs / speed;
      const useKick = kick || (m.anim === 'ultimate' && i % 2 === 1) || (m.anim === 'ultimate' && i === m.hits.length - 1);
      const wind = useKick ? this.f.KNEE : this.f.GUARD;
      const strike = m.anim === 'groundPound' ? this.f.CROUCH : useKick ? this.f.KICK : this.f.PUNCH;
      keys.push({ t: Math.max(keys[keys.length - 1].t + 1, at - Math.min(90, at * 0.6)), f: wind });
      keys.push({ t: at, f: strike });
      end = Math.max(end, at + act);
    });
    keys.push({ t: end, f: this.f.GUARD });
    keys.sort((a, b) => a.t - b.t);
    this.seq(m.anim, keys, false, end + m.recoveryMs / speed);
    if (m.anim === 'spinKick') this.spin = [m.hits[0].at / speed, end];
  }

  playAttack(name: string, telegraphMs: number, activeMs: number, recoveryMs: number): void {
    if (this.dead) return;
    const kick = name.toLowerCase().includes('kick');
    this.seq(name, [
      { t: 0, f: kick ? this.f.KNEE : this.f.GUARD },
      { t: telegraphMs, f: kick ? this.f.KICK : this.f.PUNCH },
      { t: telegraphMs + activeMs, f: this.f.GUARD },
    ], false, telegraphMs + activeMs + recoveryMs);
  }

  setDead(): void {
    this.dead = true;
    this.animName = 'dead';
    this.sprite.setFrame(this.f.KNOCK);
  }

  setLie(deg: number): void {
    this.lie = deg;
    if (this.animName === 'down' || this.dead) this.sprite.setFrame(deg >= 60 ? this.f.KO : this.f.KNOCK);
  }

  flash(ms = 90): void {
    this.flashMs = ms;
    this.sprite.setTintFill(0xffffff);
  }

  setTintAll(color: number | null): void {
    this.tint = color;
    this.applyTint();
  }

  private applyTint(): void {
    if (this.tint === null) this.sprite.clearTint();
    else this.sprite.setTint(this.tint);
  }

  setWobble(v: number): void {
    this.wobble = v;
  }

  update(dt: number): void {
    this.time += dt;
    let t = this.time;
    if (this.loop) t %= this.loopLen;
    if (!this.dead && !(this.animName === 'down')) {
      let f = this.keys[0]?.f ?? this.f.IDLE;
      for (const k of this.keys) if (k.t <= t) f = k.f;
      if (!this.loop && this.time >= this.loopLen && this.keys.length > 1) f = this.f.GUARD;
      this.sprite.setFrame(f);
    } else if (this.dead) {
      this.sprite.setFrame(this.lie >= 60 || this.time > 400 ? this.f.KO : this.f.KNOCK);
    }
    let flip = 1;
    if (this.spin && this.time >= this.spin[0] && this.time <= this.spin[1]) flip = Math.floor((this.time - this.spin[0]) / 70) % 2 ? -1 : 1;
    this.sprite.setFlipX(this.facingSign * flip === -1);
    this.sprite.x = this.wobble ? Math.sin(this.scene.time.now / 25) * this.wobble : 0;
    if (this.flashMs > 0) {
      this.flashMs -= dt;
      if (this.flashMs <= 0) this.applyTint();
    }
  }
}

/** Rig scale 1.15 ≈ 185 px tall hero; sprite heroes are scaled to the same height. */
export function createHeroView(scene: Phaser.Scene, id: CharacterId, rigScale: number): HeroView {
  const key = heroSheetKey(id);
  const meta = scene.registry.get(`${key}-meta`) as HeroSheetMeta | undefined;
  if (meta && scene.textures.exists(key)) {
    const s = ((rigScale / 1.15) * 150 * (id === 'bap' ? 1.06 : 1)) / meta.bodyH;
    return new HeroSpriteView(scene, key, meta, s);
  }
  const head = HEADS[`head-${id}`];
  return new Rig(scene, {
    partKey: `rig-${id}`,
    headKey: head.key,
    headHeight: head.height,
    headAnchorY: head.anchorY,
    headOffsetX: head.offsetX,
    scale: rigScale * (id === 'bap' ? 1.06 : 1),
    tailKey: id === 'shu-shu' ? 'tail-shu-shu' : undefined,
    bulk: id === 'bap' ? 1.12 : 1,
  });
}
