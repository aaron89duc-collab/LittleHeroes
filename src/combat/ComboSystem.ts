/**
 * Two related timers (GDD §7.2):
 *  - chain step: which light attack comes next (resets after `chainWindowMs` without attack input)
 *  - hit counter: displayed combo count (resets 1.2 s after the last damaging hit)
 */
export class ComboSystem {
  chainStep = 0;
  hitCount = 0;
  private sinceInput = Infinity;
  private sinceHit = Infinity;

  constructor(
    public chainLength = 3,
    public chainWindowMs = 700,
    public counterResetMs = 1200,
  ) {}

  /** Returns the chain index (0..chainLength-1) for the next light attack and advances the chain. */
  nextChainStep(): number {
    if (this.sinceInput > this.chainWindowMs) this.chainStep = 0;
    const step = this.chainStep;
    this.chainStep = (this.chainStep + 1) % this.chainLength;
    this.sinceInput = 0;
    return step;
  }

  registerHit(): number {
    this.hitCount += 1;
    this.sinceHit = 0;
    return this.hitCount;
  }

  /** Combo counter is shown from 2 consecutive hits. */
  get visible(): boolean {
    return this.hitCount >= 2;
  }

  update(dtMs: number): void {
    this.sinceInput += dtMs;
    this.sinceHit += dtMs;
    if (this.sinceInput > this.chainWindowMs) this.chainStep = 0;
    if (this.sinceHit > this.counterResetMs) this.hitCount = 0;
  }

  reset(): void {
    this.chainStep = 0;
    this.hitCount = 0;
    this.sinceInput = Infinity;
    this.sinceHit = Infinity;
  }
}
