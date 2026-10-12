import type { EnemyConfig } from '../types/game';

/** Regular enemy roster. All numbers are baselines; StageConfig multiplies HP/damage per stage. */
export const ENEMIES: Record<string, EnemyConfig> = {
  grunt: {
    id: 'grunt', name: 'Tội phạm đường phố', archetype: 'grunt', maxHp: 40, moveSpeed: 85, damage: 6,
    damageReceivedMultiplier: 1, contactRange: 58, attackCooldownMs: 1300, telegraphMs: 380, scale: 1,
    head: 'head-thug', palette: { body: 0x3b4a5c, dark: 0x1d2530, skin: 0xe8a77a, accent: 0xd62f2f },
    score: 100, drops: { health: 0.08, energy: 0.1, token: 0.25 },
  },
  runner: {
    id: 'runner', name: 'Côn đồ', archetype: 'runner', maxHp: 32, moveSpeed: 170, damage: 5,
    damageReceivedMultiplier: 1.05, contactRange: 56, attackCooldownMs: 1500, telegraphMs: 420, scale: 0.95,
    head: 'head-punk', palette: { body: 0x1f1f24, dark: 0x101014, skin: 0xe9a679, accent: 0xff4d2e },
    score: 120, drops: { health: 0.06, energy: 0.14, token: 0.25 },
  },
  brute: {
    id: 'brute', name: 'Đầu gấu bọc giáp', archetype: 'brute', maxHp: 120, moveSpeed: 55, damage: 12,
    damageReceivedMultiplier: 0.9, contactRange: 70, attackCooldownMs: 2000, telegraphMs: 600, scale: 1.3,
    head: 'head-boss', palette: { body: 0x2a2a30, dark: 0x16161a, skin: 0xd88f62, accent: 0xb32020 },
    score: 300, drops: { health: 0.3, energy: 0.25, token: 0.5 }, armor: true,
  },
  leaper: {
    id: 'leaper', name: 'Đặc nhiệm biến chất', archetype: 'leaper', maxHp: 45, moveSpeed: 105, damage: 8,
    damageReceivedMultiplier: 1, contactRange: 60, attackCooldownMs: 1700, telegraphMs: 500, scale: 1,
    head: 'head-swat', palette: { body: 0x343a46, dark: 0x1a1d24, skin: 0x8a6a58, accent: 0x9b59ff },
    score: 160, drops: { health: 0.1, energy: 0.15, token: 0.3 },
  },
  flyer: {
    id: 'flyer', name: 'Dơi máy', archetype: 'flyer', maxHp: 28, moveSpeed: 125, damage: 6,
    damageReceivedMultiplier: 1.1, contactRange: 50, attackCooldownMs: 1800, telegraphMs: 520, scale: 1,
    head: 'bat', palette: { body: 0x3a2350, dark: 0x1c1028, skin: 0x7b4fa8, accent: 0xff3b6b },
    score: 140, drops: { health: 0.08, energy: 0.12, token: 0.3 },
  },
  spitter: {
    id: 'spitter', name: 'Quái nhổ độc', archetype: 'spitter', maxHp: 36, moveSpeed: 70, damage: 7,
    damageReceivedMultiplier: 1.05, contactRange: 52, attackCooldownMs: 2300, telegraphMs: 560, scale: 1,
    head: 'head-mutant', palette: { body: 0x2f5a2a, dark: 0x173015, skin: 0x8fd16a, accent: 0xb6ff3b },
    score: 150, drops: { health: 0.12, energy: 0.15, token: 0.3 },
    projectile: { speed: 260, damage: 7, color: 0x9dff3b, kind: 'spit' },
  },
  screamer: {
    id: 'screamer', name: 'Kẻ hét sóng âm', archetype: 'spitter', maxHp: 40, moveSpeed: 75, damage: 8,
    damageReceivedMultiplier: 1, contactRange: 52, attackCooldownMs: 2400, telegraphMs: 600, scale: 1,
    head: 'head-masked', palette: { body: 0x2b2440, dark: 0x15111f, skin: 0x9a7a6a, accent: 0xc77dff },
    score: 160, drops: { health: 0.12, energy: 0.18, token: 0.3 },
    projectile: { speed: 300, damage: 8, color: 0xc77dff, kind: 'sonic' },
  },
  robot: {
    id: 'robot', name: 'Robot an ninh', archetype: 'grunt', maxHp: 60, moveSpeed: 75, damage: 8,
    damageReceivedMultiplier: 0.95, contactRange: 60, attackCooldownMs: 1500, telegraphMs: 450, scale: 1.1,
    head: 'head-robot', palette: { body: 0x5a6b85, dark: 0x2b3446, skin: 0x8fa3c2, accent: 0xffb02e },
    score: 180, drops: { health: 0.12, energy: 0.15, token: 0.35 },
  },
  summoner: {
    id: 'summoner', name: 'Kẻ triệu hồi', archetype: 'summoner', maxHp: 50, moveSpeed: 60, damage: 6,
    damageReceivedMultiplier: 1, contactRange: 54, attackCooldownMs: 4200, telegraphMs: 700, scale: 1,
    head: 'head-sniper', palette: { body: 0x2a3a2a, dark: 0x151d15, skin: 0x7a6a5a, accent: 0x6bff9b },
    score: 220, drops: { health: 0.2, energy: 0.25, token: 0.4 },
  },
  minion: {
    id: 'minion', name: 'Nhện con', archetype: 'runner', maxHp: 12, moveSpeed: 150, damage: 4,
    damageReceivedMultiplier: 1.2, contactRange: 44, attackCooldownMs: 1400, telegraphMs: 360, scale: 0.7,
    head: 'head-mutant', palette: { body: 0x40284f, dark: 0x1f1426, skin: 0xa77bd1, accent: 0xff5ad1 },
    score: 40, drops: { health: 0.02, energy: 0.08, token: 0.1 },
  },
  clone: {
    id: 'clone', name: 'Bản sao', archetype: 'clone', maxHp: 22, moveSpeed: 110, damage: 6,
    damageReceivedMultiplier: 1.2, contactRange: 56, attackCooldownMs: 1500, telegraphMs: 420, scale: 1,
    head: 'head-scientist', palette: { body: 0xe8eef5, dark: 0x8a96a8, skin: 0xb9a3ff, accent: 0x7c4dff },
    score: 60, drops: { health: 0.05, energy: 0.12, token: 0.15 },
  },
  elite: {
    id: 'elite', name: 'Bản sao trùm cũ', archetype: 'brute', maxHp: 170, moveSpeed: 70, damage: 13,
    damageReceivedMultiplier: 0.9, contactRange: 74, attackCooldownMs: 1800, telegraphMs: 560, scale: 1.4,
    head: 'head-boss', palette: { body: 0x3a1d5c, dark: 0x1c0e2e, skin: 0xb48cff, accent: 0xff3bd4 },
    score: 400, drops: { health: 0.5, energy: 0.4, token: 0.6 }, armor: true,
  },
};

export function getEnemy(id: string): EnemyConfig {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}
