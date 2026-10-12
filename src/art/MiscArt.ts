import Phaser from 'phaser';
import { TEX_RES } from '../game/constants';
import { hex, makeCanvas, roundRect, shade } from './PartArt';

const INK = '#141428';
const R = TEX_RES;

function outline(ctx: CanvasRenderingContext2D, lw = 2.4): void {
  ctx.lineWidth = lw * R;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Procedurally drawn heads for characters without reference art. Size ~ 64x70 base units. */
export function paintProceduralHeads(scene: Phaser.Scene): void {
  // Mutant (spitter / minion): green blob with big mouth and glowing eyes
  {
    const { ctx, tex } = makeCanvas(scene, 'head-mutant', 70 * R, 72 * R);
    ctx.beginPath();
    ctx.moveTo(35 * R, 4 * R);
    ctx.bezierCurveTo(64 * R, 4 * R, 68 * R, 40 * R, 60 * R, 58 * R);
    ctx.bezierCurveTo(50 * R, 72 * R, 20 * R, 72 * R, 10 * R, 58 * R);
    ctx.bezierCurveTo(2 * R, 40 * R, 6 * R, 4 * R, 35 * R, 4 * R);
    const g = ctx.createRadialGradient(28 * R, 22 * R, 2, 35 * R, 38 * R, 40 * R);
    g.addColorStop(0, '#c6ff8a');
    g.addColorStop(1, '#4f9a32');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx);
    for (const [x, y, r] of [[18, 18, 4], [48, 14, 3], [56, 30, 3.5]]) {
      ctx.beginPath();
      ctx.arc(x * R, y * R, r * R, 0, Math.PI * 2);
      ctx.fillStyle = '#7ad04f';
      ctx.fill();
    }
    for (const x of [24, 46]) {
      ctx.beginPath();
      ctx.ellipse(x * R, 34 * R, 7 * R, 5 * R, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fff36b';
      ctx.fill();
      outline(ctx, 1.6);
      ctx.beginPath();
      ctx.arc((x + 1.5) * R, 34 * R, 2.4 * R, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(20 * R, 48 * R);
    ctx.quadraticCurveTo(35 * R, 64 * R, 52 * R, 48 * R);
    ctx.closePath();
    ctx.fillStyle = '#3a0f1f';
    ctx.fill();
    outline(ctx, 1.8);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((24 + i * 7) * R, 49 * R);
      ctx.lineTo((27 + i * 7) * R, 54 * R);
      ctx.lineTo((30 + i * 7) * R, 49 * R);
      ctx.fill();
    }
    tex.refresh();
  }
  // Scientist (mad doctor + clones): bald, wild white side hair, goggles
  {
    const { ctx, tex } = makeCanvas(scene, 'head-scientist', 74 * R, 76 * R);
    ctx.fillStyle = '#f2f4ff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const cx = 37 + side * 26;
      ctx.moveTo(cx * R, 22 * R);
      for (let i = 0; i < 5; i++) ctx.lineTo((cx + side * (8 + (i % 2) * 6)) * R, (24 + i * 7) * R);
      ctx.lineTo(cx * R, 58 * R);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 1.8);
    }
    ctx.beginPath();
    ctx.ellipse(37 * R, 40 * R, 26 * R, 32 * R, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(30 * R, 26 * R, 2, 37 * R, 40 * R, 34 * R);
    g.addColorStop(0, '#ffe8d6');
    g.addColorStop(1, '#e0a983');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx);
    // goggles
    ctx.fillStyle = '#2b2b3a';
    ctx.fillRect(11 * R, 32 * R, 52 * R, 6 * R);
    for (const x of [26, 48]) {
      ctx.beginPath();
      ctx.arc(x * R, 36 * R, 9 * R, 0, Math.PI * 2);
      const gg = ctx.createRadialGradient((x - 3) * R, 33 * R, 1, x * R, 36 * R, 9 * R);
      gg.addColorStop(0, '#e9dcff');
      gg.addColorStop(1, '#7c4dff');
      ctx.fillStyle = gg;
      ctx.fill();
      outline(ctx, 2.4);
    }
    // grin
    ctx.beginPath();
    ctx.moveTo(26 * R, 56 * R);
    ctx.quadraticCurveTo(37 * R, 64 * R, 50 * R, 55 * R);
    outline(ctx, 2);
    ctx.fillStyle = '#c98c6a';
    ctx.beginPath();
    ctx.ellipse(37 * R, 47 * R, 3 * R, 2.4 * R, 0, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
  // Hắc Ảnh: dark hood with glowing violet eyes and a crown-like circuit
  {
    const { ctx, tex } = makeCanvas(scene, 'head-shadow', 78 * R, 82 * R);
    ctx.beginPath();
    ctx.moveTo(39 * R, 2 * R);
    ctx.bezierCurveTo(72 * R, 6 * R, 78 * R, 50 * R, 70 * R, 80 * R);
    ctx.lineTo(8 * R, 80 * R);
    ctx.bezierCurveTo(0, 50 * R, 6 * R, 6 * R, 39 * R, 2 * R);
    const g = ctx.createLinearGradient(0, 0, 0, 82 * R);
    g.addColorStop(0, '#3a2361');
    g.addColorStop(1, '#120a22');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.ellipse(39 * R, 46 * R, 22 * R, 26 * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#05030a';
    ctx.fill();
    for (const x of [30, 48]) {
      ctx.save();
      ctx.shadowColor = '#d07bff';
      ctx.shadowBlur = 10 * R;
      ctx.beginPath();
      ctx.moveTo((x - 7) * R, 42 * R);
      ctx.lineTo((x + 7) * R, 40 * R);
      ctx.lineTo((x + 4) * R, 46 * R);
      ctx.closePath();
      ctx.fillStyle = '#f2d4ff';
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#b44dff';
    ctx.lineWidth = 2 * R;
    ctx.beginPath();
    ctx.moveTo(22 * R, 16 * R);
    ctx.lineTo(39 * R, 8 * R);
    ctx.lineTo(56 * R, 16 * R);
    ctx.moveTo(39 * R, 8 * R);
    ctx.lineTo(39 * R, 20 * R);
    ctx.stroke();
    tex.refresh();
  }
  // Civilian heads (rescue NPCs) — 3 variants
  const civ = [
    { hair: 0x3b2516, skin: 0xffd9bf, bun: true },
    { hair: 0x9a5a2a, skin: 0xf1c6a4, bun: false },
    { hair: 0x222222, skin: 0xe8b48f, bun: false },
  ];
  civ.forEach((c, i) => {
    const { ctx, tex } = makeCanvas(scene, `head-civ${i}`, 64 * R, 66 * R);
    ctx.beginPath();
    ctx.ellipse(32 * R, 36 * R, 24 * R, 27 * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = hex(c.skin);
    ctx.fill();
    outline(ctx);
    ctx.beginPath();
    ctx.ellipse(32 * R, 22 * R, 26 * R, 17 * R, 0, Math.PI, 0);
    ctx.lineTo(58 * R, 32 * R);
    ctx.quadraticCurveTo(32 * R, 22 * R, 6 * R, 32 * R);
    ctx.closePath();
    ctx.fillStyle = hex(c.hair);
    ctx.fill();
    outline(ctx, 2);
    if (c.bun) {
      ctx.beginPath();
      ctx.arc(32 * R, 6 * R, 8 * R, 0, Math.PI * 2);
      ctx.fillStyle = hex(c.hair);
      ctx.fill();
      outline(ctx, 2);
    }
    for (const x of [24, 40]) {
      ctx.beginPath();
      ctx.ellipse(x * R, 40 * R, 3.4 * R, 4.4 * R, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(32 * R, 53 * R, 3.5 * R, 4.2 * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#7a2e2e';
    ctx.fill();
    tex.refresh();
  });
}

export function paintEffects(scene: Phaser.Scene): void {
  // soft shadow
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-shadow', 64, 24);
    const g = ctx.createRadialGradient(32, 12, 2, 32, 12, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 0.375);
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.restore();
    ctx.fillRect(0, 0, 64, 24);
    tex.refresh();
  }
  // hit spark star
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-spark', 96, 96);
    ctx.translate(48, 48);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 === 0 ? 46 : 14;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#fff4b0');
    g.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = g;
    ctx.fill();
    tex.refresh();
  }
  // glow dot (particles / tints)
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-glow', 64, 64);
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    tex.refresh();
  }
  // ring
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-ring', 128, 128);
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    tex.refresh();
  }
  // slash arc
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-slash', 128, 128);
    ctx.translate(64, 64);
    ctx.beginPath();
    ctx.arc(0, 0, 54, -1.2, 1.2);
    ctx.arc(10, 0, 40, 1.1, -1.1, true);
    ctx.closePath();
    const g = ctx.createLinearGradient(-50, 0, 60, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fill();
    tex.refresh();
  }
  // dust puff
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-dust', 48, 48);
    const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, 'rgba(230,220,210,0.9)');
    g.addColorStop(1, 'rgba(230,220,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 48, 48);
    tex.refresh();
  }
  // rain drop / snow flake
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-rain', 4, 28);
    const g = ctx.createLinearGradient(0, 0, 0, 28);
    g.addColorStop(0, 'rgba(180,210,255,0)');
    g.addColorStop(1, 'rgba(200,225,255,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(1, 0, 2, 28);
    tex.refresh();
  }
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-snow', 12, 12);
    const g = ctx.createRadialGradient(6, 6, 0, 6, 6, 6);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 12, 12);
    tex.refresh();
  }
  // projectile blobs
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-orb', 40, 40);
    const g = ctx.createRadialGradient(16, 16, 1, 20, 20, 19);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    tex.refresh();
  }
  {
    const { ctx, tex } = makeCanvas(scene, 'fx-sonic', 40, 64);
    ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 5 - i;
      ctx.globalAlpha = 1 - i * 0.28;
      ctx.beginPath();
      ctx.arc(4 + i * 10, 32, 26 - i * 4, -1, 1);
      ctx.stroke();
    }
    tex.refresh();
  }
}

