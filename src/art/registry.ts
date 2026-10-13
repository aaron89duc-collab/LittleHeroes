import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters';
import type { CharacterId } from '../types/game';
import { paintBackground } from './BackgroundArt';
import { paintEffects, paintPickups, paintProceduralHeads, paintProps } from './MiscArt';
import { paintPartSet, paintTail, type PartSpec } from './PartArt';
import userAssets from '../config/userAssets.json';

/** Head textures: reference-art crops (loaded as PNG) + procedural ones. */
export interface HeadInfo {
  key: string;
  height: number;
  anchorY: number;
  offsetX?: number;
}

export const HEADS: Record<string, HeadInfo> = {
  'head-dau-dau': { key: 'head-dau-dau', height: 86, anchorY: 0.95 },
  'head-shu-shu': { key: 'head-shu-shu', height: 84, anchorY: 0.95, offsetX: 2 },
  'head-bap': { key: 'head-bap', height: 86, anchorY: 0.95 },
  'head-thug': { key: 'head-thug', height: 54, anchorY: 0.86 },
  'head-punk': { key: 'head-punk', height: 60, anchorY: 0.88 },
  'head-swat': { key: 'head-swat', height: 52, anchorY: 0.88 },
  'head-masked': { key: 'head-masked', height: 52, anchorY: 0.88 },
  'head-robot': { key: 'head-robot', height: 46, anchorY: 0.86 },
  'head-sniper': { key: 'head-sniper', height: 52, anchorY: 0.86 },
  'head-boss': { key: 'head-boss', height: 56, anchorY: 0.8 },
  'head-mutant': { key: 'head-mutant', height: 56, anchorY: 0.92 },
  'head-scientist': { key: 'head-scientist', height: 60, anchorY: 0.92 },
  'head-shadow': { key: 'head-shadow', height: 64, anchorY: 0.96 },
  'head-civ0': { key: 'head-civ0', height: 56, anchorY: 0.95 },
  'head-civ1': { key: 'head-civ1', height: 56, anchorY: 0.95 },
  'head-civ2': { key: 'head-civ2', height: 56, anchorY: 0.95 },
};

/** Files cropped from the user's reference sheet (tools/extract.py). */
export const IMAGE_FILES: Record<string, string> = {
  'head-dau-dau': 'assets/characters/dau-dau-head.png',
  'head-shu-shu': 'assets/characters/shu-shu-head.png',
  'head-bap': 'assets/characters/bap-head.png',
  'portrait-dau-dau': 'assets/characters/dau-dau-portrait.png',
  'portrait-shu-shu': 'assets/characters/shu-shu-portrait.png',
  'portrait-bap': 'assets/characters/bap-portrait.png',
  'head-thug': 'assets/enemies/thug-head.png',
  'head-punk': 'assets/enemies/punk-head.png',
  'head-swat': 'assets/enemies/swat-head.png',
  'head-masked': 'assets/enemies/masked-head.png',
  'head-robot': 'assets/enemies/robot-head.png',
  'head-sniper': 'assets/enemies/sniper-head.png',
  'head-boss': 'assets/enemies/boss-head.png',
  'card-city': 'assets/backgrounds/card-city.jpg',
  'card-port': 'assets/backgrounds/card-port.jpg',
  'card-factory': 'assets/backgrounds/card-factory.jpg',
  'card-ice': 'assets/backgrounds/card-ice.jpg',
  'card-subway': 'assets/backgrounds/card-subway.jpg',
  'card-tower': 'assets/backgrounds/card-tower.jpg',
};

const heroSpec = (id: CharacterId): PartSpec => {
  const p = CHARACTERS[id].palette;
  return {
    key: `rig-${id}`, suit: p.suit, suitDark: p.suitDark, vest: p.vest, glove: p.glove, boot: p.boot, skin: p.skin,
    pants: id === 'shu-shu' ? 0x23232c : p.suitDark, accent: p.accent, sleeves: 'long', torso: 'hero', badge: 'POLICE',
  };
};

