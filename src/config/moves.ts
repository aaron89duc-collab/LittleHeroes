import type { MoveConfig, MoveHit } from '../types/game';

const front = (at: number, activeMs: number, damage: number, knockback: number, range: number, extra: Partial<MoveHit> = {}): MoveHit => ({
  at,
  activeMs,
  damage,
  knockback,
  range,
  depth: 30,
  shape: 'front',
  ...extra,
});

const around = (at: number, activeMs: number, damage: number, knockback: number, range: number, extra: Partial<MoveHit> = {}): MoveHit => ({
  at,
  activeMs,
  damage,
  knockback,
  range,
  depth: Math.round(range * 0.55),
  shape: 'around',
  ...extra,
});

/** All moves in the game. Numbers follow GDD §5 and are the single source of truth for balance. */
export const MOVES: Record<string, MoveConfig> = {
  // ───────────── Đậu Đậu — speed / combos ─────────────
  dd_l1: {
    id: 'dd_l1', name: 'Đấm trái', kind: 'light', baseDamage: 8, startupMs: 80, activeMs: 100, recoveryMs: 180,
    energyCost: 0, cooldownMs: 0, knockback: 40, anim: 'punchA', cancelFrom: 150,
    hits: [front(80, 100, 8, 40, 64)],
  },
  dd_l2: {
    id: 'dd_l2', name: 'Đấm phải', kind: 'light', baseDamage: 9, startupMs: 80, activeMs: 100, recoveryMs: 190,
    energyCost: 0, cooldownMs: 0, knockback: 50, anim: 'punchB', cancelFrom: 150,
    hits: [front(80, 100, 9, 50, 66)],
  },
  dd_fin: {
    id: 'dd_fin', name: 'Đá ngang', kind: 'finisher', baseDamage: 14, startupMs: 150, activeMs: 120, recoveryMs: 350,
    energyCost: 0, cooldownMs: 0, knockback: 260, anim: 'kickSide',
    hits: [front(150, 120, 14, 260, 80, { launch: true })],
  },
  dd_jump: {
    id: 'dd_jump', name: 'Đá bổ', kind: 'jump', baseDamage: 12, startupMs: 60, activeMs: 260, recoveryMs: 120,
    energyCost: 0, cooldownMs: 0, knockback: 120, anim: 'jumpKick',
    hits: [front(60, 260, 12, 120, 70, { depth: 34 })],
  },
  dd_s1: {
    id: 'dd_s1', name: 'Mèo Lướt', kind: 'skill', baseDamage: 16, startupMs: 60, activeMs: 240, recoveryMs: 220,
    energyCost: 20, cooldownMs: 400, knockback: 200, anim: 'dashStrike', dash: 210, iframes: [0, 220], color: 0x55bbff,
    hits: [front(60, 240, 16, 200, 60, { launch: true })],
  },
  dd_s2: {
    id: 'dd_s2', name: 'Liên Hoàn Cước', kind: 'skill', baseDamage: 28, startupMs: 100, activeMs: 380, recoveryMs: 260,
    energyCost: 30, cooldownMs: 400, knockback: 60, anim: 'multiKick', multiHit: true, dash: 60, color: 0x55bbff,
    hits: [
      front(100, 60, 7, 30, 78, { stun: 380 }),
      front(200, 60, 7, 30, 78, { stun: 380 }),
      front(300, 60, 7, 30, 78, { stun: 380 }),
      front(420, 60, 7, 220, 82, { launch: true }),
    ],
  },
  dd_s3: {
    id: 'dd_s3', name: 'Bão Mèo', kind: 'skill', baseDamage: 20, startupMs: 140, activeMs: 260, recoveryMs: 260,
    energyCost: 35, cooldownMs: 400, knockback: 280, anim: 'spinKick', color: 0x55bbff,
    hits: [around(140, 260, 20, 280, 100, { launch: true })],
  },
  dd_ult: {
    id: 'dd_ult', name: 'Long Mèo', kind: 'ultimate', baseDamage: 65, startupMs: 300, activeMs: 900, recoveryMs: 400,
    energyCost: 100, cooldownMs: 400, knockback: 320, anim: 'ultimate', multiHit: true, dash: 300, iframes: [0, 1500],
    extraTargetFalloff: 0.8, color: 0x3fa9ff,
    hits: [
      front(300, 80, 8, 20, 90, { stun: 600, depth: 40 }),
      front(420, 80, 8, 20, 90, { stun: 600, depth: 40 }),
      front(540, 80, 8, 20, 90, { stun: 600, depth: 40 }),
      front(660, 80, 8, 20, 90, { stun: 600, depth: 40 }),
      front(800, 80, 10, 30, 95, { stun: 700, depth: 40 }),
      front(1000, 120, 23, 320, 110, { launch: true, depth: 44 }),
    ],
  },

  // ───────────── Shu Shu — technique / crowd control ─────────────
  ss_l1: {
    id: 'ss_l1', name: 'Đấm nhanh', kind: 'light', baseDamage: 7, startupMs: 70, activeMs: 90, recoveryMs: 170,
    energyCost: 0, cooldownMs: 0, knockback: 40, anim: 'punchA', cancelFrom: 140,
    hits: [front(70, 90, 7, 40, 66)],
  },
  ss_l2: {
    id: 'ss_l2', name: 'Đá thấp', kind: 'light', baseDamage: 8, startupMs: 80, activeMs: 100, recoveryMs: 190,
    energyCost: 0, cooldownMs: 0, knockback: 50, anim: 'lowKick', cancelFrom: 160,
    hits: [front(80, 100, 8, 50, 74, { stun: 520 })],
  },
  ss_fin: {
    id: 'ss_fin', name: 'Quét chân', kind: 'finisher', baseDamage: 12, startupMs: 130, activeMs: 140, recoveryMs: 320,
    energyCost: 0, cooldownMs: 0, knockback: 140, anim: 'sweep',
    hits: [front(130, 140, 12, 140, 84, { launch: true, depth: 34 })],
  },
  ss_jump: {
    id: 'ss_jump', name: 'Đá chéo', kind: 'jump', baseDamage: 10, startupMs: 60, activeMs: 260, recoveryMs: 120,
    energyCost: 0, cooldownMs: 0, knockback: 100, anim: 'jumpKick',
    hits: [front(60, 260, 10, 100, 74, { depth: 34 })],
  },
  ss_s1: {
    id: 'ss_s1', name: 'Chuột Xoay', kind: 'skill', baseDamage: 15, startupMs: 100, activeMs: 300, recoveryMs: 220,
    energyCost: 20, cooldownMs: 400, knockback: 200, anim: 'spinKick', color: 0xffd23f,
    hits: [around(100, 300, 15, 200, 92)],
  },
  ss_s2: {
    id: 'ss_s2', name: 'Bước Nhảy Bóng', kind: 'skill', baseDamage: 18, startupMs: 260, activeMs: 160, recoveryMs: 240,
    energyCost: 25, cooldownMs: 400, knockback: 240, anim: 'shadowStep', iframes: [0, 300], dash: 120, counter: true,
    color: 0xffd23f,
    hits: [front(260, 160, 18, 240, 84, { launch: true })],
  },
  ss_s3: {
    id: 'ss_s3', name: 'Sóng Chấn Động', kind: 'skill', baseDamage: 18, startupMs: 220, activeMs: 200, recoveryMs: 300,
    energyCost: 35, cooldownMs: 400, knockback: 160, anim: 'palmWave', color: 0xffe066,
    hits: [around(220, 200, 18, 160, 150, { slow: 2500 })],
  },
  ss_ult: {
    id: 'ss_ult', name: 'Vòng Xoáy Shu Shu', kind: 'ultimate', baseDamage: 58, startupMs: 300, activeMs: 900, recoveryMs: 400,
    energyCost: 100, cooldownMs: 400, knockback: 340, anim: 'ultimate', multiHit: true, iframes: [0, 1500],
    extraTargetFalloff: 0.8, color: 0xffd23f,
    hits: [
      around(300, 80, 7, 10, 120, { stun: 600 }),
      around(420, 80, 7, 10, 120, { stun: 600 }),
      around(540, 80, 7, 10, 120, { stun: 600 }),
      around(660, 80, 7, 10, 120, { stun: 600 }),
      around(780, 80, 8, 10, 120, { stun: 600 }),
      around(900, 80, 8, 10, 120, { stun: 700 }),
      around(1080, 120, 14, 340, 130, { launch: true }),
    ],
  },

  // ───────────── Bắp — power / armor break ─────────────
  bp_l1: {
    id: 'bp_l1', name: 'Đấm nặng', kind: 'light', baseDamage: 13, startupMs: 150, activeMs: 120, recoveryMs: 300,
    energyCost: 0, cooldownMs: 0, knockback: 70, anim: 'punchA', cancelFrom: 240,
    hits: [front(150, 120, 13, 70, 70)],
  },
  bp_l2: {
    id: 'bp_l2', name: 'Húc vai', kind: 'light', baseDamage: 15, startupMs: 150, activeMs: 140, recoveryMs: 300,
    energyCost: 0, cooldownMs: 0, knockback: 170, anim: 'shoulder', dash: 30, cancelFrom: 260,
    hits: [front(150, 140, 15, 170, 68)],
  },
  bp_fin: {
    id: 'bp_fin', name: 'Đá mạnh', kind: 'finisher', baseDamage: 22, startupMs: 220, activeMs: 120, recoveryMs: 420,
    energyCost: 0, cooldownMs: 0, knockback: 300, anim: 'kickSide',
    hits: [front(220, 120, 22, 300, 84, { launch: true, breaksArmor: true })],
  },
  bp_jump: {
    id: 'bp_jump', name: 'Dậm đất', kind: 'jump', baseDamage: 15, startupMs: 80, activeMs: 260, recoveryMs: 160,
    energyCost: 0, cooldownMs: 0, knockback: 140, anim: 'stomp',
    hits: [around(80, 260, 15, 140, 72)],
  },
  bp_s1: {
    id: 'bp_s1', name: 'Cún Húc', kind: 'skill', baseDamage: 24, startupMs: 100, activeMs: 280, recoveryMs: 300,
    energyCost: 20, cooldownMs: 400, knockback: 300, anim: 'shoulderDash', dash: 220, color: 0xff5a4f,
    hits: [front(100, 280, 24, 300, 66, { launch: true, breaksArmor: true })],
  },
  bp_s2: {
    id: 'bp_s2', name: 'Địa Chấn', kind: 'skill', baseDamage: 20, startupMs: 280, activeMs: 160, recoveryMs: 340,
    energyCost: 30, cooldownMs: 400, knockback: 260, anim: 'groundPound', color: 0xff8a3d,
    hits: [around(280, 160, 20, 260, 125, { launch: true, breaksArmor: true })],
  },
  bp_s3: {
    id: 'bp_s3', name: 'Vật Ngã', kind: 'skill', baseDamage: 26, startupMs: 120, activeMs: 160, recoveryMs: 520,
    energyCost: 25, cooldownMs: 400, knockback: 280, anim: 'grabThrow', color: 0xff5a4f,
    hits: [front(120, 160, 26, 280, 62, { launch: true, grab: true, breaksArmor: true })],
  },
  bp_ult: {
    id: 'bp_ult', name: 'Bắp Đại Chiến', kind: 'ultimate', baseDamage: 78, startupMs: 320, activeMs: 1000, recoveryMs: 420,
    energyCost: 100, cooldownMs: 400, knockback: 360, anim: 'ultimate', multiHit: true, dash: 160, iframes: [0, 1600],
    extraTargetFalloff: 0.8, color: 0xff5a4f,
    hits: [
      front(320, 100, 12, 30, 96, { stun: 700, depth: 42, breaksArmor: true }),
      front(500, 100, 12, 30, 96, { stun: 700, depth: 42 }),
      front(680, 100, 14, 30, 100, { stun: 700, depth: 42 }),
      front(860, 100, 16, 40, 100, { stun: 800, depth: 42 }),
      around(1120, 160, 24, 360, 150, { launch: true }),
    ],
  },
};

export function getMove(id: string): MoveConfig {
  const m = MOVES[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}

/** Total duration of a move from start to the end of recovery. */
export function moveDuration(m: MoveConfig): number {
  const lastHitEnd = m.hits.reduce((acc, h) => Math.max(acc, h.at + h.activeMs), 0);
  return Math.max(m.startupMs + m.activeMs, lastHitEnd) + m.recoveryMs;
}
