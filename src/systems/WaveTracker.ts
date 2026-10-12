import type { WaveConfig } from '../types/game';

/**
 * Pure wave bookkeeping (GDD §15.1 "Wave chỉ hoàn thành khi mọi địch đã bị xử lý").
 * The scene asks `nextSpawn()` while `canSpawn()` and reports deaths with `onEnemyDefeated()`.
 */
export class WaveTracker {
  private queue: string[] = [];
  private alive = 0;
  private spawned = 0;
  private total = 0;
  private done = false;

  constructor(private wave: WaveConfig, private defaultMaxAlive = 4) {
    for (const g of wave.enemies) for (let i = 0; i < g.count; i++) this.queue.push(g.type);
    // interleave types a bit for variety while keeping order deterministic
    this.queue.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mixed: string[] = [];
    while (this.queue.length) {
      mixed.push(this.queue.shift()!);
      if (this.queue.length) mixed.push(this.queue.pop()!);
    }
    this.queue = mixed;
    this.total = mixed.length;
  }

  get maxAlive(): number {
    return this.wave.maxAlive ?? this.defaultMaxAlive;
  }

  canSpawn(): boolean {
    return !this.done && this.queue.length > 0 && this.alive < this.maxAlive;
  }

  nextSpawn(): string | null {
    if (!this.canSpawn()) return null;
    this.alive += 1;
    this.spawned += 1;
    return this.queue.shift() ?? null;
  }

  /** Extra enemies (e.g. summoned) that must also be cleared but are not part of the queue. */
  addExtra(): void {
    this.alive += 1;
    this.total += 1;
    this.spawned += 1;
  }

  onEnemyDefeated(): void {
    if (this.alive > 0) this.alive -= 1;
    if (this.alive === 0 && this.queue.length === 0) this.done = true;
  }

  get remaining(): number {
    return this.queue.length + this.alive;
  }

  get isComplete(): boolean {
    return this.done;
  }

  get progress(): { spawned: number; total: number } {
    return { spawned: this.spawned, total: this.total };
  }
}

/** Ensures a boss encounter ends exactly once (GDD §15.1). */
export class EncounterLatch {
  private fired = false;
  fire(): boolean {
    if (this.fired) return false;
    this.fired = true;
    return true;
  }
  get hasFired(): boolean {
    return this.fired;
  }
}
