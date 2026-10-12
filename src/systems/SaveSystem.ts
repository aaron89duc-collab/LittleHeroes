import type { CharacterId, SaveData, SaveSettings } from '../types/game';

/** The only module that touches localStorage (GDD §13.2). */
export const SAVE_KEY = 'little-heroes-save-v1';
const CHARACTER_IDS: CharacterId[] = ['dau-dau', 'shu-shu', 'bap'];

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSettings(): SaveSettings {
  return { musicVolume: 0.6, sfxVolume: 0.8, cameraShake: true, touchControlsOpacity: 0.55, reduceFlash: false, showTouch: 'auto' };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    selectedCharacter: 'dau-dau',
    highestUnlockedStage: 1,
    completedStages: [],
    bestScores: {},
    settings: defaultSettings(),
    hardModeUnlocked: false,
  };
}

const num = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Validates an unknown object into SaveData; any corrupted field falls back to default. Never throws. */
export function sanitizeSave(raw: unknown, stageCount = 10): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return d; // place for future migrations
  const sel = CHARACTER_IDS.includes(r.selectedCharacter as CharacterId) ? (r.selectedCharacter as CharacterId) : d.selectedCharacter;
  const completed = Array.isArray(r.completedStages)
    ? Array.from(new Set(r.completedStages.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= stageCount))).sort((a, b) => a - b)
    : [];
  const best: Record<string, number> = {};
  if (r.bestScores && typeof r.bestScores === 'object') {
    for (const [k, v] of Object.entries(r.bestScores as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) best[k] = Math.floor(v);
    }
  }
  const s = (r.settings && typeof r.settings === 'object' ? r.settings : {}) as Record<string, unknown>;
  const ds = defaultSettings();
  const showTouch = s.showTouch === 'on' || s.showTouch === 'off' || s.showTouch === 'auto' ? s.showTouch : ds.showTouch;
  return {
    version: 1,
    selectedCharacter: sel,
    highestUnlockedStage: Math.max(1, Math.round(num(r.highestUnlockedStage, 1, stageCount, 1)), ...completed.map((c) => Math.min(stageCount, c + 1))),
    completedStages: completed,
    bestScores: best,
    hardModeUnlocked: bool(r.hardModeUnlocked, false),
    settings: {
      musicVolume: num(s.musicVolume, 0, 1, ds.musicVolume),
      sfxVolume: num(s.sfxVolume, 0, 1, ds.sfxVolume),
      cameraShake: bool(s.cameraShake, ds.cameraShake),
      touchControlsOpacity: num(s.touchControlsOpacity, 0.15, 1, ds.touchControlsOpacity),
      reduceFlash: bool(s.reduceFlash, ds.reduceFlash),
      showTouch,
    },
  };
}

function safeStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export class SaveSystem {
  private static instance: SaveSystem | null = null;
  data: SaveData;

  constructor(private storage: KeyValueStorage | null = safeStorage(), private stageCount = 10) {
    this.data = this.load();
  }

  static get(): SaveSystem {
    if (!SaveSystem.instance) SaveSystem.instance = new SaveSystem();
    return SaveSystem.instance;
  }

  load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const txt = this.storage.getItem(SAVE_KEY);
      if (!txt) return defaultSave();
      return sanitizeSave(JSON.parse(txt), this.stageCount);
    } catch (e) {
      console.warn('[SaveSystem] Save data corrupted, resetting to defaults.', e);
      return defaultSave();
    }
  }

  persist(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[SaveSystem] Could not write save data.', e);
    }
  }

  completeStage(stageId: number, score: number): void {
    if (!this.data.completedStages.includes(stageId)) this.data.completedStages.push(stageId);
    this.data.completedStages.sort((a, b) => a - b);
    this.data.highestUnlockedStage = Math.min(this.stageCount, Math.max(this.data.highestUnlockedStage, stageId + 1));
    const key = `${stageId}`;
    this.data.bestScores[key] = Math.max(this.data.bestScores[key] ?? 0, Math.floor(score));
    if (stageId === this.stageCount) this.data.hardModeUnlocked = true;
    this.persist();
  }

  setCharacter(id: CharacterId): void {
    this.data.selectedCharacter = id;
    this.persist();
  }

  updateSettings(patch: Partial<SaveSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
  }

  resetProgress(): void {
    const settings = this.data.settings;
    this.data = { ...defaultSave(), settings };
    this.persist();
  }
}