const S = (key: string, o: Partial<PartSpec> & Pick<PartSpec, 'suit' | 'torso'>): PartSpec => ({
  key,
  suitDark: 0x222222,
  vest: 0x222222,
  glove: 0x2a2a2a,
  boot: 0x1a1a1a,
  skin: 0xe8a77a,
  pants: 0x2a2a35,
  accent: 0xd62f2f,
  sleeves: 'none',
  ...o,
});

/** Part sets keyed by rig id. Enemies & bosses reference these by `rigKey`. */
export const PART_SPECS: PartSpec[] = [
  heroSpec('dau-dau'),
  heroSpec('shu-shu'),
  heroSpec('bap'),
  S('rig-thug', { suit: 0x3b5a7a, torso: 'vest', pants: 0x2b2b38, glove: 0xe8a77a }),
  S('rig-punk', { suit: 0x1f1f24, torso: 'tank', pants: 0x34495e, glove: 0xe9a679, skin: 0xe9a679 }),
  S('rig-brute', { suit: 0x26262c, torso: 'tank', pants: 0x5a4a2a, glove: 0x3a2a2a, skin: 0xd88f62, bulk: 1.25 }),
  S('rig-swat', { suit: 0x343a46, torso: 'armor', vest: 0x23272f, sleeves: 'long', pants: 0x2a2f3a, glove: 0x1a1a1a, accent: 0x9b59ff }),
  S('rig-robot', { suit: 0x6a7b95, torso: 'robot', sleeves: 'long', pants: 0x4a5870, glove: 0x8fa3c2, boot: 0x2b3446, accent: 0xffb02e }),
  S('rig-mutant', { suit: 0x2f4a2a, torso: 'mutant', skin: 0x8fd16a, glove: 0x8fd16a, pants: 0x2f3a2a, accent: 0xb6ff3b }),
  S('rig-summoner', { suit: 0x2a3a2a, torso: 'armor', vest: 0x1d2a1d, sleeves: 'long', pants: 0x22301f, accent: 0x6bff9b }),
  S('rig-coat', { suit: 0xeef2f7, suitDark: 0x8a96a8, torso: 'coat', sleeves: 'long', pants: 0x3a3a48, glove: 0xffd9bf, accent: 0x7c4dff }),
  S('rig-screamer', { suit: 0x2b2440, torso: 'jacket', sleeves: 'long', pants: 0x1d1a2a, accent: 0xc77dff, glove: 0x1a1a1a }),
  S('rig-civ', { suit: 0x5fa8d3, torso: 'tank', sleeves: 'short', pants: 0x3a4a6a, skin: 0xffd9bf, glove: 0xffd9bf, boot: 0x5a3a2a }),
  // bosses
  S('rig-streetBoss', { suit: 0x26262c, torso: 'tank', pants: 0x3a3a2a, glove: 0xb32020, skin: 0xd88f62, bulk: 1.35 }),
  S('rig-mechaBear', { suit: 0x6b7b95, torso: 'robot', sleeves: 'long', pants: 0x4a5870, glove: 0xa8b8d0, boot: 0x343e52, accent: 0xffb02e, bulk: 1.45 }),
  S('rig-giant', { suit: 0x3c6b2a, torso: 'mutant', skin: 0x7fc65a, glove: 0x6fb64a, pants: 0x3a2a1a, accent: 0xb6ff3b, bulk: 1.5 }),
  S('rig-madDoctor', { suit: 0xeef2f7, torso: 'coat', sleeves: 'long', pants: 0x3a3a48, glove: 0x7c4dff, accent: 0x7c4dff }),
  S('rig-iceKing', { suit: 0x7fc8f0, torso: 'armor', vest: 0x2e6b94, sleeves: 'long', pants: 0x2e6b94, glove: 0xbff4ff, boot: 0x1e4b6a, accent: 0xbff4ff, bulk: 1.3 }),
  S('rig-twinA', { suit: 0x3a1d5c, torso: 'armor', vest: 0x1c0e2e, sleeves: 'long', pants: 0x2a1640, glove: 0xff7a00, accent: 0xff7a00, bulk: 1.45 }),
  S('rig-twinB', { suit: 0x1d3a5c, torso: 'jacket', sleeves: 'long', pants: 0x0e1c2e, glove: 0x00e5ff, accent: 0x00e5ff }),
  S('rig-darkShadow', { suit: 0x1a0f2e, torso: 'cloak', sleeves: 'long', pants: 0x0a0614, glove: 0xb44dff, boot: 0x0a0614, accent: 0xb44dff, bulk: 1.1 }),
  S('rig-darkBeast', { suit: 0x2a0f4a, torso: 'mutant', skin: 0x6a3aa8, glove: 0xb44dff, pants: 0x1a0a2a, accent: 0xff3bd4, bulk: 1.6 }),
];

