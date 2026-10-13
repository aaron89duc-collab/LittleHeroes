import Phaser from 'phaser';
import userAssets from '../config/userAssets.json';
import type { MoveConfig } from '../types/game';
import type { ActorView } from './ActorView';
import type { Pose } from './Poses';

interface SpriteDef {
  frameW: number;
  frameH: number;
  facing: 'left' | 'right';
  footY: number;
  bodyH: number;
  anims: Record<string, { file: string; frames: number }>;
}

export const SPRITES = userAssets.sprites as Record<string, SpriteDef>;

const LOOPING = new Set(['idle', 'walk']);
const PIXEL_ART = new Set(['cyber1', 'cyber2', 'cyber3', 'satyr1', 'satyr2', 'satyr3', 'gorgon1', 'gorgon2', 'gorgon3']);

/** Load every sprite sheet from the user's asset packs (call from a scene's preload). */
export function loadSpriteSheets(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(SPRITES)) {
    for (const [anim, a] of Object.entries(def.anims)) {
      scene.load.spritesheet(`spr-${key}-${anim}`, a.file, { frameWidth: def.frameW, frameHeight: def.frameH });
    }
  }
}

/** Register Phaser animations once the sheets are loaded. */
export function createSpriteAnims(scene: Phaser.Scene): void {
  for (const [key, def] of Object.entries(SPRITES)) {
    for (const [anim, a] of Object.entries(def.anims)) {
      const tex = `spr-${key}-${anim}`;
      if (!scene.textures.exists(tex)) continue;
      if (PIXEL_ART.has(key)) scene.textures.get(tex).setFilter(Phaser.Textures.FilterMode.NEAREST);
      const k = `${key}-${anim}`;
      if (scene.anims.exists(k)) continue;
      scene.anims.create({
        key: k,
        frames: scene.anims.generateFrameNumbers(tex, { start: 0, end: a.frames - 1 }),
        frameRate: anim === 'walk' ? 12 : anim === 'idle' ? 8 : 12,
        repeat: LOOPING.has(anim) ? -1 : 0,
      });
    }
  }
}

/**
 * Frame-animated body built from the user's sprite sheets (bosses, brutes, clones).
 * Same contract as the puppet Rig so AI and entities drive it unchanged.
 */
export class SpriteView extends Phaser.GameObjects.Container implements ActorView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private def: SpriteDef;
  private baseScale: number;
  private facingSign: 1 | -1 = 1;
  private mode = 'idle';
  private flashMs = 0;
  private wobble = 0;
  private tint: number | null;
  private overrideTint: number | null = null;
  private dead = false;

  constructor(scene: Phaser.Scene, readonly key: string, scale: number, tint?: number) {
    super(scene, 0, 0);
    const def = SPRITES[key];
    if (!def) throw new Error(`Unknown sprite ${key}`);
    this.def = def;
    this.baseScale = scale;
    this.tint = tint ?? null;
    this.sprite = scene.add.sprite(0, 0, `spr-${key}-idle`, 0).setOrigin(0.5, def.footY);
    this.add(this.sprite);
    this.setScale(scale);
    this.applyTint();
    this.playAnim('idle');
    scene.add.existing(this);
  }

  private has(anim: string): boolean {
    return !!this.def.anims[anim] && this.scene.anims.exists(`${this.key}-${anim}`);
  }

  private pick(...names: string[]): string {
    for (const n of names) if (this.has(n)) return n;
    return 'idle';
  }

  private playAnim(anim: string, durationMs?: number, force = true): void {
    const a = this.pick(anim);
    const k = `${this.key}-${a}`;
    const frames = this.def.anims[a]?.frames ?? 1;
    const cfg: Phaser.Types.Animations.PlayAnimationConfig = { key: k };
    if (durationMs && durationMs > 0) cfg.frameRate = Math.max(4, Math.min(30, (frames * 1000) / durationMs));
    if (!force && this.sprite.anims.currentAnim?.key === k && this.sprite.anims.isPlaying) return;
    this.sprite.play(cfg);
  }

  get currentAnim(): string {
    return this.mode;
  }

  get animDone(): boolean {
    return this.mode !== 'attack' || !this.sprite.anims.isPlaying;
  }

  get visualHeight(): number {
    return this.def.bodyH * this.baseScale;
  }

  setFacing(f: 1 | -1): void {
    this.facingSign = f;
    this.sprite.setFlipX(this.def.facing === 'right' ? f === -1 : f === 1);
  }

  setBaseScale(s: number): void {
    this.baseScale = s;
    this.setScale(s);
  }

  play(name: string, force = false): void {
    if (this.dead) return;
    if (!force && this.mode === name) return;
    this.mode = name;
    this.playAnim(name === 'walk' ? 'walk' : 'idle', undefined, force);
  }

  hold(name: string, _pose: Pose, _blend?: number): void {
    if (this.dead || this.mode === name) return;
    this.mode = name;
    switch (name) {
      case 'hurt':
      case 'scared':
        this.playAnim('hurt');
        break;
      case 'telegraph':
      case 'crouch':
        this.playAnim(this.pick('prepare', 'jump', 'idle'));
        break;
      case 'charge':
        this.playAnim(this.pick('walkattack', 'walk'));
        break;
      case 'roar':
      case 'v':
      case 'victory':
      case 'cheer':
        this.playAnim(this.pick('attack2', 'attack'));
        break;
      case 'down':
        this.playAnim(this.pick('fall', 'hurt'));
        break;
      case 'getup':
        this.playAnim(this.pick('jump', 'idle'));
        break;
      default:
        this.playAnim('idle');
    }
  }

  playMove(m: MoveConfig): void {
    const end = m.hits.reduce((a, h) => Math.max(a, h.at + h.activeMs), 0);
    this.playAttack('punchA', m.hits[0]?.at ?? 100, end, m.recoveryMs);
  }

  playAttack(name: string, telegraphMs: number, activeMs: number, _recoveryMs: number): void {
    if (this.dead) return;
    this.mode = 'attack';
    const a =
      name === 'slam' ? this.pick('attack3', 'attack2', 'attack') : name === 'spit' || name === 'hook' ? this.pick('attack2', 'attack') : name === 'dive' ? this.pick('fall', 'attack') : 'attack';
    this.playAnim(a, telegraphMs + activeMs);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.mode === 'attack' && !this.dead) {
        this.mode = 'idle';
        this.playAnim('idle');
      }
    });
  }

  /** Called when the owner is defeated: play the death animation and hold its last frame. */
  setDead(): void {
    if (this.dead) return;
    this.dead = true;
    this.mode = 'dead';
    this.playAnim(this.pick('death', 'hurt'));
  }

  flash(ms = 90): void {
    this.flashMs = ms;
    this.sprite.setTintFill(0xffffff);
  }

  setLie(deg: number): void {
    if (this.dead) return;
    // knocked down: bodies without a fall animation tip over a little
    this.sprite.rotation = this.has('fall') ? 0 : (-deg / 88) * 0.35 * (this.facingSign === 1 ? 1 : -1);
  }

  setTintAll(color: number | null): void {
    this.overrideTint = color;
    this.applyTint();
  }

  private applyTint(): void {
    const t = this.overrideTint ?? this.tint;
    if (t === null) this.sprite.clearTint();
    else this.sprite.setTint(t);
  }

  setWobble(v: number): void {
    this.wobble = v;
  }

  update(dt: number): void {
    if (this.flashMs > 0) {
      this.flashMs -= dt;
      if (this.flashMs <= 0) this.applyTint();
    }
    this.sprite.x = this.wobble ? Math.sin(this.scene.time.now / 25) * this.wobble : 0;
  }
}
