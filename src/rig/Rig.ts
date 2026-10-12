import Phaser from 'phaser';
import { PART_DIMS, partOrigin } from '../art/PartArt';
import { TEX_RES } from '../game/constants';
import type { MoveConfig } from '../types/game';
import { clonePose, IDLE, IDLE2, lerpPose, STRIKES, WALK, type Pose } from './Poses';

export interface RigOptions {
  partKey: string;
  headKey: string;
  /** displayed head height in rig units */
  headHeight: number;
  /** 0..1 vertical anchor of the neck inside the head texture */
  headAnchorY?: number;
  headOffsetX?: number;
  scale: number;
  tailKey?: string;
  bulk?: number;
  /** extra head decoration drawn on top (e.g. bear ears, crown) */
  headDeco?: 'bearEars' | 'crown' | 'horns';
  tint?: number;
}

interface Keyframe {
  t: number;
  pose: Pose;
}

const D2R = Math.PI / 180;
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Cut-out puppet built from a head image (taken from the reference artwork) and procedurally painted limbs.
 * The root container sits at the character's feet; facing flips the root horizontally.
 */
export class Rig extends Phaser.GameObjects.Container {
  readonly root: Phaser.GameObjects.Container;
  private upper: Phaser.GameObjects.Container;
  private head: Phaser.GameObjects.Image;
  private armF: Phaser.GameObjects.Container;
  private armB: Phaser.GameObjects.Container;
  private legF: Phaser.GameObjects.Container;
  private legB: Phaser.GameObjects.Container;
  private elbowF: Phaser.GameObjects.Container;
  private elbowB: Phaser.GameObjects.Container;
  private kneeF: Phaser.GameObjects.Container;
  private kneeB: Phaser.GameObjects.Container;
  private tail?: Phaser.GameObjects.Image;
  private images: Phaser.GameObjects.Image[] = [];
  private backImages: Phaser.GameObjects.Image[] = [];
  private hipY: number;
  private torsoH: number;
  private baseScale: number;
  private facingSign: 1 | -1 = 1;

  private frames: Keyframe[] = [];
  private animTime = 0;
  private animLength = 1;
  private loop = true;
  private current: Pose = clonePose(IDLE);
  private animName = '';
  private spinUntil = -1;
  private spinFrom = -1;
  private hop = 0;
  private hopWindow: [number, number] = [0, 0];
  private flashMs = 0;
  private baseTint: number;
  private wobble = 0;

  constructor(scene: Phaser.Scene, opts: RigOptions) {
    super(scene, 0, 0);
    const bulk = opts.bulk ?? 1;
    this.baseScale = opts.scale;
    this.baseTint = opts.tint ?? 0xffffff;
    this.hipY = -(PART_DIMS.thigh.len + PART_DIMS.shin.len + 5);
    this.torsoH = PART_DIMS.torso.h;
    this.root = scene.add.container(0, 0);
    this.add(this.root);

    const part = (k: string, back = false): Phaser.GameObjects.Image => {
      const key = `${opts.partKey}-${k}`;
      const o = partOrigin(key);
      const img = scene.add.image(0, 0, key).setOrigin(o.x, o.y).setScale(1 / TEX_RES);
      this.images.push(img);
      if (back) this.backImages.push(img);
      return img;
    };

    // legs
    const makeLeg = (x: number, back: boolean): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] => {
      const leg = scene.add.container(x * bulk, this.hipY);
      const knee = scene.add.container(0, PART_DIMS.thigh.len);
      knee.add(part('shin', back));
      leg.add([part('thigh', back), knee]);
      return [leg, knee];
    };
    [this.legB, this.kneeB] = makeLeg(-5, true);
    [this.legF, this.kneeF] = makeLeg(5, false);

    // arms
    const makeArm = (x: number, y: number, back: boolean): [Phaser.GameObjects.Container, Phaser.GameObjects.Container] => {
      const arm = scene.add.container(x * bulk, y);
      const elbow = scene.add.container(0, PART_DIMS.upperArm.len);
      elbow.add(part('forearm', back));
      arm.add([part('upperArm', back), elbow]);
      return [arm, elbow];
    };
    this.upper = scene.add.container(0, this.hipY);
    [this.armB, this.elbowB] = makeArm(-8, -this.torsoH + 7, true);
    [this.armF, this.elbowF] = makeArm(9, -this.torsoH + 8, false);

    const torso = part('torso');
    torso.setPosition(0, 5);

    this.head = scene.add.image(opts.headOffsetX ?? 0, -this.torsoH + 4, opts.headKey);
    const hTex = this.head.frame;
    this.head.setOrigin(0.5, opts.headAnchorY ?? 0.92);
    this.head.setScale(opts.headHeight / hTex.height);
    this.images.push(this.head);

    this.upper.add(this.armB);
    if (opts.tailKey) {
      const o = partOrigin(opts.tailKey);
      this.tail = scene.add.image(-14 * bulk, -2, opts.tailKey).setOrigin(o.x, o.y).setScale(1 / TEX_RES);
      this.images.push(this.tail);
      this.upper.add(this.tail);
    }
    this.upper.add([torso, this.head]);
    if (opts.headDeco) this.addHeadDeco(opts.headDeco, opts.headHeight);
    this.upper.add(this.armF);

