/**
 * Shared touch state written by the on-screen controls (ui/VirtualJoystick + HUD buttons)
 * and read by InputSystem. Buttons latch "pressed" until consumed so short taps are never lost.
 */
export type TouchButton = 'attack' | 'skill' | 'dodge' | 'jump' | 'ultimate' | 'cycleSkill' | 'pause';

export class TouchController {
  private static inst: TouchController | null = null;
  moveX = 0;
  moveY = 0;
  private latched = new Set<TouchButton>();
  private held = new Set<TouchButton>();

  static get(): TouchController {
    if (!TouchController.inst) TouchController.inst = new TouchController();
    return TouchController.inst;
  }

  press(b: TouchButton): void {
    this.latched.add(b);
    this.held.add(b);
  }

  release(b: TouchButton): void {
    this.held.delete(b);
  }

  isHeld(b: TouchButton): boolean {
    return this.held.has(b);
  }

  consume(b: TouchButton): boolean {
    if (this.latched.has(b)) {
      this.latched.delete(b);
      return true;
    }
    return false;
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.latched.clear();
    this.held.clear();
  }
}
