import { describe, expect, it } from 'vitest';
import { EncounterLatch, WaveTracker } from '../src/systems/WaveTracker';

describe('WaveTracker', () => {
  it('completes only when every enemy is handled', () => {
    const w = new WaveTracker({ enemies: [{ type: 'grunt', count: 2 }, { type: 'runner', count: 1 }] }, 2);
    expect(w.nextSpawn()).not.toBeNull();
    expect(w.nextSpawn()).not.toBeNull();
    expect(w.canSpawn()).toBe(false); // max alive
    w.onEnemyDefeated();
    expect(w.isComplete).toBe(false);
    expect(w.nextSpawn()).not.toBeNull();
    w.onEnemyDefeated();
    expect(w.isComplete).toBe(false);
    w.onEnemyDefeated();
    expect(w.isComplete).toBe(true);
    expect(w.canSpawn()).toBe(false);
  });

  it('summoned extras must also be cleared', () => {
    const w = new WaveTracker({ enemies: [{ type: 'summoner', count: 1 }] });
    w.nextSpawn();
    w.addExtra();
    w.onEnemyDefeated();
    expect(w.isComplete).toBe(false);
    w.onEnemyDefeated();
    expect(w.isComplete).toBe(true);
  });

  it('boss encounter ends exactly once', () => {
    const l = new EncounterLatch();
    expect(l.fire()).toBe(true);
    expect(l.fire()).toBe(false);
  });
});
