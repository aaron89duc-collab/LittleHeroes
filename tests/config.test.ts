import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/config/bosses';
import { CHARACTERS } from '../src/config/characters';
import { ENEMIES } from '../src/config/enemies';
import { MOVES } from '../src/config/moves';
import { STAGES } from '../src/config/stages';

describe('Config integrity', () => {
  it('has a 10 stage campaign with ≥3 waves, a boss and hazards each', () => {
    expect(STAGES).toHaveLength(10);
    for (const s of STAGES) {
      expect(s.waves.length).toBeGreaterThanOrEqual(3);
      expect(BOSSES[s.bossId]).toBeDefined();
      if (s.secondBossId) expect(BOSSES[s.secondBossId]).toBeDefined();
      expect(s.hazards.length).toBeGreaterThan(0);
      for (const w of s.waves) for (const g of w.enemies) expect(ENEMIES[g.type], `${s.id}:${g.type}`).toBeDefined();
    }
  });

  it('every character references existing moves and the design damage totals match hits', () => {
    for (const c of Object.values(CHARACTERS)) {
      for (const id of [...c.lightChain, c.jumpAttack, ...c.skills, c.ultimate]) {
        const m = MOVES[id];
        expect(m, id).toBeDefined();
        const sum = m.hits.reduce((a, h) => a + h.damage, 0);
        expect(sum, id).toBe(m.baseDamage);
      }
    }
  });

  it('bosses have ≥3 actions and a telegraphed heavy move (≥500ms)', () => {
    for (const b of Object.values(BOSSES)) {
      const kinds = new Set(b.phases.flatMap((p) => p.moves.map((m) => m.kind)));
      expect(kinds.size, b.id).toBeGreaterThanOrEqual(3);
      const heavy = b.phases.flatMap((p) => p.moves).some((m) => m.damage >= 14 && m.telegraphMs >= 500);
      expect(heavy, b.id).toBe(true);
      for (const p of b.phases) for (const m of p.moves) if (m.summon) expect(ENEMIES[m.summon]).toBeDefined();
    }
  });

  it('skill costs follow the GDD', () => {
    expect(MOVES.dd_s1.energyCost).toBe(20);
    expect(MOVES.dd_s2.energyCost).toBe(30);
    expect(MOVES.dd_s3.energyCost).toBe(35);
    expect(MOVES.ss_s2.energyCost).toBe(25);
    expect(MOVES.bp_s3.energyCost).toBe(25);
    for (const u of ['dd_ult', 'ss_ult', 'bp_ult']) expect(MOVES[u].energyCost).toBe(100);
  });
});
