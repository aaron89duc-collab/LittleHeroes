import type { CharacterId, CharacterStats } from '../types/game';

/** Base walk speed in px/s for moveSpeed = 1 */
export const BASE_WALK_SPEED = 175;

/**
 * Hero stats. attackMultiplier stays 1 because each hero's move table (config/moves.ts)
 * already encodes the GDD "ATK cơ sở" differences (Bắp 13–22 dmg vs Shu Shu 7–12 dmg).
 */
export const CHARACTERS: Record<CharacterId, CharacterStats> = {
  'dau-dau': {
    id: 'dau-dau',
    displayName: 'Đậu Đậu',
    title: 'Chiến binh tốc độ',
    description: 'Dũng cảm, nhanh nhẹn. Áp sát, nối combo và tránh đòn bằng di chuyển.',
    maxHp: 100,
    attackMultiplier: 1.0,
    moveSpeed: 1.25,
    damageReceivedMultiplier: 1.0,
    reach: 1.0,
    maxEnergy: 100,
    comboWindowMs: 700,
    palette: { suit: 0x2a4fb5, suitDark: 0x182c6b, accent: 0x5fb4ff, vest: 0x1b2440, glove: 0x1c2238, boot: 0x14182a, skin: 0xffd9bf },
    ui: { power: 3, speed: 5, defense: 3 },
    lightChain: ['dd_l1', 'dd_l2', 'dd_fin'],
    jumpAttack: 'dd_jump',
    skills: ['dd_s1', 'dd_s2', 'dd_s3'],
    ultimate: 'dd_ult',
  },
  'shu-shu': {
    id: 'shu-shu',
    displayName: 'Shu Shu',
    title: 'Võ sư kỹ thuật',
    description: 'Thông minh, bình tĩnh. Quét chân, né phản công và khống chế đám đông.',
    maxHp: 95,
    attackMultiplier: 1.0,
    moveSpeed: 1.1,
    damageReceivedMultiplier: 1.1,
    reach: 1.05,
    maxEnergy: 100,
    comboWindowMs: 700,
    palette: { suit: 0xf2b705, suitDark: 0x9a6a00, accent: 0xffe066, vest: 0x1d1d24, glove: 0x23232c, boot: 0x16161c, skin: 0xffdcc6, tail: 0xb87a3e },
    ui: { power: 2, speed: 4, defense: 2 },
    lightChain: ['ss_l1', 'ss_l2', 'ss_fin'],
    jumpAttack: 'ss_jump',
    skills: ['ss_s1', 'ss_s2', 'ss_s3'],
    ultimate: 'ss_ult',
  },
  bap: {
    id: 'bap',
    displayName: 'Bắp',
    title: 'Đấu sĩ sức mạnh',
    description: 'Trung thành, mạnh mẽ. Đòn chậm nhưng nặng, phá giáp và quật ngã.',
    maxHp: 130,
    attackMultiplier: 1.0,
    moveSpeed: 0.85,
    damageReceivedMultiplier: 0.77,
    reach: 1.1,
    maxEnergy: 100,
    comboWindowMs: 760,
    palette: { suit: 0xc8202e, suitDark: 0x7a1019, accent: 0xff6b5a, vest: 0x1e1a1e, glove: 0x4a2a22, boot: 0x1a1414, skin: 0xffdcc6 },
    ui: { power: 5, speed: 2, defense: 5 },
    lightChain: ['bp_l1', 'bp_l2', 'bp_fin'],
    jumpAttack: 'bp_jump',
    skills: ['bp_s1', 'bp_s2', 'bp_s3'],
    ultimate: 'bp_ult',
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['dau-dau', 'shu-shu', 'bap'];