    this.root.add([this.legB, this.upper, this.legF]);
    for (const img of this.backImages) img.setTint(this.mulTint(0xb4b4c8));
    if (this.baseTint !== 0xffffff) for (const img of this.images) if (!this.backImages.includes(img)) img.setTint(this.baseTint);
    this.setScale(this.baseScale);
    this.play('idle');
    scene.add.existing(this);
  }

  private mulTint(t: number): number {
    const a = this.baseTint;
    const ch = (s: number): number => Math.round((((a >> s) & 255) * ((t >> s) & 255)) / 255);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }

  private addHeadDeco(kind: 'bearEars' | 'crown' | 'horns', hh: number): void {
    const g = this.scene.add.graphics();
    const top = -this.torsoH + 4 - hh * 0.85;
    if (kind === 'bearEars') {
      for (const x of [-hh * 0.36, hh * 0.36]) {
        g.fillStyle(0x3a4256).fillCircle(x, top + 4, hh * 0.17);
        g.lineStyle(2, 0x141428).strokeCircle(x, top + 4, hh * 0.17);
        g.fillStyle(0xffb02e).fillCircle(x, top + 4, hh * 0.08);
      }
    } else if (kind === 'crown') {
      g.fillStyle(0xbff4ff);
      g.lineStyle(2, 0x2e6b94);
      const w = hh * 0.6;
      const pts = [-w / 2, 0, -w / 2, -14, -w / 4, -4, 0, -20, w / 4, -4, w / 2, -14, w / 2, 0];
      g.beginPath();
      g.moveTo(pts[0], top + 6 + pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], top + 6 + pts[i + 1]);
      g.closePath();
      g.fillPath();
      g.strokePath();
    } else {
      g.fillStyle(0xb44dff);
      g.fillTriangle(-hh * 0.3, top + 8, -hh * 0.45, top - 18, -hh * 0.12, top + 4);
      g.fillTriangle(hh * 0.3, top + 8, hh * 0.45, top - 18, hh * 0.12, top + 4);
    }
    // put decoration behind head for ears, in front for crown
    this.upper.add(g);
    if (kind === 'bearEars') this.upper.moveDown(g);
  }

  get facing(): 1 | -1 {
    return this.facingSign;
  }

  setFacing(f: 1 | -1): void {
    this.facingSign = f;
  }

  setBaseScale(s: number): void {
    this.baseScale = s;
  }

  get currentAnim(): string {
    return this.animName;
  }

  /** Looping or one-shot named animation. */
  play(name: string, force = false): void {
    if (!force && this.animName === name) return;
    this.animName = name;
    this.spinUntil = -1;
    this.hop = 0;
    const start = clonePose(this.current);
    switch (name) {
      case 'idle':
        this.setFrames([{ t: 0, pose: start }, { t: 160, pose: IDLE }, { t: 610, pose: IDLE2 }, { t: 1060, pose: IDLE }], true, 160);
        break;
      case 'walk':
        this.setFrames(
          [
            { t: 0, pose: start },
            { t: 90, pose: WALK[0] },
            { t: 210, pose: WALK[1] },
            { t: 330, pose: WALK[2] },
            { t: 450, pose: WALK[3] },
            { t: 570, pose: WALK[0] },
          ],
          true,
          90,
        );
        break;
      default:
        this.setFrames([{ t: 0, pose: start }, { t: 90, pose: IDLE }], false);
    }
  }

  /** Hold a static pose (hurt, down, jump...). */
  hold(name: string, pose: Pose, blendMs = 70): void {
    this.animName = name;
    this.spinUntil = -1;
    this.hop = 0;
    this.setFrames([{ t: 0, pose: clonePose(this.current) }, { t: blendMs, pose }], false);
  }

  /** Builds windup/strike keyframes timed against the move's hit windows. */
  playMove(move: MoveConfig, speed = 1): void {
    const set = STRIKES[move.anim] ?? STRIKES.punchA;
    this.playStrikeSet(move.anim, set, move.hits.map((h) => ({ at: h.at / speed, active: h.activeMs / speed })), (move.recoveryMs / speed));
  }

  playStrikeSet(name: string, set: (typeof STRIKES)[string], hits: Array<{ at: number; active: number }>, recovery: number): void {
    this.animName = name;
    const frames: Keyframe[] = [{ t: 0, pose: clonePose(this.current) }];
    let prevEnd = 0;
    hits.forEach((h, i) => {
      const wind = set.windups[i % set.windups.length];
      const strike = set.strikes[i % set.strikes.length];
      const gap = Math.max(30, h.at - prevEnd);
      const windT = Math.max(frames[frames.length - 1].t + 10, h.at - Math.min(110, gap * 0.55));
      frames.push({ t: windT, pose: wind });
      frames.push({ t: Math.max(windT + 10, h.at + 25), pose: strike });
      frames.push({ t: Math.max(windT + 20, h.at + h.active), pose: strike });
      prevEnd = h.at + h.active;
    });
    frames.push({ t: prevEnd + recovery, pose: IDLE });
    this.setFrames(frames, false);
    this.spinUntil = set.spin ? prevEnd : -1;
    this.spinFrom = set.spin && hits.length ? hits[0].at : -1;
    this.hop = set.hop ?? 0;
    this.hopWindow = [hits.length ? hits[0].at - 60 : 0, prevEnd];
  }

  /** Simple telegraph → strike → recover sequence (enemies & bosses). */
  playAttack(name: string, telegraphMs: number, activeMs: number, recoveryMs: number): void {
    const set = STRIKES[name] ?? STRIKES.punchA;
    this.playStrikeSet(name, set, [{ at: telegraphMs, active: activeMs }], recoveryMs);
  }

  private setFrames(frames: Keyframe[], loop: boolean, loopStart = 0): void {
    this.frames = frames;
    this.loop = loop;
    this.animTime = 0;
    this.animLength = frames[frames.length - 1].t;
    this.loopStart = loopStart;
  }

  private loopStart = 0;

  flash(ms = 90): void {
    this.flashMs = ms;
    for (const img of this.images) img.setTintFill(0xffffff);
  }

  setWobble(v: number): void {
    this.wobble = v;
  }

  /** Lying angle for knockdown (0 = upright). */
  setLie(deg: number): void {
    this.root.rotation = -deg * D2R;
  }

  setTintAll(color: number | null): void {
    for (const img of this.images) {
      if (color === null) {
        if (this.backImages.includes(img)) img.setTint(this.mulTint(0xb4b4c8));
        else if (this.baseTint !== 0xffffff) img.setTint(this.baseTint);
        else img.clearTint();
      } else img.setTint(color);
    }
  }

  update(dtMs: number): void {
    this.animTime += dtMs;
    let t = this.animTime;
    if (this.loop) {
      if (t > this.animLength) t = this.loopStart + ((t - this.loopStart) % (this.animLength - this.loopStart));
    } else t = Math.min(t, this.animLength);
    // find segment
    const f = this.frames;
    let i = 0;
    while (i < f.length - 2 && f[i + 1].t < t) i++;
    const a = f[i];
    const b = f[Math.min(i + 1, f.length - 1)];
    const span = Math.max(1, b.t - a.t);
    const k = easeInOut(Phaser.Math.Clamp((t - a.t) / span, 0, 1));
    lerpPose(a.pose, b.pose, k, this.current);
    this.applyPose(this.current);

    // spin = quick facing oscillation
    let flip = 1;
    if (this.spinUntil > 0 && this.animTime >= this.spinFrom && this.animTime <= this.spinUntil) {
      flip = Math.floor((this.animTime - this.spinFrom) / 70) % 2 === 0 ? -1 : 1;
    }
    this.scaleX = this.baseScale * this.facingSign * flip;
    this.scaleY = this.baseScale;
    // hop
    if (this.hop && this.animTime >= this.hopWindow[0] && this.animTime <= this.hopWindow[1]) {
      const hk = (this.animTime - this.hopWindow[0]) / Math.max(1, this.hopWindow[1] - this.hopWindow[0]);
      this.root.y = -Math.sin(hk * Math.PI) * this.hop;
    } else this.root.y = 0;

    if (this.tail) this.tail.rotation = Math.sin(this.scene.time.now / 180) * 0.25 - 0.1;
    if (this.wobble) this.root.x = Math.sin(this.scene.time.now / 25) * this.wobble;
    else this.root.x = 0;

    if (this.flashMs > 0) {
      this.flashMs -= dtMs;
      if (this.flashMs <= 0) this.setTintAll(null);
    }
  }

  get animDone(): boolean {
    return !this.loop && this.animTime >= this.animLength;
  }

  private applyPose(q: Pose): void {
    this.upper.y = this.hipY + q.body;
    this.upper.rotation = q.lean * D2R;
    this.head.rotation = q.head * D2R;
    this.armF.rotation = -q.aF[0] * D2R;
    this.elbowF.rotation = -q.aF[1] * D2R;
    this.armB.rotation = -q.aB[0] * D2R;
    this.elbowB.rotation = -q.aB[1] * D2R;
    this.legF.y = this.hipY + q.body;
    this.legB.y = this.hipY + q.body;
    this.legF.rotation = -q.lF[0] * D2R;
    this.kneeF.rotation = q.lF[1] * D2R;
    this.legB.rotation = -q.lB[0] * D2R;
    this.kneeB.rotation = q.lB[1] * D2R;
    const bf = (q.bf ?? 0) > 0.5;
    const idx = this.upper.getIndex(this.armB);
    if (bf && idx !== this.upper.length - 1) this.upper.bringToTop(this.armB);
    else if (!bf && idx !== 0) this.upper.sendToBack(this.armB);
  }

  /** Approximate world-space height of the rig (for hurtboxes / UI). */
  get visualHeight(): number {
    return (Math.abs(this.hipY) + this.torsoH + (this.head.displayHeight * 0.9)) * this.baseScale;
  }
}
