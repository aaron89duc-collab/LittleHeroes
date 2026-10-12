/** Pure damage math (GDD §7.4). No engine dependencies so it is unit-testable. */

export const COMBO_BONUS_PER_HIT = 0.02;
export const COMBO_BONUS_CAP = 0.3;

export function comboMultiplier(comboCount: number): number {
  const bonus = Math.min(COMBO_BONUS_CAP, Math.max(0, comboCount - 1) * COMBO_BONUS_PER_HIT);
  return 1 + bonus;
}

export interface DamageInput {
  baseDamage: number;
  attackMultiplier: number;
  comboCount: number;
  targetDamageReceivedMultiplier: number;
  /** extra multiplier (boss phase armor, assist mode, multi-target falloff...) */
  extraMultiplier?: number;
}

export function computeRawDamage(baseDamage: number, attackMultiplier: number, comboCount: number): number {
  return baseDamage * attackMultiplier * comboMultiplier(comboCount);
}

export function computeFinalDamage(i: DamageInput): number {
  const raw = computeRawDamage(i.baseDamage, i.attackMultiplier, i.comboCount);
  return Math.max(1, Math.round(raw * i.targetDamageReceivedMultiplier * (i.extraMultiplier ?? 1)));
}

/** Ultimate multi-target falloff: full damage for the first two targets, reduced from the third on. */
export function targetFalloff(targetIndex: number, falloff: number | undefined): number {
  if (falloff === undefined) return 1;
  return targetIndex >= 2 ? falloff : 1;
}
