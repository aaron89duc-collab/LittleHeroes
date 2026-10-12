import { describe, expect, it } from 'vitest';
import { CooldownTracker, EN_HURT_CAP, EnergyMeter, SKILL_MIN_COOLDOWN_MS } from '../src/combat/SkillSystem';

describe('EnergyMeter', () => {
  it('never exceeds max nor goes negative', () => {
    const e = new EnergyMeter(100, 0);
    e.add(250);
    expect(e.current).toBe(100);
    e.add(-500);
    expect(e.current).toBe(0);
  });

  it('refuses to spend when energy is insufficient', () => {
    const e = new EnergyMeter(100, 15);
    expect(e.spend(20)).toBe(false);
    expect(e.current).toBe(15);
    e.add(10);
    expect(e.spend(20)).toBe(true);
    expect(e.current).toBe(5);
  });

  it('caps energy gained from taking hits per window', () => {
    const e = new EnergyMeter(100, 0);
    for (let i = 0; i < 20; i++) e.gainFromHurt();
    expect(e.current).toBe(EN_HURT_CAP);
    e.update(6000);
    e.gainFromHurt();
    expect(e.current).toBe(EN_HURT_CAP + 2);
  });
});

describe('CooldownTracker', () => {
  it('enforces the internal minimum skill cooldown', () => {
    const c = new CooldownTracker();
    c.trigger('s', 1000, 0);
    expect(c.ready('s', 1000 + SKILL_MIN_COOLDOWN_MS - 1)).toBe(false);
    expect(c.ready('s', 1000 + SKILL_MIN_COOLDOWN_MS)).toBe(true);
  });
});
