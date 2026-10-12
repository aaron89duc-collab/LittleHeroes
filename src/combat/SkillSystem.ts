/** Energy (EN) and skill gating rules (GDD §5.5). Pure logic. */

export const EN_GAIN_LIGHT = 4;
export const EN_GAIN_FINISHER = 7;
export const EN_GAIN_HURT = 2;
/** Max EN that can be earned from taking damage per rolling window, so tanking hits is not rewarded. */
export const EN_HURT_CAP = 10;
export const EN_HURT_WINDOW_MS = 5000;
export const SKILL_MIN_COOLDOWN_MS = 400;

export class EnergyMeter {
  private value: number;
  private hurtGained = 0;
  private hurtWindow = 0;

  constructor(public readonly max = 100, initial = 0) {
    this.value = clamp(initial, 0, max);
  }

  get current(): number {
    return this.value;
  }

  add(amount: number): number {
    this.value = clamp(this.value + amount, 0, this.max);
    return this.value;
  }

  gainFromHurt(): number {
    if (this.hurtGained >= EN_HURT_CAP) return 0;
    const g = Math.min(EN_GAIN_HURT, EN_HURT_CAP - this.hurtGained);
    this.hurtGained += g;
    this.add(g);
    return g;
  }

  canSpend(cost: number): boolean {
    return this.value >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canSpend(cost)) return false;
    this.value = clamp(this.value - cost, 0, this.max);
    return true;
  }

  update(dtMs: number): void {
    this.hurtWindow += dtMs;
    if (this.hurtWindow >= EN_HURT_WINDOW_MS) {
      this.hurtWindow = 0;
      this.hurtGained = 0;
    }
  }
}

export class CooldownTracker {
  private readyAt = new Map<string, number>();

  ready(id: string, now: number): boolean {
    return (this.readyAt.get(id) ?? 0) <= now;
  }

  trigger(id: string, now: number, cooldownMs: number): void {
    this.readyAt.set(id, now + Math.max(SKILL_MIN_COOLDOWN_MS, cooldownMs));
  }

  remaining(id: string, now: number): number {
    return Math.max(0, (this.readyAt.get(id) ?? 0) - now);
  }

  clear(): void {
    this.readyAt.clear();
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
