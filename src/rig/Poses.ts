/**
 * Pose data for the puppet rig. Angles in degrees.
 *  arm  [shoulder, elbow]: shoulder 0 = down, 90 = forward, 180 = up; elbow + folds forearm forward/up.
 *  leg  [hip, knee]:       hip + = forward; knee + folds shin backward.
 *  lean: + = torso leans forward. body: + = hips lower (crouch). head: tilt.
 *  bf: 1 = draw back arm in front of torso (cross punches).
 */
export interface Pose {
  body: number;
  lean: number;
  head: number;
  aF: [number, number];
  aB: [number, number];
  lF: [number, number];
  lB: [number, number];
  bf?: number;
}

export const p = (
  lean: number,
  aF: [number, number],
  aB: [number, number],
  lF: [number, number],
  lB: [number, number],
  body = 0,
  head = 0,
  bf = 0,
): Pose => ({ lean, aF, aB, lF, lB, body, head, bf });

export const IDLE: Pose = p(4, [34, 100], [50, 108], [14, 12], [-12, 14], 1, 0);
export const IDLE2: Pose = p(5, [36, 96], [52, 104], [14, 16], [-12, 18], 3, 2);

export const WALK: Pose[] = [
  p(7, [30, 100], [58, 110], [28, 8], [-26, 20], 0, 0),
  p(7, [36, 106], [50, 116], [4, 30], [-4, 4], 2, 1),
  p(7, [44, 112], [40, 104], [-24, 18], [26, 8], 0, 0),
  p(7, [36, 106], [50, 116], [-4, 6], [4, 32], 2, 1),
];

export const JUMP_UP: Pose = p(0, [70, 80], [80, 70], [50, 90], [-10, 80], 0, -4);
export const JUMP_FALL: Pose = p(6, [110, 40], [100, 40], [20, 50], [-20, 40], 0, 4);
export const CROUCH: Pose = p(10, [40, 110], [52, 116], [40, 70], [-10, 70], 12, 4);
export const HURT: Pose = p(-16, [20, 30], [40, 40], [10, 20], [-20, 20], 2, -12);
export const HURT2: Pose = p(-22, [60, 20], [70, 30], [16, 10], [-24, 10], 0, -16);
export const DOWN: Pose = p(0, [150, 10], [170, 10], [10, 0], [-6, 6], 0, -6);
export const GETUP: Pose = p(20, [30, 40], [40, 50], [60, 100], [-10, 90], 18, 4);
export const VICTORY: Pose = p(-4, [44, 118], [168, 18], [10, 6], [-14, 10], 0, -8);
export const VICTORY2: Pose = p(-2, [52, 110], [150, 60], [12, 8], [-12, 12], 2, -4);
export const DODGE: Pose = p(18, [60, 130], [70, 130], [50, 90], [-40, 60], 16, 6);
export const BLOCK: Pose = p(-4, [80, 140], [90, 140], [20, 14], [-16, 16], 4, 4);
export const FROZEN: Pose = p(0, [20, 20], [30, 20], [6, 6], [-6, 6], 0, 0);
export const TELEGRAPH: Pose = p(-12, [-20, 110], [60, 120], [18, 14], [-20, 16], 4, -6);

export interface StrikeSet {
  windups: Pose[];
  strikes: Pose[];
  /** rig spins (horizontal flip oscillation) during active frames */
  spin?: boolean;
  /** whole body hops (z offset in px) */
  hop?: number;
}