export function paintPickups(scene: Phaser.Scene): void {
  const orb = (key: string, color: number, draw: (ctx: CanvasRenderingContext2D) => void): void => {
    const { ctx, tex } = makeCanvas(scene, key, 30 * R, 30 * R);
    ctx.save();
    ctx.shadowColor = hex(color);
    ctx.shadowBlur = 8 * R;
    ctx.beginPath();
    ctx.arc(15 * R, 15 * R, 11 * R, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(11 * R, 10 * R, 1, 15 * R, 15 * R, 12 * R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, hex(shade(color, 1.3)));
    g.addColorStop(1, hex(shade(color, 0.7)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2 * R;
    ctx.strokeStyle = INK;
    ctx.stroke();
    draw(ctx);
    tex.refresh();
  };
  orb('pickup-health', 0xff4d6d, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(15 * R, 21 * R);
    ctx.bezierCurveTo(5 * R, 14 * R, 9 * R, 7 * R, 15 * R, 11 * R);
    ctx.bezierCurveTo(21 * R, 7 * R, 25 * R, 14 * R, 15 * R, 21 * R);
    ctx.fill();
  });
  orb('pickup-energy', 0x3fa9ff, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(17 * R, 6 * R);
    ctx.lineTo(10 * R, 16 * R);
    ctx.lineTo(15 * R, 16 * R);
    ctx.lineTo(13 * R, 24 * R);
    ctx.lineTo(20 * R, 13 * R);
    ctx.lineTo(15 * R, 13 * R);
    ctx.closePath();
    ctx.fill();
  });
  orb('pickup-token', 0xffc61a, (ctx) => {
    ctx.fillStyle = '#7a4d00';
    ctx.font = `bold ${12 * R}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 15 * R, 16 * R);
  });
}

/** Props used by hazards & mechanics. */
export function paintProps(scene: Phaser.Scene): void {
  // street sign (falling object)
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-sign', 70 * R, 60 * R);
    roundRect(ctx, 4 * R, 4 * R, 62 * R, 36 * R, 5 * R);
    ctx.fillStyle = '#ff3d7f';
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${13 * R}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('KARAOKE', 35 * R, 27 * R);
    ctx.fillStyle = '#555';
    ctx.fillRect(18 * R, 40 * R, 4 * R, 18 * R);
    ctx.fillRect(48 * R, 40 * R, 4 * R, 18 * R);
    tex.refresh();
  }
  // icicle
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-icicle', 30 * R, 70 * R);
    ctx.beginPath();
    ctx.moveTo(2 * R, 2 * R);
    ctx.lineTo(28 * R, 2 * R);
    ctx.lineTo(15 * R, 68 * R);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 30 * R, 0);
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(1, '#7fc8f0');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx, 2);
    tex.refresh();
  }
  // shipping container
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-container', 150 * R, 70 * R);
    roundRect(ctx, 2 * R, 2 * R, 146 * R, 66 * R, 3 * R);
    ctx.fillStyle = '#c0392b';
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = '#7f241a';
    ctx.lineWidth = 2 * R;
    for (let x = 10; x < 146; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x * R, 6 * R);
      ctx.lineTo(x * R, 64 * R);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${12 * R}px Arial`;
    ctx.fillText('ÁNH DƯƠNG', 40 * R, 40 * R);
    tex.refresh();
  }
  // shelf
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-shelf', 180 * R, 90 * R);
    roundRect(ctx, 2 * R, 2 * R, 176 * R, 86 * R, 4 * R);
    ctx.fillStyle = '#8a5a35';
    ctx.fill();
    outline(ctx);
    const colors = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2'];
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = '#5c3a20';
      ctx.fillRect(6 * R, (8 + row * 27) * R, 168 * R, 3 * R);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = colors[(i + row) % colors.length];
        ctx.fillRect((10 + i * 18) * R, (12 + row * 27) * R, 13 * R, 20 * R);
      }
    }
    tex.refresh();
  }
  // subway train
  {
    const w = 900;
    const { ctx, tex } = makeCanvas(scene, 'prop-train', w * R, 150 * R);
    roundRect(ctx, 2 * R, 10 * R, (w - 4) * R, 136 * R, 26 * R);
    const g = ctx.createLinearGradient(0, 0, 0, 150 * R);
    g.addColorStop(0, '#dfe7ef');
    g.addColorStop(1, '#8a99a8');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = '#d6303a';
    ctx.fillRect(4 * R, 92 * R, (w - 8) * R, 14 * R);
    for (let x = 60; x < w - 60; x += 90) {
      roundRect(ctx, x * R, 30 * R, 64 * R, 46 * R, 6 * R);
      ctx.fillStyle = '#ffe9a8';
      ctx.fill();
      outline(ctx, 2);
    }
    ctx.fillStyle = '#fff7b0';
    ctx.beginPath();
    ctx.arc((w - 22) * R, 110 * R, 9 * R, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
  }
  // pillar (energy / ice / chaos) — tinted at runtime
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-pillar', 56 * R, 150 * R);
    roundRect(ctx, 4 * R, 120 * R, 48 * R, 26 * R, 4 * R);
    ctx.fillStyle = '#4a4f63';
    ctx.fill();
    outline(ctx);
    roundRect(ctx, 12 * R, 10 * R, 32 * R, 114 * R, 12 * R);
    const g = ctx.createLinearGradient(12 * R, 0, 44 * R, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#d8d8d8');
    g.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = g;
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = 'rgba(40,40,60,0.5)';
    ctx.lineWidth = 2 * R;
    for (let y = 30; y < 120; y += 22) {
      ctx.beginPath();
      ctx.moveTo(14 * R, y * R);
      ctx.lineTo(42 * R, (y + 8) * R);
      ctx.stroke();
    }
    tex.refresh();
  }
  // heater (warm zone)
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-heater', 70 * R, 60 * R);
    roundRect(ctx, 4 * R, 8 * R, 62 * R, 48 * R, 8 * R);
    ctx.fillStyle = '#5a3a2a';
    ctx.fill();
    outline(ctx);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#ff8a3d' : '#ffd23f';
      ctx.fillRect((12 + i * 12) * R, 18 * R, 8 * R, 28 * R);
    }
    tex.refresh();
  }
  // steam vent
  {
    const { ctx, tex } = makeCanvas(scene, 'prop-vent', 80 * R, 30 * R);
    ctx.beginPath();
    ctx.ellipse(40 * R, 15 * R, 36 * R, 11 * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3f4c';
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = '#1a1d24';
    ctx.lineWidth = 3 * R;
    for (let x = 18; x <= 62; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x * R, 8 * R);
      ctx.lineTo(x * R, 22 * R);
      ctx.stroke();
    }
    tex.refresh();
  }
  // bat drone body (flyer enemy)
  {
    const { ctx, tex } = makeCanvas(scene, 'enemy-bat-body', 60 * R, 56 * R);
    ctx.beginPath();
    ctx.ellipse(30 * R, 30 * R, 18 * R, 20 * R, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2350';
    ctx.fill();
    outline(ctx);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo((30 + s * 10) * R, 14 * R);
      ctx.lineTo((30 + s * 16) * R, 0);
      ctx.lineTo((30 + s * 18) * R, 18 * R);
      ctx.closePath();
      ctx.fillStyle = '#3a2350';
      ctx.fill();
      outline(ctx, 2);
      ctx.beginPath();
      ctx.arc((30 + s * 7) * R, 28 * R, 4 * R, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b6b';
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(25 * R, 40 * R);
    ctx.lineTo(27 * R, 46 * R);
    ctx.lineTo(29 * R, 40 * R);
    ctx.moveTo(31 * R, 40 * R);
    ctx.lineTo(33 * R, 46 * R);
    ctx.lineTo(35 * R, 40 * R);
    ctx.fill();
    tex.refresh();
  }
  {
    const { ctx, tex } = makeCanvas(scene, 'enemy-bat-wing', 60 * R, 40 * R);
    ctx.beginPath();
    ctx.moveTo(2 * R, 6 * R);
    ctx.quadraticCurveTo(30 * R, 0, 58 * R, 8 * R);
    ctx.lineTo(50 * R, 26 * R);
    ctx.quadraticCurveTo(44 * R, 18 * R, 38 * R, 30 * R);
    ctx.quadraticCurveTo(30 * R, 20 * R, 22 * R, 36 * R);
    ctx.quadraticCurveTo(14 * R, 22 * R, 2 * R, 6 * R);
    ctx.closePath();
    ctx.fillStyle = '#5a3a7a';
    ctx.fill();
    outline(ctx, 2);
    tex.refresh();
  }
}
