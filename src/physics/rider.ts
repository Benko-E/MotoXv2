const GRAVITY = 9.81
/** Front axle to rear axle, m. */
const WHEELBASE = 1.48
/** How fast the rider can turn the bars, rad/s. */
const STEER_RATE = 4
/** How fast the lean he aims for can change, rad/s (how quickly he tips in). */
const TARGET_LEAN_RATE = 2.5
/** From walking pace up to this speed (m/s), the lean he aims for fades in. */
const FULL_LEAN_SPEED = 8
/**
 * How hard he corrects: sideways pull (in g) per radian of lean error, and
 * per rad/s of lean speed. Above 1 for lean error, or the bike falls.
 */
const GAINS = { lean: 4, leanSpeed: 1.5 }

export type RiderSettings = {
  /** Most lean he aims for, radians. */
  maxLean: number
  /** Most bar angle, radians. */
  maxSteer: number
  /** Below this speed (m/s) the bars follow A/D directly and he puts a foot down. */
  footSpeed: number
  /** Tyre grip (share of load): he never asks them for more sideways pull than this. */
  grip: number
}

export type RiderSees = {
  /** Speed along the bike, m/s. */
  speed: number
  /** Lean, radians (+ = right), and how fast it changes. */
  lean: number
  leanSpeed: number
  /** A/D: −1 (left) … 1 (right). */
  input: number
  /** Bars and target lean now (both + = right). */
  steer: number
  targetLean: number
}

/**
 * The virtual rider's hands: picks the lean A/D ask for, then turns the bars
 * to get it. A steady turn at a lean needs a sideways pull of g·tan(lean); on
 * top he corrects for lean error and lean speed. Asking for more lean right
 * than he has means pulling less to the right for a moment, so the wheels run
 * out from under the bike: he countersteers without being told to.
 */
export function steerBars(sees: RiderSees, rider: RiderSettings, dt: number): { steer: number; targetLean: number } {
  const speed = Math.abs(sees.speed)
  const leanIn = clamp01((speed - rider.footSpeed) / (FULL_LEAN_SPEED - rider.footSpeed))
  const goal = sees.input * rider.maxLean * leanIn
  const leanStep = TARGET_LEAN_RATE * dt
  const targetLean = sees.targetLean + clamp(goal - sees.targetLean, -leanStep, leanStep)

  const asked = Math.tan(targetLean) + GAINS.lean * (sees.lean - targetLean) + GAINS.leanSpeed * sees.leanSpeed
  const pull = GRAVITY * clamp(asked, -rider.grip, rider.grip)
  const fast = Math.max(speed, rider.footSpeed)
  const balancing = Math.atan((WHEELBASE * pull) / (fast * fast))
  // Slow: the bars just follow the keys (he's got a foot down).
  const direct = sees.input * rider.maxSteer
  const balance = clamp01((speed - rider.footSpeed) / rider.footSpeed)
  const wanted = clamp(direct + (balancing - direct) * balance, -rider.maxSteer, rider.maxSteer)
  const steerStep = STEER_RATE * dt
  const steer = sees.steer + clamp(wanted - sees.steer, -steerStep, steerStep)
  return { steer, targetLean }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}