const punchWind = p(-6, [30, 135], [52, 118], [16, 12], [-14, 16], 3, 0);
const jab = p(14, [92, 0], [46, 120], [18, 8], [-20, 18], 2, 2);
const crossWind = p(-8, [40, 110], [10, 130], [16, 12], [-14, 16], 3, 0, 0);
const cross = p(20, [50, 110], [94, 0], [24, 10], [-26, 22], 3, 3, 1);
const hookWind = p(-10, [10, 100], [50, 120], [14, 10], [-16, 14], 4, -2);
const uppercut = p(4, [150, 40], [40, 120], [20, 18], [-18, 20], -2, -6);
const kickWind = p(-14, [60, 110], [30, 110], [70, 110], [-10, 14], 2, -2);
const sideKick = p(-24, [80, 100], [20, 90], [100, 0], [-8, 8], 0, -4);
const lowKickP = p(-6, [50, 110], [40, 110], [62, 0], [-14, 22], 5, 2);
const sweepWind = p(16, [30, 60], [40, 60], [40, 90], [-20, 90], 16, 4);
const sweepP = p(18, [20, 40], [70, 40], [86, 0], [-40, 110], 20, 6);
const jumpKickP = p(-14, [70, 100], [100, 60], [80, 0], [-10, 100], 0, -4);
const stompP = p(10, [30, 0], [36, 0], [24, 20], [-24, 20], 6, 6);
const dashP = p(26, [96, 0], [30, 70], [40, 30], [-50, 40], 8, 4);
const shoulderWind = p(-8, [20, 120], [30, 120], [20, 20], [-20, 20], 6, 0);
const shoulderP = p(28, [10, 130], [20, 130], [34, 20], [-40, 30], 8, 6);
const palmWind = p(-10, [-30, 70], [-20, 70], [16, 16], [-20, 20], 6, 0);
const palmP = p(16, [90, 0], [84, 0], [30, 10], [-30, 30], 6, 2, 1);
const poundWind = p(-6, [170, 20], [165, 20], [24, 40], [-24, 40], -4, -8);
const poundP = p(26, [50, 0], [44, 0], [50, 90], [-30, 80], 22, 8);
const grabP = p(14, [92, 30], [88, 30], [24, 12], [-26, 22], 4, 2, 1);
const throwP = p(-18, [160, 40], [150, 40], [10, 20], [-30, 30], 0, -8);
const spinP = p(4, [95, 10], [95, 10], [96, 0], [-6, 10], 0, 0);
const shadowWind = p(-18, [40, 120], [50, 120], [30, 60], [-30, 60], 12, -4);
const multiA = p(-20, [80, 100], [20, 90], [118, 0], [-6, 8], 0, -4);
const multiB = p(-18, [70, 100], [30, 90], [72, 0], [-10, 12], 2, -2);
const ultFinal = p(-26, [130, 20], [40, 90], [120, 0], [-8, 10], -2, -8);
const clawWind = p(-12, [150, 30], [60, 120], [16, 14], [-18, 16], 2, -4);
const claw = p(18, [60, 10], [40, 120], [26, 10], [-24, 20], 4, 4);
const spitWind = p(-14, [20, 90], [30, 90], [16, 14], [-16, 16], 2, -14);
const spitP = p(14, [40, 60], [50, 60], [20, 10], [-20, 18], 2, 10);

export const STRIKES: Record<string, StrikeSet> = {
  punchA: { windups: [punchWind], strikes: [jab] },
  punchB: { windups: [crossWind], strikes: [cross] },
  hook: { windups: [hookWind], strikes: [uppercut] },
  kickSide: { windups: [kickWind], strikes: [sideKick] },
  lowKick: { windups: [punchWind], strikes: [lowKickP] },
  sweep: { windups: [sweepWind], strikes: [sweepP] },
  jumpKick: { windups: [JUMP_UP], strikes: [jumpKickP] },
  stomp: { windups: [JUMP_UP], strikes: [stompP] },
  dashStrike: { windups: [CROUCH], strikes: [dashP] },
  multiKick: { windups: [kickWind, multiB, kickWind, kickWind], strikes: [multiA, multiB, multiA, sideKick], hop: 10 },
  spinKick: { windups: [kickWind], strikes: [spinP], spin: true },
  shadowStep: { windups: [shadowWind], strikes: [palmP] },
  palmWave: { windups: [palmWind], strikes: [palmP] },
  shoulder: { windups: [shoulderWind], strikes: [shoulderP] },
  shoulderDash: { windups: [shoulderWind], strikes: [shoulderP] },
  groundPound: { windups: [poundWind], strikes: [poundP], hop: 26 },
  grabThrow: { windups: [grabP], strikes: [throwP] },
  ultimate: {
    windups: [punchWind, crossWind, hookWind, kickWind, crossWind, poundWind],
    strikes: [jab, cross, uppercut, sideKick, cross, ultFinal],
  },
  // enemy / boss sets
  claw: { windups: [clawWind], strikes: [claw] },
  slam: { windups: [poundWind], strikes: [poundP] },
  spit: { windups: [spitWind], strikes: [spitP] },
  charge: { windups: [shoulderWind], strikes: [shoulderP] },
};

export function lerpPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  const l = (x: number, y: number): number => x + (y - x) * t;
  out.body = l(a.body, b.body);
  out.lean = l(a.lean, b.lean);
  out.head = l(a.head, b.head);
  out.aF[0] = l(a.aF[0], b.aF[0]);
  out.aF[1] = l(a.aF[1], b.aF[1]);
  out.aB[0] = l(a.aB[0], b.aB[0]);
  out.aB[1] = l(a.aB[1], b.aB[1]);
  out.lF[0] = l(a.lF[0], b.lF[0]);
  out.lF[1] = l(a.lF[1], b.lF[1]);
  out.lB[0] = l(a.lB[0], b.lB[0]);
  out.lB[1] = l(a.lB[1], b.lB[1]);
  out.bf = t < 0.5 ? a.bf ?? 0 : b.bf ?? 0;
  return out;
}

export function clonePose(a: Pose): Pose {
  return { ...a, aF: [a.aF[0], a.aF[1]], aB: [a.aB[0], a.aB[1]], lF: [a.lF[0], a.lF[1]], lB: [a.lB[0], a.lB[1]] };
}
