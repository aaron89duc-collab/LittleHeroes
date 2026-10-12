import { describe, expect, it } from 'vitest';
import { hitAreaOverlaps, HitRegistry, type PlaneBody } from '../src/combat/Hitbox';

const body = (x: number, y: number, z = 0): PlaneBody => ({ x, y, z, halfWidth: 20, halfDepth: 14, height: 140 });

describe('Hitbox', () => {
  it('front hits only in facing direction and within depth', () => {
    const a = { originX: 100, originY: 500, originZ: 0, facing: 1 as const, range: 60, depth: 30, shape: 'front' as const };
    expect(hitAreaOverlaps(a, body(150, 500))).toBe(true);
    expect(hitAreaOverlaps(a, body(30, 500))).toBe(false);
    expect(hitAreaOverlaps(a, body(150, 560))).toBe(false); // lane too far
    expect(hitAreaOverlaps(a, body(150, 500, 300))).toBe(false); // high above
  });

  it('around hits on both sides', () => {
    const a = { originX: 100, originY: 500, originZ: 0, facing: 1 as const, range: 80, depth: 40, shape: 'around' as const };
    expect(hitAreaOverlaps(a, body(40, 510))).toBe(true);
    expect(hitAreaOverlaps(a, body(170, 490))).toBe(true);
  });

  it('a hitbox damages each entity only once', () => {
    const r = new HitRegistry();
    expect(r.tryRegister(0, 7)).toBe(true);
    expect(r.tryRegister(0, 7)).toBe(false);
    expect(r.tryRegister(1, 7)).toBe(true); // next hit of a multi-hit move
    expect(r.countFor(0)).toBe(1);
  });
});
