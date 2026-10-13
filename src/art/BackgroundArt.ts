import Phaser from 'phaser';
import { FLOOR_TOP, GAME_H, GAME_W } from '../game/constants';
import type { StageTheme } from '../types/game';
import { makeCanvas, roundRect } from './PartArt';

/**
 * Procedural parallax backgrounds, one look per stage theme.
 * Layers: far (sky, scroll 0.12), mid (buildings, scroll 0.5, tileable 1280 wide), floor (tileable 512 wide, scroll 1).
 */

type Ctx = CanvasRenderingContext2D;

let seed = 1;
const rnd = (): number => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a: number, b: number): number => a + rnd() * (b - a);

function sky(ctx: Ctx, w: number, h: number, stops: string[]): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function skyline(ctx: Ctx, w: number, baseY: number, minH: number, maxH: number, color: string, windowColor: string | null, density = 1): void {
  let x = -20;
  while (x < w + 20) {
    const bw = rr(50, 120);
    const bh = rr(minH, maxH);
    ctx.fillStyle = color;
    ctx.fillRect(x, baseY - bh, bw, bh + 4);
    if (rnd() < 0.3) ctx.fillRect(x + bw * 0.4, baseY - bh - rr(10, 40), 4, 40);
    if (windowColor) {
      ctx.fillStyle = windowColor;
      for (let wy = baseY - bh + 10; wy < baseY - 8; wy += 12) {
        for (let wx = x + 6; wx < x + bw - 8; wx += 10) {
          if (rnd() < 0.35 * density) ctx.fillRect(wx, wy, 5, 6);
        }
      }
    }
    x += bw + rr(2, 14);
  }
}

function stars(ctx: Ctx, w: number, h: number, n: number): void {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rr(0.2, 0.9)})`;
    ctx.fillRect(rr(0, w), rr(0, h), rr(1, 2.5), rr(1, 2.5));
  }
}

function neonText(ctx: Ctx, text: string, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.font = `900 ${size}px "Baloo 2", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function hazardStripes(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#1a1a1a';
  for (let i = -h; i < w; i += 28) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + 14, y + h);
    ctx.lineTo(x + i + 14 + h, y);
    ctx.lineTo(x + i + h, y);
    ctx.fill();
  }
  ctx.restore();
}

const FLOOR_H = GAME_H - FLOOR_TOP + 40;

export interface BackgroundKeys {
  far: string;
  mid: string;
  floor: string;
}

export function paintBackground(scene: Phaser.Scene, theme: StageTheme): BackgroundKeys {
  seed = theme.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7);
  const keys = { far: `bg-${theme}-far`, mid: `bg-${theme}-mid`, floor: `bg-${theme}-floor` };
  // Layers loaded from image files (user asset packs) win; missing layers are painted procedurally.
  const P = PAINTERS[theme];
  if (!scene.textures.exists(keys.far)) {
    const far = makeCanvas(scene, keys.far, GAME_W, GAME_H);
    P.far(far.ctx, GAME_W, GAME_H);
    far.tex.refresh();
  }
  if (!scene.textures.exists(keys.mid)) {
    const mid = makeCanvas(scene, keys.mid, GAME_W, GAME_H);
    P.mid(mid.ctx, GAME_W, FLOOR_TOP);
    mid.tex.refresh();
  }
  if (!scene.textures.exists(keys.floor)) {
    const floor = makeCanvas(scene, keys.floor, 512, FLOOR_H);
    P.floor(floor.ctx, 512, FLOOR_H);
    floor.tex.refresh();
  }
  return keys;
}

interface Painter {
  far: (ctx: Ctx, w: number, h: number) => void;
  mid: (ctx: Ctx, w: number, groundY: number) => void;
  floor: (ctx: Ctx, w: number, h: number) => void;
}

