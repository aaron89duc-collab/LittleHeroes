import { describe, expect, it } from 'vitest';
import { defaultSave, SAVE_KEY, sanitizeSave, SaveSystem, type KeyValueStorage } from '../src/systems/SaveSystem';

class MemStorage implements KeyValueStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('SaveSystem', () => {
  it('recovers from corrupted JSON', () => {
    const s = new MemStorage();
    s.setItem(SAVE_KEY, '{not json');
    const sys = new SaveSystem(s);
    expect(sys.data).toEqual(defaultSave());
  });

  it('resets on wrong version and sanitizes fields', () => {
    expect(sanitizeSave({ version: 2 })).toEqual(defaultSave());
    const d = sanitizeSave({ version: 1, selectedCharacter: 'hacker', highestUnlockedStage: 99, completedStages: [1, 1, 2, 'x', 40], settings: { musicVolume: 7 } });
    expect(d.selectedCharacter).toBe('dau-dau');
    expect(d.highestUnlockedStage).toBe(10);
    expect(d.completedStages).toEqual([1, 2]);
    expect(d.settings.musicVolume).toBe(1);
  });

  it('unlocks the next stage and keeps best scores', () => {
    const sys = new SaveSystem(new MemStorage());
    sys.completeStage(1, 5000);
    sys.completeStage(1, 3000);
    expect(sys.data.highestUnlockedStage).toBe(2);
    expect(sys.data.bestScores['1']).toBe(5000);
    sys.completeStage(10, 1);
    expect(sys.data.hardModeUnlocked).toBe(true);
    const again = new SaveSystem((sys as unknown as { storage: KeyValueStorage }).storage);
    expect(again.data.completedStages).toEqual([1, 10]);
  });
});
