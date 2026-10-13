/** Layout width every menu is designed for. */
export const BASE_W = 1280;

/**
 * Game width adapts to the device's landscape aspect (16:9 … ~20:9) so phones are filled edge to edge
 * instead of showing black bars. Height stays 720.
 */
function deviceWidth(): number {
  if (typeof window === 'undefined') return BASE_W;
  const w = Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0, window.innerWidth, window.innerHeight);
  const h = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (!touch || !h) return BASE_W;
  const aspect = Math.min(2.25, Math.max(16 / 9, w / h));
  return Math.round((720 * aspect) / 2) * 2;
}

export const GAME_W = deviceWidth();
/** Horizontal offset that centres a BASE_W-wide menu layout on a wider screen. */
export const UI_OFFSET = (GAME_W - BASE_W) / 2;
export const GAME_H = 720;
/** Walkable floor band (world y = lane depth) */
export const FLOOR_TOP = 452;
export const FLOOR_BOTTOM = 690;
export const SEGMENT_W = 1280;
/** Rig base scale for heroes */
export const HERO_SCALE = 1.15;
/** Texture super-sampling factor for procedurally drawn parts */
export const TEX_RES = 2;
export const GRAVITY = 2200;
export const MAX_ENEMIES_ON_SCREEN = 12;
export const MAX_SIMULTANEOUS_ATTACKERS = 2;

export const FONT = '"Baloo 2", "Segoe UI", system-ui, sans-serif';
export const COLORS = {
  ink: 0x0b1230,
  panel: 0x13204a,
  panelLight: 0x1d3170,
  gold: 0xffd23f,
  red: 0xff4d4d,
  green: 0x4dff88,
  blue: 0x3fa9ff,
  white: 0xffffff,
};