/** Which rig body each enemy id uses. */
export const ENEMY_RIG: Record<string, string> = {
  grunt: 'rig-thug',
  runner: 'rig-punk',
  brute: 'rig-brute',
  leaper: 'rig-swat',
  spitter: 'rig-mutant',
  screamer: 'rig-screamer',
  robot: 'rig-robot',
  summoner: 'rig-summoner',
  minion: 'rig-mutant',
  clone: 'rig-coat',
  elite: 'rig-brute',
};

export function loadReferenceImages(scene: Phaser.Scene): void {
  for (const [key, file] of Object.entries(IMAGE_FILES)) scene.load.image(key, file);
  loadUserAssets(scene);
}

/** Art from the user's asset packs (tools/import_user_assets.py → src/config/userAssets.json). */
function loadUserAssets(scene: Phaser.Scene): void {
  const bgs = userAssets.backgrounds as Record<string, Partial<Record<'far' | 'mid' | 'floor', string>>>;
  for (const [theme, layers] of Object.entries(bgs)) {
    for (const layer of ['far', 'mid', 'floor'] as const) {
      const f = layers[layer];
      if (f) scene.load.image(`bg-${theme}-${layer}`, f);
    }
    if (layers.mid) scene.load.image(`card-img-${theme}`, `assets/backgrounds/card-img-${theme}.jpg`);
  }
  for (const [key, file] of Object.entries(userAssets.icons as Record<string, string>)) scene.load.image(key, file);
  (userAssets.commander as string[]).forEach((file, i) => scene.load.image(`commander-${i + 1}`, file));
  // enemy/boss sheets are loaded per stage (systems/StageAssets.ts) to keep GPU memory low
}

/** Paint everything procedural. Missing reference images are replaced with placeholders + a console warning. */
export function paintAllArt(scene: Phaser.Scene): void {
  for (const key of Object.keys(IMAGE_FILES)) {
    if (!scene.textures.exists(key) || scene.textures.get(key).key === '__MISSING') {
      console.warn(`[assets] Missing texture "${key}" – using placeholder.`);
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xff00ff).fillCircle(32, 32, 30);
      g.generateTexture(key, 64, 64);
      g.destroy();
    }
  }
  paintProceduralHeads(scene);
  paintHeroFaces(scene);
  for (const spec of PART_SPECS) paintPartSet(scene, spec);
  paintTail(scene, 'tail-shu-shu', CHARACTERS['shu-shu'].palette.tail ?? 0xb87a3e);
  paintEffects(scene);
  paintPickups(scene);
  paintProps(scene);
}

/** Circular face badges for the HUD (avoids a per-frame stencil mask). */
function paintHeroFaces(scene: Phaser.Scene): void {
  for (const id of ['dau-dau', 'shu-shu', 'bap'] as CharacterId[]) {
    const src = scene.textures.get(`head-${id}`).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const S = 128;
    const key = `face-${id}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, S, S);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#' + CHARACTERS[id].palette.suit.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, S, S);
    const k = (S * 1.05) / src.height;
    const w = src.width * k;
    ctx.drawImage(src, (S - w) / 2, S * 0.02, w, src.height * k);
    ctx.restore();
    tex.refresh();
  }
}

export { paintBackground };
