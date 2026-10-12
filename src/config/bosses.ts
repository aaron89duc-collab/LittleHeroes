import type { BossConfig } from '../types/game';

/**
 * Boss roster. Each boss has ≥3 distinct actions, at least one heavy telegraphed move (≥500 ms warning)
 * and recovery windows to counter-attack (GDD §8.3).
 */
export const BOSSES: Record<string, BossConfig> = {
  streetBoss: {
    id: 'streetBoss', name: 'Kẻ Cầm Đầu Phố', maxHp: 420, moveSpeed: 85, damageReceivedMultiplier: 1, scale: 1.7,
    body: 'humanoid', head: 'head-boss', palette: { body: 0x2a2a30, dark: 0x141418, skin: 0xd88f62, accent: 0xd62f2f },
    maxStaggerPerWindow: 4, score: 3000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'combo', damage: 9, telegraphMs: 420, recoveryMs: 700, weight: 3, count: 2 },
        { kind: 'charge', damage: 14, telegraphMs: 650, recoveryMs: 900, weight: 2 },
        { kind: 'slam', damage: 16, telegraphMs: 800, recoveryMs: 1000, weight: 1, range: 150 },
      ] },
      { hpBelow: 0.5, speedMul: 1.2, damageMul: 1.15, message: 'Kẻ Cầm Đầu Phố nổi giận!', moves: [
        { kind: 'combo', damage: 10, telegraphMs: 380, recoveryMs: 650, weight: 3, count: 3 },
        { kind: 'charge', damage: 15, telegraphMs: 600, recoveryMs: 850, weight: 2 },
        { kind: 'slam', damage: 18, telegraphMs: 750, recoveryMs: 950, weight: 2, range: 170 },
      ] },
    ],
  },
  mechaBear: {
    id: 'mechaBear', name: 'Gấu Máy', maxHp: 520, moveSpeed: 75, damageReceivedMultiplier: 0.95, scale: 1.9,
    body: 'bear', head: 'head-robot', palette: { body: 0x6b7b95, dark: 0x343e52, skin: 0xa8b8d0, accent: 0xffb02e },
    maxStaggerPerWindow: 3, score: 3500,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'slam', damage: 15, telegraphMs: 800, recoveryMs: 950, weight: 2, range: 140 },
        { kind: 'combo', damage: 11, telegraphMs: 500, recoveryMs: 750, weight: 3, count: 1 },
        { kind: 'charge', damage: 15, telegraphMs: 700, recoveryMs: 1000, weight: 2 },
        { kind: 'curl', damage: 0, telegraphMs: 300, recoveryMs: 400, weight: 1 },
      ] },
      { hpBelow: 0.45, speedMul: 1.2, damageMul: 1.15, message: 'Gấu Máy quá tải động cơ!', moves: [
        { kind: 'slam', damage: 17, telegraphMs: 700, recoveryMs: 900, weight: 2, range: 160 },
        { kind: 'charge', damage: 16, telegraphMs: 600, recoveryMs: 900, weight: 3 },
        { kind: 'combo', damage: 12, telegraphMs: 450, recoveryMs: 700, weight: 2, count: 2 },
        { kind: 'curl', damage: 0, telegraphMs: 300, recoveryMs: 400, weight: 1 },
      ] },
    ],
  },
  spiderQueen: {
    id: 'spiderQueen', name: 'Nhện Chúa', maxHp: 560, moveSpeed: 95, damageReceivedMultiplier: 1, scale: 1.6,
    body: 'spider', head: 'head-mutant', palette: { body: 0x3a2350, dark: 0x1a0f26, skin: 0x8b5cc8, accent: 0xff3bd4 },
    maxStaggerPerWindow: 3, score: 4000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'leap', damage: 16, telegraphMs: 800, recoveryMs: 900, weight: 3 },
        { kind: 'projectile', damage: 6, telegraphMs: 550, recoveryMs: 700, weight: 2, count: 1, color: 0xf0f0ff },
        { kind: 'summon', damage: 0, telegraphMs: 700, recoveryMs: 600, weight: 1, count: 2, summon: 'minion' },
        { kind: 'combo', damage: 10, telegraphMs: 420, recoveryMs: 700, weight: 2, count: 2 },
      ] },
      { hpBelow: 0.5, speedMul: 1.2, damageMul: 1.1, message: 'Nhện Chúa gọi cả đàn!', moves: [
        { kind: 'leap', damage: 17, telegraphMs: 700, recoveryMs: 850, weight: 3 },
        { kind: 'projectile', damage: 7, telegraphMs: 500, recoveryMs: 650, weight: 2, count: 3, color: 0xf0f0ff },
        { kind: 'summon', damage: 0, telegraphMs: 650, recoveryMs: 600, weight: 2, count: 3, summon: 'minion' },
      ] },
    ],
  },
  giant: {
    id: 'giant', name: 'Người Khổng Lồ Đột Biến', maxHp: 680, moveSpeed: 70, damageReceivedMultiplier: 1, scale: 2.1,
    body: 'humanoid', head: 'head-punk', palette: { body: 0x3c6b2a, dark: 0x1d3614, skin: 0x7fc65a, accent: 0xb6ff3b },
    maxStaggerPerWindow: 2, score: 4500, armored: true,
    phases: [
      { hpBelow: 1, speedMul: 0.85, damageMul: 1, moves: [
        { kind: 'combo', damage: 13, telegraphMs: 650, recoveryMs: 950, weight: 3, count: 1 },
        { kind: 'slam', damage: 16, telegraphMs: 850, recoveryMs: 1000, weight: 2, range: 150 },
      ] },
      { hpBelow: 0.66, speedMul: 1.15, damageMul: 1.1, message: 'Người Khổng Lồ tăng tốc!', moves: [
        { kind: 'charge', damage: 16, telegraphMs: 650, recoveryMs: 900, weight: 3 },
        { kind: 'slam', damage: 18, telegraphMs: 750, recoveryMs: 950, weight: 2, range: 170 },
        { kind: 'combo', damage: 13, telegraphMs: 550, recoveryMs: 850, weight: 1, count: 1 },
      ] },
      { hpBelow: 0.33, speedMul: 1.25, damageMul: 1.2, message: 'Người Khổng Lồ NỔI GIẬN!', moves: [
        { kind: 'combo', damage: 13, telegraphMs: 500, recoveryMs: 1500, weight: 3, count: 3 },
        { kind: 'charge', damage: 17, telegraphMs: 600, recoveryMs: 1000, weight: 2 },
        { kind: 'slam', damage: 19, telegraphMs: 700, recoveryMs: 1100, weight: 2, range: 180 },
      ] },
    ],
  },
  seaBeast: {
    id: 'seaBeast', name: 'Thủy Quái', maxHp: 700, moveSpeed: 80, damageReceivedMultiplier: 1, scale: 1.8,
    body: 'crab', head: 'none', palette: { body: 0xd9532b, dark: 0x7a2412, skin: 0xffb08a, accent: 0x3fd5ff },
    maxStaggerPerWindow: 3, score: 5000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'combo', damage: 12, telegraphMs: 520, recoveryMs: 800, weight: 3, count: 2 },
        { kind: 'slam', damage: 15, telegraphMs: 750, recoveryMs: 900, weight: 2, range: 160 },
        { kind: 'wave', damage: 14, telegraphMs: 800, recoveryMs: 900, weight: 2, color: 0x3fd5ff },
      ] },
      { hpBelow: 0.5, speedMul: 1.15, damageMul: 1.15, message: 'Thủy Quái khuấy động sóng dữ!', moves: [
        { kind: 'wave', damage: 15, telegraphMs: 700, recoveryMs: 850, weight: 3, count: 2, color: 0x3fd5ff },
        { kind: 'charge', damage: 15, telegraphMs: 650, recoveryMs: 900, weight: 2 },
        { kind: 'combo', damage: 13, telegraphMs: 480, recoveryMs: 750, weight: 2, count: 2 },
      ] },
    ],
  },
  madDoctor: {
    id: 'madDoctor', name: 'Tiến Sĩ Điên', maxHp: 640, moveSpeed: 95, damageReceivedMultiplier: 1, scale: 1.45,
    body: 'humanoid', head: 'head-scientist', palette: { body: 0xeef2f7, dark: 0x8a96a8, skin: 0xffd9bf, accent: 0x7c4dff },
    maxStaggerPerWindow: 3, score: 5500,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'teleport', damage: 12, telegraphMs: 550, recoveryMs: 800, weight: 3 },
        { kind: 'combo', damage: 11, telegraphMs: 450, recoveryMs: 750, weight: 2, count: 2, color: 0x7c4dff },
        { kind: 'clones', damage: 0, telegraphMs: 700, recoveryMs: 700, weight: 2, count: 2, summon: 'clone' },
      ] },
      { hpBelow: 0.5, speedMul: 1.2, damageMul: 1.15, message: 'Tiến Sĩ Điên kích hoạt huyết thanh!', moves: [
        { kind: 'teleport', damage: 13, telegraphMs: 500, recoveryMs: 750, weight: 3 },
        { kind: 'clones', damage: 0, telegraphMs: 650, recoveryMs: 650, weight: 2, count: 3, summon: 'clone' },
        { kind: 'slam', damage: 16, telegraphMs: 750, recoveryMs: 900, weight: 2, range: 150, color: 0x7c4dff },
      ] },
    ],
  },
  batKing: {
    id: 'batKing', name: 'Dơi Chúa', maxHp: 700, moveSpeed: 120, damageReceivedMultiplier: 1, scale: 1.7,
    body: 'bat', head: 'none', palette: { body: 0x2e1a40, dark: 0x140b1e, skin: 0x6b4594, accent: 0xff3b6b },
    maxStaggerPerWindow: 3, score: 6000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'dive', damage: 16, telegraphMs: 750, recoveryMs: 1300, weight: 3 },
        { kind: 'projectile', damage: 10, telegraphMs: 600, recoveryMs: 800, weight: 2, count: 1, color: 0xff3b6b },
        { kind: 'summon', damage: 0, telegraphMs: 700, recoveryMs: 700, weight: 1, count: 2, summon: 'flyer' },
      ] },
      { hpBelow: 0.5, speedMul: 1.2, damageMul: 1.15, message: 'Dơi Chúa gào thét!', moves: [
        { kind: 'dive', damage: 17, telegraphMs: 650, recoveryMs: 1200, weight: 3, count: 2 },
        { kind: 'projectile', damage: 11, telegraphMs: 550, recoveryMs: 750, weight: 2, count: 3, color: 0xff3b6b },
        { kind: 'summon', damage: 0, telegraphMs: 650, recoveryMs: 700, weight: 1, count: 3, summon: 'flyer' },
      ] },
    ],
  },
  iceKing: {
    id: 'iceKing', name: 'Băng Vương', maxHp: 780, moveSpeed: 80, damageReceivedMultiplier: 1, scale: 1.9,
    body: 'humanoid', head: 'head-swat', palette: { body: 0x7fc8f0, dark: 0x2e6b94, skin: 0xd8f3ff, accent: 0xbff4ff },
    maxStaggerPerWindow: 3, score: 6500,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'iceWall', damage: 14, telegraphMs: 750, recoveryMs: 900, weight: 2, color: 0xbff4ff },
        { kind: 'freezeZone', damage: 8, telegraphMs: 800, recoveryMs: 800, weight: 2, range: 120, color: 0x9be7ff },
        { kind: 'combo', damage: 12, telegraphMs: 480, recoveryMs: 750, weight: 3, count: 2 },
      ] },
      { hpBelow: 0.5, speedMul: 1.15, damageMul: 1.15, message: 'Băng Vương triệu hồi bão tuyết!', moves: [
        { kind: 'blizzard', damage: 5, telegraphMs: 900, recoveryMs: 900, weight: 2, color: 0xe8fbff },
        { kind: 'iceWall', damage: 15, telegraphMs: 700, recoveryMs: 850, weight: 2, color: 0xbff4ff },
        { kind: 'freezeZone', damage: 9, telegraphMs: 700, recoveryMs: 750, weight: 2, range: 140, color: 0x9be7ff },
        { kind: 'combo', damage: 13, telegraphMs: 450, recoveryMs: 700, weight: 2, count: 2 },
      ] },
    ],
  },
  twinA: {
    id: 'twinA', name: 'Hộ Vệ Thạch', maxHp: 520, moveSpeed: 65, damageReceivedMultiplier: 0.95, scale: 1.9,
    body: 'humanoid', head: 'head-masked', palette: { body: 0x3a1d5c, dark: 0x1c0e2e, skin: 0x9a7a6a, accent: 0xff7a00 },
    maxStaggerPerWindow: 2, score: 4000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'slam', damage: 17, telegraphMs: 850, recoveryMs: 1000, weight: 3, range: 170, color: 0xff7a00 },
        { kind: 'combo', damage: 14, telegraphMs: 600, recoveryMs: 900, weight: 2, count: 1 },
        { kind: 'wave', damage: 14, telegraphMs: 800, recoveryMs: 900, weight: 1, color: 0xff7a00 },
      ] },
      { hpBelow: 0.5, speedMul: 1.15, damageMul: 1.1, moves: [
        { kind: 'slam', damage: 18, telegraphMs: 750, recoveryMs: 950, weight: 3, range: 190, color: 0xff7a00 },
        { kind: 'wave', damage: 15, telegraphMs: 700, recoveryMs: 850, weight: 2, count: 2, color: 0xff7a00 },
        { kind: 'combo', damage: 14, telegraphMs: 550, recoveryMs: 850, weight: 1, count: 2 },
      ] },
    ],
  },
  twinB: {
    id: 'twinB', name: 'Hộ Vệ Phong', maxHp: 420, moveSpeed: 140, damageReceivedMultiplier: 1.05, scale: 1.5,
    body: 'humanoid', head: 'head-sniper', palette: { body: 0x1d3a5c, dark: 0x0e1c2e, skin: 0x7a6a5a, accent: 0x00e5ff },
    maxStaggerPerWindow: 3, score: 4000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, moves: [
        { kind: 'combo', damage: 8, telegraphMs: 380, recoveryMs: 650, weight: 3, count: 4 },
        { kind: 'charge', damage: 14, telegraphMs: 550, recoveryMs: 800, weight: 2 },
        { kind: 'teleport', damage: 11, telegraphMs: 500, recoveryMs: 750, weight: 1 },
      ] },
      { hpBelow: 0.5, speedMul: 1.2, damageMul: 1.1, moves: [
        { kind: 'combo', damage: 9, telegraphMs: 350, recoveryMs: 600, weight: 3, count: 4 },
        { kind: 'charge', damage: 13, telegraphMs: 500, recoveryMs: 750, weight: 2, count: 2 },
        { kind: 'teleport', damage: 12, telegraphMs: 450, recoveryMs: 700, weight: 2 },
      ] },
    ],
  },
  darkShadow: {
    id: 'darkShadow', name: 'Tiến Sĩ Hắc Ảnh', maxHp: 1150, moveSpeed: 115, damageReceivedMultiplier: 1, scale: 1.55,
    body: 'humanoid', head: 'head-shadow', palette: { body: 0x1a0f2e, dark: 0x0a0614, skin: 0xc9b6ff, accent: 0xb44dff },
    maxStaggerPerWindow: 3, score: 12000,
    phases: [
      { hpBelow: 1, speedMul: 1, damageMul: 1, message: 'Tiến Sĩ Hắc Ảnh: "Tiến hóa là không thể ngăn cản!"', moves: [
        { kind: 'combo', damage: 10, telegraphMs: 420, recoveryMs: 650, weight: 3, count: 3, color: 0xb44dff },
        { kind: 'teleport', damage: 13, telegraphMs: 500, recoveryMs: 700, weight: 2 },
        { kind: 'charge', damage: 14, telegraphMs: 600, recoveryMs: 850, weight: 2 },
      ] },
      { hpBelow: 0.66, speedMul: 0.95, damageMul: 1.2, message: 'Hắc Ảnh biến thành quái vật khổng lồ!', moves: [
        { kind: 'slam', damage: 18, telegraphMs: 800, recoveryMs: 1000, weight: 3, range: 190, color: 0xb44dff },
        { kind: 'wave', damage: 15, telegraphMs: 750, recoveryMs: 900, weight: 2, count: 2, color: 0xb44dff },
        { kind: 'combo', damage: 14, telegraphMs: 550, recoveryMs: 850, weight: 2, count: 2 },
      ] },
      { hpBelow: 0.33, speedMul: 1.05, damageMul: 1.25, message: 'Lõi Hỗn Mang mất ổn định! Phá 3 trụ năng lượng!', moves: [
        { kind: 'slam', damage: 18, telegraphMs: 750, recoveryMs: 950, weight: 2, range: 200, color: 0xb44dff },
        { kind: 'wave', damage: 16, telegraphMs: 700, recoveryMs: 850, weight: 2, count: 2, color: 0xb44dff },
        { kind: 'teleport', damage: 15, telegraphMs: 500, recoveryMs: 750, weight: 2 },
        { kind: 'summon', damage: 0, telegraphMs: 700, recoveryMs: 700, weight: 1, count: 2, summon: 'clone' },
      ] },
    ],
  },
};

export function getBoss(id: string): BossConfig {
  const b = BOSSES[id];
  if (!b) throw new Error(`Unknown boss: ${id}`);
  return b;
}
