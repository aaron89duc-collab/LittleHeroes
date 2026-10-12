import Phaser from 'phaser';
import { TEX_RES } from '../game/constants';

/** Procedurally painted body parts for the puppet rig (heads come from the reference artwork). */

export type TorsoStyle = 'hero' | 'vest' | 'tank' | 'armor' | 'robot' | 'mutant' | 'coat' | 'cloak' | 'jacket';
export type SleeveStyle = 'long' | 'short' | 'none';

export interface PartSpec {
  key: string;
  suit: number; // shirt / main color
  suitDark: number;
  vest: number;
  glove: number;
  boot: number;
  skin: number;
  pants: number;
  accent: number;
  sleeves: SleeveStyle;
  torso: TorsoStyle;
  badge?: string;
  bulk?: number; // width multiplier
}

export const PART_DIMS = {
  upperArm: { w: 13, len: 17 },
  forearm: { w: 12, len: 14, fist: 7.5 },
  thigh: { w: 15, len: 19 },
  shin: { w: 14, len: 18 },
  torso: { w: 38, h: 36 },
};

const INK = '#141428';

/** Joint origin (0..1) for each generated part texture. */
export const PART_ORIGINS = new Map<string, { x: number; y: number }>();
export function partOrigin(key: string): { x: number; y: number } {
  return PART_ORIGINS.get(key) ?? { x: 0.5, y: 0.5 };
}

export const hex = (c: number, a = 1): string => {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
};

export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number): { ctx: CanvasRenderingContext2D; tex: Phaser.Textures.CanvasTexture } {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  if (!tex) throw new Error(`Cannot create canvas texture ${key}`);
  const ctx = tex.getContext();
  return { ctx, tex };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, lw = 2.2): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw * TEX_RES;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function vgrad(ctx: CanvasRenderingContext2D, x0: number, x1: number, c: number): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, hex(shade(c, 1.25)));
  g.addColorStop(0.45, hex(c));
  g.addColorStop(1, hex(shade(c, 0.62)));
  return g;
}

/** A capsule limb texture: joint at top centre. Returns origin Y ratio for the joint. */
function paintLimb(
  scene: Phaser.Scene,
  key: string,
  w: number,
  len: number,
  color: number,
  opts: { endColor?: number; endLen?: number; fist?: { r: number; color: number }; boot?: { color: number }; stripe?: number },
): void {
  const R = TEX_RES;
  const pad = 4;
  const fistR = opts.fist ? opts.fist.r : 0;
  const bootExtra = opts.boot ? 9 : 0;
  const W = (Math.max(w, fistR * 2) + pad * 2 + bootExtra) * R;
  const H = (len + w / 2 + fistR + pad * 2 + (opts.boot ? 6 : 0)) * R;
  const { ctx, tex } = makeCanvas(scene, key, W, H);
  const cx = (pad + Math.max(w, fistR * 2) / 2) * R;
  const top = pad * R;
  // limb body
  roundRect(ctx, cx - (w / 2) * R, top, w * R, (len + w / 2) * R, (w / 2) * R);
  fillStroke(ctx, vgrad(ctx, cx - (w / 2) * R, cx + (w / 2) * R, color));
  if (opts.endColor !== undefined && opts.endLen) {
    // cuff / sleeve end / skin part
    const ey = top + (len + w / 2 - opts.endLen) * R;
    ctx.save();
    roundRect(ctx, cx - (w / 2) * R, top, w * R, (len + w / 2) * R, (w / 2) * R);
    ctx.clip();
    ctx.fillStyle = vgrad(ctx, cx - (w / 2) * R, cx + (w / 2) * R, opts.endColor);
    ctx.fillRect(cx - w * R, ey, w * 2 * R, opts.endLen * R + 4 * R);
    ctx.restore();
    roundRect(ctx, cx - (w / 2) * R, top, w * R, (len + w / 2) * R, (w / 2) * R);
    ctx.lineWidth = 2.2 * R;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - (w / 2) * R, ey);
    ctx.lineTo(cx + (w / 2) * R, ey);
    ctx.lineWidth = 1.6 * R;
    ctx.stroke();
  }
  if (opts.stripe !== undefined) {
    ctx.fillStyle = hex(opts.stripe);
    ctx.fillRect(cx - (w / 2 - 1.2) * R, top + 4 * R, 2.4 * R, len * 0.6 * R);
  }
  if (opts.fist) {
    const fy = top + (len + w / 2) * R;
    ctx.beginPath();
    ctx.arc(cx + 1 * R, fy, opts.fist.r * R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - 2 * R, fy - 3 * R, 1, cx, fy, opts.fist.r * R);
    g.addColorStop(0, hex(shade(opts.fist.color, 1.5)));
    g.addColorStop(1, hex(opts.fist.color));
    fillStroke(ctx, g);
    // knuckle lines
    ctx.strokeStyle = hex(shade(opts.fist.color, 0.5));
    ctx.lineWidth = 1.2 * R;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (2 + i * 2.6) * R, fy + 2 * R);
      ctx.lineTo(cx + (2 + i * 2.6) * R, fy + 5 * R);
      ctx.stroke();
    }
  }
  if (opts.boot) {
    const by = top + (len - 2) * R;
    roundRect(ctx, cx - (w / 2 + 1) * R, by, (w + 10) * R, (w / 2 + 8) * R, 5 * R);
    fillStroke(ctx, vgrad(ctx, cx - w * R, cx + w * R, opts.boot.color));
    ctx.fillStyle = hex(shade(opts.boot.color, 1.8));
    ctx.fillRect(cx - (w / 2) * R, by + (w / 2 + 4) * R, (w + 8) * R, 1.6 * R);
  }
  tex.refresh();
  PART_ORIGINS.set(tex.key, { x: cx / W, y: (top + (w / 2) * R * 0.6) / H });
}