const PAINTERS: Record<StageTheme, Painter> = {
  street: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#140a33', '#3a1d5c', '#b03a6a', '#ff8a5c']);
      stars(ctx, w, h * 0.4, 60);
      glow(ctx, 980, 140, 90, 'rgba(255,240,220,0.5)');
      ctx.fillStyle = '#ffeedd';
      ctx.beginPath();
      ctx.arc(980, 140, 34, 0, Math.PI * 2);
      ctx.fill();
      skyline(ctx, w, 470, 180, 380, '#2a1845', 'rgba(255,214,120,0.7)');
      skyline(ctx, w, 480, 100, 260, '#1b1030', 'rgba(255,170,90,0.8)');
    },
    mid: (ctx, w, gy) => {
      const signs = [['PHỞ 24H', '#ff4fa3'], ['TRÀ SỮA', '#3fd5ff'], ['CÀ PHÊ', '#ffd23f'], ['TẠP HÓA', '#7dff6a'], ['BÁNH MÌ', '#ff8a3d']];
      let x = 0;
      let i = 0;
      while (x < w) {
        const bw = 250;
        const bh = rr(260, 360);
        const col = ['#3a2a55', '#2d3a5c', '#4a2a3a', '#2a3a3a'][i % 4];
        ctx.fillStyle = col;
        ctx.fillRect(x + 4, gy - bh, bw - 8, bh);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 4, gy - bh, bw - 8, bh);
        for (let wy = gy - bh + 20; wy < gy - 140; wy += 48) {
          for (let wx = x + 22; wx < x + bw - 40; wx += 52) {
            ctx.fillStyle = rnd() < 0.55 ? 'rgba(255,214,140,0.85)' : 'rgba(30,30,60,0.9)';
            ctx.fillRect(wx, wy, 30, 30);
          }
        }
        // shop front
        ctx.fillStyle = 'rgba(255,230,180,0.25)';
        ctx.fillRect(x + 20, gy - 110, bw - 40, 100);
        ctx.fillStyle = ['#d6303a', '#2a7bd6', '#22a35a', '#d68a2a'][i % 4];
        ctx.beginPath();
        ctx.moveTo(x + 12, gy - 112);
        ctx.lineTo(x + bw - 12, gy - 112);
        ctx.lineTo(x + bw - 22, gy - 90);
        ctx.lineTo(x + 22, gy - 90);
        ctx.fill();
        const [t, c] = signs[i % signs.length];
        neonText(ctx, t, x + bw / 2, gy - 130, 30, c);
        x += bw;
        i++;
      }
      // sidewalk + lamps
      ctx.fillStyle = '#4a4a5e';
      ctx.fillRect(0, gy - 12, w, 16);
      for (let lx = 120; lx < w; lx += 420) {
        ctx.fillStyle = '#22222e';
        ctx.fillRect(lx, gy - 230, 8, 222);
        ctx.fillRect(lx - 30, gy - 232, 38, 6);
        glow(ctx, lx - 26, gy - 222, 70, 'rgba(255,230,160,0.5)');
      }
    },
    floor: (ctx, w, h) => {
      sky(ctx, w, h, ['#3b3b4f', '#26263a', '#1c1c2c']);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillRect(40, h * 0.5, 120, 8);
      ctx.fillRect(296, h * 0.5, 120, 8);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(255,120,200,${rr(0.05, 0.14)})`;
        ctx.beginPath();
        ctx.ellipse(rr(0, w), rr(30, h - 20), rr(20, 60), rr(4, 10), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#555568';
      ctx.fillRect(0, 0, w, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 18, w, 6);
    },
  },
  mall: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#2b3f66', '#41608f', '#d7c6a0']);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      for (let x = 0; x < w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 40, 200);
        ctx.stroke();
      }
      ctx.fillStyle = '#c9b48a';
      ctx.fillRect(0, 200, w, h - 200);
      ctx.fillStyle = '#e6d8b8';
      ctx.fillRect(0, 300, w, 20);
      for (let x = 30; x < w; x += 200) {
        ctx.fillStyle = 'rgba(255,255,240,0.6)';
        ctx.fillRect(x, 220, 140, 60);
      }
    },
    mid: (ctx, w, gy) => {
      const names = ['THỜI TRANG', 'ĐỒ CHƠI', 'SÁCH', 'ĐIỆN THOẠI', 'GIÀY'];
      for (let i = 0; i < 5; i++) {
        const x = i * 256;
        ctx.fillStyle = '#efe6d6';
        ctx.fillRect(x + 8, gy - 300, 240, 300);
        ctx.fillStyle = ['#e64980', '#4dabf7', '#40c057', '#7950f2', '#fd7e14'][i];
        ctx.fillRect(x + 8, gy - 300, 240, 46);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 26px "Baloo 2", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(names[i], x + 128, gy - 268);
        // rolling shutter
        ctx.fillStyle = '#9aa3ad';
        ctx.fillRect(x + 24, gy - 240, 208, 230);
        ctx.strokeStyle = '#6d757e';
        ctx.lineWidth = 3;
        for (let y = gy - 236; y < gy - 12; y += 10) {
          ctx.beginPath();
          ctx.moveTo(x + 24, y);
          ctx.lineTo(x + 232, y);
          ctx.stroke();
        }
        if (i === 2) {
          ctx.fillStyle = '#4a4f5a';
          ctx.save();
          ctx.translate(x + 60, gy);
          ctx.rotate(-0.55);
          ctx.fillRect(0, -30, 300, 30);
          ctx.restore();
        }
      }
      ctx.fillStyle = '#d9cbb0';
      ctx.fillRect(0, gy - 10, w, 14);
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 48) {
        for (let x = 0; x < w; x += 64) {
          ctx.fillStyle = (x / 64 + y / 48) % 2 === 0 ? '#ddd2bd' : '#efe8da';
          ctx.fillRect(x, y, 64, 48);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(0, 40, w, 6);
    },
  },
  subway: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#05080f', '#0d1626', '#152238']);
      for (let x = 60; x < w; x += 220) glow(ctx, x, 120, 80, 'rgba(120,200,255,0.25)');
    },
    mid: (ctx, w, gy) => {
      ctx.fillStyle = '#1e2c3a';
      ctx.fillRect(0, gy - 360, w, 360);
      for (let y = gy - 340; y < gy - 20; y += 24) {
        for (let x = (y / 24) % 2 === 0 ? 0 : 20; x < w; x += 40) {
          ctx.fillStyle = 'rgba(160,200,220,0.13)';
          ctx.fillRect(x + 1, y + 1, 38, 22);
        }
      }
      ctx.fillStyle = '#2a7bd6';
      ctx.fillRect(0, gy - 200, w, 18);
      for (let x = 100; x < w; x += 640) {
        roundRect(ctx, x, gy - 300, 300, 60, 8);
        ctx.fillStyle = '#0f3a73';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 30px "Baloo 2", Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GA ÁNH DƯƠNG', x + 150, gy - 258);
      }
      for (let x = 40; x < w; x += 160) {
        ctx.fillStyle = '#d6e8ff';
        ctx.fillRect(x, gy - 350, 90, 8);
        glow(ctx, x + 45, gy - 340, 60, 'rgba(150,210,255,0.35)');
      }
      for (let x = 420; x < w; x += 640) {
        ctx.fillStyle = '#5a6b7a';
        ctx.fillRect(x, gy - 50, 120, 12);
        ctx.fillRect(x + 8, gy - 38, 8, 30);
        ctx.fillRect(x + 104, gy - 38, 8, 30);
      }
    },
    floor: (ctx, w, h) => {
      // back band (y 0..90) = train tracks, rest = platform
      ctx.fillStyle = '#1b1e24';
      ctx.fillRect(0, 0, w, 96);
      ctx.fillStyle = '#5b4a3a';
      for (let x = 0; x < w; x += 32) ctx.fillRect(x, 26, 18, 56);
      ctx.fillStyle = '#b8c4cf';
      ctx.fillRect(0, 34, w, 6);
      ctx.fillRect(0, 70, w, 6);
      ctx.fillStyle = '#7d8894';
      ctx.fillRect(0, 96, w, h - 96);
      hazardStripes(ctx, 0, 96, w, 14);
      for (let x = 0; x < w; x += 64) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x, 110, 2, h);
      }
    },
  },
  factory: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#1a0f08', '#3a2010', '#6b3a18']);
      for (let x = 0; x < w; x += 120) {
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(x, 0, 20, h);
      }
      for (let y = 80; y < 400; y += 90) {
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(0, y, w, 14);
      }
    },
    mid: (ctx, w, gy) => {
      for (let i = 0; i < 4; i++) {
        const x = i * 320 + 40;
        ctx.fillStyle = '#4a5560';
        roundRect(ctx, x, gy - 320, 170, 300, 40);
        ctx.fill();
        ctx.strokeStyle = '#1a1d24';
        ctx.lineWidth = 4;
        ctx.stroke();
        roundRect(ctx, x + 30, gy - 260, 110, 170, 30);
        const g = ctx.createLinearGradient(0, gy - 260, 0, gy - 90);
        g.addColorStop(0, '#d4ff8a');
        g.addColorStop(1, '#3a9a20');
        ctx.fillStyle = g;
        ctx.fill();
        glow(ctx, x + 85, gy - 170, 140, 'rgba(160,255,90,0.25)');
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(x + 170, gy - 240, 150, 18);
        ctx.fillRect(x + 300, gy - 240, 18, 220);
      }
      hazardStripes(ctx, 0, gy - 16, w, 16);
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#4b4f57';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) {
        for (let x = 0; x < w; x += 128) {
          ctx.strokeStyle = '#2f3238';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 2, y + 2, 124, 60);
          ctx.fillStyle = '#6a6f78';
          for (const [px, py] of [[8, 8], [116, 8], [8, 54], [116, 54]]) ctx.fillRect(x + px, y + py, 4, 4);
        }
      }
    },
  },
  port: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#1a1440', '#6a2a5a', '#ff7a4a', '#ffc070']);
      glow(ctx, 300, 330, 160, 'rgba(255,220,150,0.7)');
      ctx.fillStyle = '#1a3a5a';
      ctx.fillRect(0, 360, w, h - 360);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = 'rgba(255,200,140,0.35)';
        ctx.fillRect(rr(0, w), rr(370, 460), rr(20, 70), 3);
      }
      for (let x = 500; x < w; x += 360) {
        ctx.strokeStyle = '#120c22';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x, 360);
        ctx.lineTo(x + 20, 120);
        ctx.lineTo(x + 220, 120);
        ctx.moveTo(x + 20, 160);
        ctx.lineTo(x - 60, 160);
        ctx.stroke();
      }
    },
    mid: (ctx, w, gy) => {
      const cols = ['#c0392b', '#2471a3', '#239b56', '#d68910', '#7d3c98'];
      for (let x = 0; x < w; x += 160) {
        const stack = Math.floor(rr(1, 4));
        for (let s = 0; s < stack; s++) {
          const y = gy - 70 * (s + 1);
          ctx.fillStyle = cols[Math.floor(rr(0, cols.length))];
          ctx.fillRect(x + 4, y, 152, 68);
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 2;
          for (let lx = x + 12; lx < x + 150; lx += 10) {
            ctx.beginPath();
            ctx.moveTo(lx, y + 4);
            ctx.lineTo(lx, y + 64);
            ctx.stroke();
          }
          ctx.strokeStyle = '#141428';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 4, y, 152, 68);
        }
      }
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#5d6670';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(0, 10, w, 8);
      for (let x = 0; x < w; x += 128) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x, 0, 3, h);
      }
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = 'rgba(120,80,40,0.2)';
        ctx.beginPath();
        ctx.arc(rr(0, w), rr(30, h), rr(6, 22), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  lab: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#0a0d14', '#121a26', '#1a2433']);
      for (let x = 100; x < w; x += 300) glow(ctx, x, 60, 90, 'rgba(255,40,60,0.35)');
    },
    mid: (ctx, w, gy) => {
      ctx.fillStyle = '#c8d2dc';
      ctx.fillRect(0, gy - 340, w, 340);
      ctx.fillStyle = '#a8b4c0';
      ctx.fillRect(0, gy - 340, w, 30);
      for (let i = 0; i < 4; i++) {
        const x = i * 320 + 50;
        roundRect(ctx, x, gy - 290, 120, 250, 50);
        const g = ctx.createLinearGradient(0, gy - 290, 0, gy - 40);
        g.addColorStop(0, 'rgba(160,240,255,0.9)');
        g.addColorStop(1, 'rgba(90,170,255,0.9)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#3a4a5a';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = 'rgba(60,20,90,0.6)';
        ctx.beginPath();
        ctx.ellipse(x + 60, gy - 160, 30, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath();
          ctx.arc(x + rr(30, 90), gy - rr(60, 260), rr(2, 5), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#2a3442';
        ctx.fillRect(x + 150, gy - 120, 120, 110);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = ['#3fd5ff', '#ff3b6b', '#7dff6a'][k % 3];
          ctx.fillRect(x + 162 + (k % 3) * 34, gy - 104 + Math.floor(k / 3) * 30, 22, 14);
        }
        ctx.fillStyle = '#ff2a3a';
        ctx.beginPath();
        ctx.arc(x + 210, gy - 320, 10, 0, Math.PI * 2);
        ctx.fill();
        glow(ctx, x + 210, gy - 320, 60, 'rgba(255,40,60,0.5)');
      }
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#dfe6ee';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b8c2cc';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,40,60,0.12)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  rooftop: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#05060f', '#1a1a3a', '#3a2a5a']);
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = 'rgba(40,40,70,0.7)';
        ctx.beginPath();
        ctx.ellipse(rr(0, w), rr(20, 160), rr(80, 200), rr(20, 50), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      skyline(ctx, w, h, 200, 520, '#120f26', 'rgba(255,90,200,0.6)', 1.2);
      skyline(ctx, w, h, 120, 360, '#0a0818', 'rgba(90,200,255,0.7)', 1.2);
    },
    mid: (ctx, w, gy) => {
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(0, gy - 40, w, 40);
      for (let x = 60; x < w; x += 420) {
        ctx.fillStyle = '#6a7080';
        ctx.fillRect(x, gy - 110, 110, 72);
        ctx.strokeStyle = '#141428';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, gy - 110, 110, 72);
        ctx.beginPath();
        ctx.arc(x + 55, gy - 74, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(x + 220, gy - 220, 90, 140);
        ctx.fillRect(x + 230, gy - 80, 10, 40);
        ctx.fillRect(x + 290, gy - 80, 10, 40);
      }
      roundRect(ctx, 760, gy - 330, 360, 120, 10);
      ctx.fillStyle = '#16122e';
      ctx.fill();
      neonText(ctx, 'ÁNH DƯƠNG', 940, gy - 252, 54, '#ff3bd4');
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#4a4a58';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${rr(0.05, 0.15)})`;
        ctx.fillRect(rr(0, w), rr(0, h), rr(10, 60), rr(2, 6));
      }
      hazardStripes(ctx, 0, h - 54, w, 16);
    },
  },
  ice: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#1a2a5a', '#5a7ab0', '#cfe6ff']);
      stars(ctx, w, 150, 40);
      const mountains = (base: number, hMax: number, color: string): void => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        let x = 0;
        while (x <= w) {
          ctx.lineTo(x, base - rr(hMax * 0.4, hMax));
          x += rr(80, 180);
          ctx.lineTo(x, base - rr(0, hMax * 0.3));
          x += rr(60, 120);
        }
        ctx.lineTo(w, h);
        ctx.fill();
      };
      mountains(460, 300, '#8fa8d0');
      mountains(480, 200, '#c8daf0');
    },
    mid: (ctx, w, gy) => {
      for (let x = 30; x < w; x += 140) {
        ctx.fillStyle = '#2a4a3a';
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + 40, gy - rr(140, 220));
        ctx.lineTo(x + 80, gy);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + 22, gy - 90);
        ctx.lineTo(x + 40, gy - 150);
        ctx.lineTo(x + 58, gy - 90);
        ctx.fill();
      }
      ctx.fillStyle = '#4a5a70';
      ctx.fillRect(400, gy - 260, 480, 260);
      ctx.fillStyle = '#e8f4ff';
      ctx.fillRect(390, gy - 270, 500, 22);
      for (let x = 430; x < 860; x += 80) {
        ctx.fillStyle = 'rgba(255,220,140,0.85)';
        ctx.fillRect(x, gy - 220, 44, 40);
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 30px "Baloo 2", Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TRẠM KHUẾCH ĐẠI', 640, gy - 140);
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#eaf4ff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(150,190,230,${rr(0.15, 0.35)})`;
        ctx.beginPath();
        ctx.ellipse(rr(0, w), rr(0, h), rr(20, 70), rr(4, 12), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  tower: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#05030f', '#1a0f3a', '#3a1a5a']);
      stars(ctx, w, h * 0.5, 80);
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(255,${Math.floor(rr(150, 230))},120,${rr(0.3, 0.8)})`;
        ctx.fillRect(rr(0, w), rr(520, h), 2, 2);
      }
    },
    mid: (ctx, w, gy) => {
      for (let x = 0; x < w; x += 160) {
        ctx.fillStyle = 'rgba(120,160,255,0.08)';
        ctx.fillRect(x + 6, 40, 148, gy - 40);
        ctx.fillStyle = '#1a1430';
        ctx.fillRect(x, 0, 10, gy);
      }
      ctx.fillStyle = '#1a1430';
      ctx.fillRect(0, 30, w, 14);
      glow(ctx, 640, gy - 220, 200, 'rgba(180,77,255,0.45)');
      ctx.fillStyle = '#b44dff';
      roundRect(ctx, 600, gy - 330, 80, 230, 40);
      ctx.fill();
      ctx.fillStyle = '#f2d4ff';
      roundRect(ctx, 622, gy - 300, 36, 170, 18);
      ctx.fill();
      ctx.fillStyle = '#2a2440';
      ctx.fillRect(1000, gy - 280, 160, 280);
      ctx.fillStyle = '#3a3460';
      ctx.fillRect(1008, gy - 270, 70, 262);
      ctx.fillRect(1082, gy - 270, 70, 262);
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#16122a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(180,77,255,0.5)';
      ctx.lineWidth = 2;
      for (let y = 20; y < h; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, w, 30);
    },
  },
  chaos: {
    far: (ctx, w, h) => {
      sky(ctx, w, h, ['#0a0014', '#2a0a3a', '#5a1a6a']);
      const cx = w / 2;
      const cy = 230;
      for (let r = 300; r > 10; r -= 14) {
        ctx.strokeStyle = `rgba(${180 + (r % 60)},${60 + (r % 90)},255,${0.12 + (300 - r) / 900})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.55, r * 0.01, 0, Math.PI * 1.7);
        ctx.stroke();
      }
      glow(ctx, cx, cy, 120, 'rgba(255,220,255,0.8)');
      stars(ctx, w, h, 120);
    },
    mid: (ctx, w, gy) => {
      for (let i = 0; i < 7; i++) {
        const x = rr(0, w);
        const y = rr(120, gy - 120);
        const s = rr(40, 110);
        ctx.fillStyle = '#3a2a4a';
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x + s * 0.3, y + s * 0.9);
        ctx.lineTo(x - s * 0.4, y + s * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6a5a7a';
        ctx.fillRect(x - s, y - 8, s * 2, 10);
        if (i % 2 === 0) {
          ctx.fillStyle = '#5a4a6a';
          ctx.fillRect(x - 12, y - 80, 24, 72);
        }
      }
    },
    floor: (ctx, w, h) => {
      ctx.fillStyle = '#2a2034';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 96) {
        for (let y = 0; y < h; y += 64) {
          ctx.strokeStyle = '#1a1424';
          ctx.lineWidth = 3;
          ctx.strokeRect(x + ((y / 64) % 2) * 48, y, 96, 64);
        }
      }
      ctx.strokeStyle = 'rgba(200,100,255,0.8)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        let x = rr(0, w);
        let y = rr(0, h);
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += rr(-40, 40);
          y += rr(10, 40);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
};
