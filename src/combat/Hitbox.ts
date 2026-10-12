import type { HitShape } from '../types/game';

/** Ground-plane geometry for 2.5D beat 'em up hit tests (x = horizontal, y = lane depth, z = height). */
export interface PlaneBody {
  x: number;
  y: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  height: number;
}

export interface HitArea {
  originX: number;
  originY: number;
  originZ: number;
  facing: 1 | -1;
  range: number;
  depth: number;
  shape: HitShape;
}

/** True if the attack area overlaps the target hurtbox on the x/y plane (and roughly in height). */
export function hitAreaOverlaps(a: HitArea, t: PlaneBody): boolean {
  const dy = Math.abs(t.y - a.originY);
  if (dy > a.depth + t.halfDepth) return false;
  // vertical (z) sanity: a grounded punch shouldn't hit something flying far above.
  if (Math.abs(t.z - a.originZ) > t.height + 40) return false;
  if (a.shape === 'around') {
    const dx = Math.abs(t.x - a.originX);
    return dx <= a.range + t.halfWidth;
  }
  const rel = (t.x - a.originX) * a.facing;
  // allow a sliver behind the attacker so overlapping bodies still connect
  return rel >= -t.halfWidth - 6 && rel <= a.range + t.halfWidth;
}

/** Ensures each hitbox only damages an entity once unless the move is multi-hit (GDD §7.3). */
export class HitRegistry {
  private hit = new Map<number, Set<number>>();

  /** @returns true if this (hitIndex, target) pair has not been registered yet. */
  tryRegister(hitIndex: number, targetId: number): boolean {
    let s = this.hit.get(hitIndex);
    if (!s) {
      s = new Set();
      this.hit.set(hitIndex, s);
    }
    if (s.has(targetId)) return false;
    s.add(targetId);
    return true;
  }

  countFor(hitIndex: number): number {
    return this.hit.get(hitIndex)?.size ?? 0;
  }

  clear(): void {
    this.hit.clear();
  }
}