function paintTorso(scene: Phaser.Scene, s: PartSpec): void {
  const R = TEX_RES;
  const bulk = s.bulk ?? 1;
  const w = PART_DIMS.torso.w * bulk;
  const h = PART_DIMS.torso.h;
  const pad = 5;
  const W = (w + pad * 2) * R;
  const H = (h + pad * 2) * R;
  const { ctx, tex } = makeCanvas(scene, `${s.key}-torso`, W, H);
  const x0 = pad * R;
  const y0 = pad * R;
  const ww = w * R;
  const hh = h * R;
  const bodyShape = (): void => {
    ctx.beginPath();
    ctx.moveTo(x0 + ww * 0.12, y0 + hh * 0.05);
    ctx.quadraticCurveTo(x0 + ww * 0.5, y0 - hh * 0.06, x0 + ww * 0.88, y0 + hh * 0.05);
    ctx.quadraticCurveTo(x0 + ww * 1.0, y0 + hh * 0.2, x0 + ww * 0.94, y0 + hh * 0.55);
    ctx.lineTo(x0 + ww * 0.9, y0 + hh);
    ctx.lineTo(x0 + ww * 0.1, y0 + hh);
    ctx.lineTo(x0 + ww * 0.06, y0 + hh * 0.55);
    ctx.quadraticCurveTo(x0, y0 + hh * 0.2, x0 + ww * 0.12, y0 + hh * 0.05);
    ctx.closePath();
  };
  const base = s.torso === 'mutant' ? s.skin : s.suit;
  bodyShape();
  fillStroke(ctx, vgrad(ctx, x0, x0 + ww, base), 2.4);
  ctx.save();
  bodyShape();
  ctx.clip();
  switch (s.torso) {
    case 'hero': {
      // tactical vest + straps + POLICE patch
      roundRect(ctx, x0 + ww * 0.14, y0 + hh * 0.18, ww * 0.72, hh * 0.66, 5 * R);
      fillStroke(ctx, vgrad(ctx, x0, x0 + ww, s.vest), 1.8);
      ctx.fillStyle = hex(shade(s.vest, 0.6));
      ctx.fillRect(x0 + ww * 0.22, y0, ww * 0.1, hh * 0.25);
      ctx.fillRect(x0 + ww * 0.68, y0, ww * 0.1, hh * 0.25);
      // pouches
      ctx.fillStyle = hex(shade(s.vest, 1.35));
      ctx.fillRect(x0 + ww * 0.2, y0 + hh * 0.66, ww * 0.16, hh * 0.13);
      ctx.fillRect(x0 + ww * 0.64, y0 + hh * 0.66, ww * 0.16, hh * 0.13);
      // patch
      roundRect(ctx, x0 + ww * 0.24, y0 + hh * 0.33, ww * 0.52, hh * 0.2, 2 * R);
      ctx.fillStyle = hex(shade(s.suit, 0.55));
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(5.6 * R)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.badge ?? 'POLICE', x0 + ww * 0.5, y0 + hh * 0.435);
      // collar
      ctx.fillStyle = hex(s.suitDark);
      ctx.fillRect(x0 + ww * 0.36, y0, ww * 0.28, hh * 0.1);
      break;
    }
    case 'vest': {
      ctx.fillStyle = hex(s.skin);
      ctx.beginPath();
      ctx.moveTo(x0 + ww * 0.35, y0);
      ctx.lineTo(x0 + ww * 0.65, y0);
      ctx.lineTo(x0 + ww * 0.55, y0 + hh);
      ctx.lineTo(x0 + ww * 0.45, y0 + hh);
      ctx.fill();
      ctx.fillStyle = hex(shade(s.suit, 1.2));
      ctx.fillRect(x0 + ww * 0.4, y0 + hh * 0.1, ww * 0.2, hh * 0.9);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6 * R;
      ctx.beginPath();
      ctx.moveTo(x0 + ww * 0.38, y0);
      ctx.lineTo(x0 + ww * 0.4, y0 + hh);
      ctx.moveTo(x0 + ww * 0.62, y0);
      ctx.lineTo(x0 + ww * 0.6, y0 + hh);
      ctx.stroke();
      break;
    }
    case 'tank':
    case 'jacket': {
      ctx.fillStyle = hex(s.skin);
      ctx.beginPath();
      ctx.ellipse(x0 + ww * 0.5, y0, ww * 0.22, hh * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      // muscles/chest lines
      ctx.strokeStyle = hex(shade(base, 0.55));
      ctx.lineWidth = 1.4 * R;
      ctx.beginPath();
      ctx.moveTo(x0 + ww * 0.5, y0 + hh * 0.2);
      ctx.lineTo(x0 + ww * 0.5, y0 + hh * 0.55);
      ctx.stroke();
      if (s.torso === 'jacket') {
        ctx.fillStyle = hex(s.accent);
        ctx.fillRect(x0 + ww * 0.05, y0 + hh * 0.3, ww * 0.9, hh * 0.08);
      }
      break;
    }
    case 'armor': {
      roundRect(ctx, x0 + ww * 0.1, y0 + hh * 0.12, ww * 0.8, hh * 0.72, 6 * R);
      fillStroke(ctx, vgrad(ctx, x0, x0 + ww, s.vest), 1.8);
      ctx.fillStyle = hex(s.accent, 0.9);
      ctx.fillRect(x0 + ww * 0.42, y0 + hh * 0.3, ww * 0.16, hh * 0.16);
      ctx.fillStyle = hex(shade(s.vest, 1.4));
      for (let i = 0; i < 3; i++) ctx.fillRect(x0 + ww * (0.18 + i * 0.24), y0 + hh * 0.62, ww * 0.16, hh * 0.12);
      break;
    }
    case 'robot': {
      ctx.fillStyle = hex(shade(base, 1.3));
      roundRect(ctx, x0 + ww * 0.18, y0 + hh * 0.16, ww * 0.64, hh * 0.44, 4 * R);
      ctx.fill();
      ctx.fillStyle = hex(s.accent);
      ctx.beginPath();
      ctx.arc(x0 + ww * 0.5, y0 + hh * 0.38, 4.5 * R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4 * R;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x0 + ww * 0.15, y0 + hh * (0.68 + i * 0.08));
        ctx.lineTo(x0 + ww * 0.85, y0 + hh * (0.68 + i * 0.08));
        ctx.stroke();
      }
      break;
    }
    case 'mutant': {
      ctx.fillStyle = hex(s.accent, 0.8);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(x0 + ww * (0.2 + i * 0.15), y0 + hh * (0.3 + (i % 2) * 0.25), (2 + (i % 3)) * R, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hex(s.suit);
      ctx.fillRect(x0, y0 + hh * 0.72, ww, hh * 0.3);
      break;
    }
    case 'coat': {
      ctx.fillStyle = hex(s.accent);
      ctx.fillRect(x0 + ww * 0.4, y0, ww * 0.2, hh);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5 * R;
      ctx.beginPath();
      ctx.moveTo(x0 + ww * 0.3, y0);
      ctx.lineTo(x0 + ww * 0.45, y0 + hh * 0.4);
      ctx.lineTo(x0 + ww * 0.45, y0 + hh);
      ctx.moveTo(x0 + ww * 0.7, y0);
      ctx.lineTo(x0 + ww * 0.55, y0 + hh * 0.4);
      ctx.lineTo(x0 + ww * 0.55, y0 + hh);
      ctx.stroke();
      ctx.fillStyle = hex(s.suitDark);
      ctx.fillRect(x0 + ww * 0.12, y0 + hh * 0.55, ww * 0.18, hh * 0.08);
      break;
    }
    case 'cloak': {
      const g = ctx.createLinearGradient(0, y0, 0, y0 + hh);
      g.addColorStop(0, hex(shade(base, 1.6)));
      g.addColorStop(1, hex(base));
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, ww, hh);
      ctx.strokeStyle = hex(s.accent);
      ctx.lineWidth = 2 * R;
      ctx.beginPath();
      ctx.moveTo(x0 + ww * 0.5, y0 + hh * 0.15);
      ctx.lineTo(x0 + ww * 0.62, y0 + hh * 0.35);
      ctx.lineTo(x0 + ww * 0.5, y0 + hh * 0.55);
      ctx.lineTo(x0 + ww * 0.38, y0 + hh * 0.35);
      ctx.closePath();
      ctx.stroke();
      break;
    }
  }
  // belt
  ctx.fillStyle = hex(s.torso === 'robot' ? shade(s.suit, 0.5) : 0x1b1b22);
  ctx.fillRect(x0, y0 + hh * 0.86, ww, hh * 0.14);
  ctx.fillStyle = hex(0xd9b44a);
  ctx.fillRect(x0 + ww * 0.45, y0 + hh * 0.87, ww * 0.1, hh * 0.11);
  ctx.restore();
  bodyShape();
  ctx.lineWidth = 2.4 * R;
  ctx.strokeStyle = INK;
  ctx.stroke();
  tex.refresh();
  PART_ORIGINS.set(tex.key, { x: 0.5, y: (y0 + hh) / H });
}

