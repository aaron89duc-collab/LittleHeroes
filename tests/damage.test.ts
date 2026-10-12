import { describe, expect, it } from 'vitest';
import { comboMultiplier, computeFinalDamage, computeRawDamage, targetFalloff } from '../src/combat/DamageSystem';

describe('DamageSystem', () => {
  it('applies the GDD formula with rounding and a minimum of 1', () => {
    expect(computeRawDamage(10, 1, 0)).toBe(10);
    expect(computeFinalDamage({ baseDamage: 8, attackMultiplier: 1, comboCount: 0, targetDamageReceivedMultiplier: 1 })).toBe(8);
    expect(computeFinalDamage({ baseDamage: 13, attackMultiplier: 1, comboCount: 0, targetDamageReceivedMultiplier: 0.77 })).toBe(10);
    expect(computeFinalDamage({ baseDamage: 1, attackMultiplier: 1, comboCount: 0, targetDamageReceivedMultiplier: 0.1 })).toBe(1);
  });

  it('combo multiplier grows slowly and is capped', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(6)).toBeCloseTo(1.1);
    expect(comboMultiplier(999)).toBeCloseTo(1.3);
  });

  it('ultimate falloff only affects the third target onwards', () => {
    expect(targetFalloff(0, 0.8)).toBe(1);
    expect(targetFalloff(1, 0.8)).toBe(1);
    expect(targetFalloff(2, 0.8)).toBe(0.8);
    expect(targetFalloff(5, undefined)).toBe(1);
  });
});
