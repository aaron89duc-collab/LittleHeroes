import { describe, expect, it } from 'vitest';
import { ComboSystem } from '../src/combat/ComboSystem';

describe('ComboSystem', () => {
  it('chains 3 steps then loops', () => {
    const c = new ComboSystem(3, 700, 1200);
    expect(c.nextChainStep()).toBe(0);
    c.update(100);
    expect(c.nextChainStep()).toBe(1);
    c.update(100);
    expect(c.nextChainStep()).toBe(2);
    c.update(100);
    expect(c.nextChainStep()).toBe(0);
  });

  it('resets the chain after the timeout without input', () => {
    const c = new ComboSystem(3, 700, 1200);
    c.nextChainStep();
    c.update(701);
    expect(c.nextChainStep()).toBe(0);
  });

  it('shows the counter from 2 hits and resets 1.2s after the last hit', () => {
    const c = new ComboSystem();
    c.registerHit();
    expect(c.visible).toBe(false);
    c.registerHit();
    expect(c.visible).toBe(true);
    c.update(1199);
    expect(c.hitCount).toBe(2);
    c.update(2);
    expect(c.hitCount).toBe(0);
  });
});