export function paintPartSet(scene: Phaser.Scene, s: PartSpec): void {
  const d = PART_DIMS;
  const bulk = s.bulk ?? 1;
  const sleeveColor = s.torso === 'mutant' ? s.skin : s.sleeves === 'none' ? s.skin : s.suit;
  const forearmColor = s.sleeves === 'long' ? s.suit : s.skin;
  paintLimb(scene, `${s.key}-upperArm`, d.upperArm.w * bulk, d.upperArm.len, sleeveColor, {
    endColor: s.sleeves === 'short' ? s.skin : undefined,
    endLen: s.sleeves === 'short' ? 7 : undefined,
    stripe: s.torso === 'hero' ? s.accent : undefined,
  });
  paintLimb(scene, `${s.key}-forearm`, d.forearm.w * bulk, d.forearm.len, forearmColor, {
    endColor: s.sleeves === 'long' ? shade(s.glove, 1.1) : undefined,
    endLen: s.sleeves === 'long' ? 5 : undefined,
    fist: { r: d.forearm.fist * Math.sqrt(bulk), color: s.glove },
  });
  paintLimb(scene, `${s.key}-thigh`, d.thigh.w * bulk, d.thigh.len, s.pants, {});
  paintLimb(scene, `${s.key}-shin`, d.shin.w * bulk, d.shin.len, s.pants, { boot: { color: s.boot } });
  paintTorso(scene, s);
}

/** Fluffy tail (Shu Shu) */
export function paintTail(scene: Phaser.Scene, key: string, color: number): void {
  const R = TEX_RES;
  const { ctx, tex } = makeCanvas(scene, key, 40 * R, 30 * R);
  ctx.beginPath();
  ctx.moveTo(36 * R, 22 * R);
  ctx.quadraticCurveTo(24 * R, 2 * R, 8 * R, 6 * R);
  ctx.quadraticCurveTo(0, 14 * R, 8 * R, 22 * R);
  ctx.quadraticCurveTo(22 * R, 28 * R, 36 * R, 22 * R);
  ctx.closePath();
  fillStroke(ctx, hex(color));
  ctx.beginPath();
  ctx.ellipse(9 * R, 13 * R, 6 * R, 6.5 * R, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff6e8';
  ctx.fill();
  tex.refresh();
  PART_ORIGINS.set(tex.key, { x: 0.92, y: 0.72 });
}
