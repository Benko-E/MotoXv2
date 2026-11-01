import type { BikeParams } from './bike'

/** The engine's spinning parts (crank, flywheel), kg·m². */
const ENGINE_INERTIA = 0.015
export const IDLE_RPM = 1500
/** Chain and gearbox losses. */
const DRIVETRAIN_EFFICIENCY = 0.9
/** The torque curve: rpm and share of peak torque. */
const TORQUE_CURVE: [number, number][] = [
  [1500, 0.6],
  [3000, 0.72],
  [5000, 0.88],
  [7500, 1],
  [9500, 0.92],
  [11000, 0.78],
]
const RPM_PER_RAD_S = 60 / (2 * Math.PI)
/** The limiter fades the drive out over the last 200 rpm, so it can't chatter. */
const LIMITER_FADE_RPM = 200

/**
 * Automatic clutch: no grip below `start` rpm, full grip at the bite rpm,
 * which rises with throttle from `biteShut` to `biteOpen`. Full grip holds
 * `torque` N·m (twice peak, so a locked clutch never slips by itself).
 */
const CLUTCH = { start: 1700, biteShut: 2000, biteOpen: 8000, torque: 100 }
/** Engine and wheel closer than this (rad/s at the engine) count as turning together. */
const LOCK_SLIP = 2

/** Automatic gearbox: shift points in rpm and timing in seconds. */
const SHIFT = {
  /** Up-shift point, shut throttle → wide open. */
  upShut: 6500,
  upOpen: 10600,
  /** Up-shifts at least this far below the rev limit. */
  belowLimit: 300,
  /** A lower gear must land this far below its up-shift point. */
  downRoom: 1500,
  /** Down-shift below these. */
  downAlways: 3000,
  downBraking: 5000,
  kickDown: 6000,
  /** Throttle past this kicks down. */
  kickThrottle: 0.8,
  /** How long a shift takes (clutch open, no drive). */
  time: 0.08,
  /** Least time from one shift to the next. */
  gap: 0.3,
  /** Throttle blip while shifting down. */
  blip: 0.5,
  /** After a shift (or Space) the clutch feeds back in over this long, so it doesn't kick the wheel loose. */
  feed: 0.1,
}

export type ClutchState = 'locked' | 'slipping' | 'shifting'

/**
 * Engine, automatic clutch and automatic 5-speed gearbox. Each physics step:
 * `drive()` before the wheels (torque on the rear wheel, plus the inertia the
 * engine adds to it while the clutch is locked), `settle()` after them.
 */
export class Drivetrain {
  gear = 1
  /** Engine speed, rad/s. */
  engineSpin = IDLE_RPM / RPM_PER_RAD_S
  /** How hard the clutch grips, 0–1. */
  clutch = 0
  /** Engine torque at the crank this step, N·m. */
  engineTorque = 0
  private locked = false
  private shiftLeft = 0
  private shiftDown = false
  private sinceShift = Infinity
  /** Time since the rider last had the clutch pulled (Space). */
  private sinceClutchIn = Infinity

  get rpm(): number {
    return this.engineSpin * RPM_PER_RAD_S
  }

  /** Shifting up: the ignition is cut, the engine is silent. */
  get ignitionCut(): boolean {
    return this.shiftLeft > 0 && !this.shiftDown
  }

  get state(): ClutchState {
    if (this.shiftLeft > 0) return 'shifting'
    return this.locked ? 'locked' : 'slipping'
  }

  /** Where it shifts up at this throttle, rpm (always short of the limiter). */
  upShiftRpm(throttle: number, revLimit: number): number {
    return Math.min(SHIFT.upShut + (SHIFT.upOpen - SHIFT.upShut) * throttle, revLimit - SHIFT.belowLimit)
  }

  /** Back to idle in 1st, as after a drop. */
  reset(): void {
    this.gear = 1
    this.engineSpin = IDLE_RPM / RPM_PER_RAD_S
    this.clutch = 0
    this.engineTorque = 0
    this.locked = false
    this.shiftLeft = 0
    this.sinceShift = Infinity
    this.sinceClutchIn = Infinity
  }

  /**
   * `throttle` is what reaches the engine; `wanted` is what the rider asks
   * for (before rider control), which the clutch and gearbox go by.
   * No shifting while the rear wheel is off the ground (`grounded`).
   * `clutchIn`: the rider has pulled the clutch (Space, to lock the rear).
   */
  drive(
    dt: number,
    throttle: number,
    brake: number,
    wheelSpin: number,
    p: BikeParams,
    wanted = throttle,
    grounded = true,
    clutchIn = false,
  ): { torque: number; inertia: number } {
    this.sinceShift += dt
    this.sinceClutchIn = clutchIn ? 0 : this.sinceClutchIn + dt
    this.shiftLeft = Math.max(0, this.shiftLeft - dt)
    if (grounded) this.chooseGear(wanted, brake, wheelSpin, p)
    const ratio = p.gears[this.gear - 1]

    // While shifting the clutch is open: up-shifts cut the ignition, down-shifts blip.
    const shifting = this.shiftLeft > 0
    const open = shifting ? (this.shiftDown ? Math.max(throttle, SHIFT.blip) : 0) : throttle
    const rpm = this.rpm
    const limiter = clamp01((p.revLimit - rpm) / LIMITER_FADE_RPM)
    const pull = torqueCurve(rpm) * p.peakTorque * open * limiter
    // Engine braking only above idle: below it the clutch lets go anyway.
    const aboveIdle = clamp01((rpm - IDLE_RPM) / (p.revLimit - IDLE_RPM))
    this.engineTorque = pull - (1 - open) * p.engineBraking * aboveIdle

    const bite = CLUTCH.biteShut + (CLUTCH.biteOpen - CLUTCH.biteShut) * wanted
    // After a shift or letting go of a pulled clutch, it feeds back in.
    const feeding = clamp01(Math.min(this.sinceShift - SHIFT.time, this.sinceClutchIn) / SHIFT.feed)
    this.clutch = shifting || clutchIn ? 0 : clamp01((rpm - CLUTCH.start) / (bite - CLUTCH.start)) ** 2 * feeding
    const grip = this.clutch * CLUTCH.torque

    if (this.locked && (grip <= 0 || Math.abs(this.engineTorque) > grip)) this.locked = false
    if (this.locked) {
      return { torque: this.engineTorque * ratio * DRIVETRAIN_EFFICIENCY, inertia: ENGINE_INERTIA * ratio ** 2 }
    }

    // Slipping: the clutch drags engine and wheel toward the same speed.
    const slip = this.engineSpin - ratio * wheelSpin
    // Just unlocked (no slip yet): the clutch passes what it can of the engine's pull.
    const clutchTorque =
      Math.abs(slip) < 1e-9 ? Math.sign(this.engineTorque) * Math.min(grip, Math.abs(this.engineTorque)) : Math.sign(slip) * grip
    const next = this.engineSpin + ((this.engineTorque - clutchTorque) * dt) / ENGINE_INERTIA
    const nextSlip = next - ratio * wheelSpin
    const met = Math.sign(nextSlip) !== Math.sign(slip) || Math.abs(nextSlip) < LOCK_SLIP
    if (grip > 0 && met && Math.abs(this.engineTorque) <= grip) {
      this.locked = true
      this.engineSpin = ratio * wheelSpin
      return { torque: this.engineTorque * ratio * DRIVETRAIN_EFFICIENCY, inertia: ENGINE_INERTIA * ratio ** 2 }
    }
    this.engineSpin = Math.max(next, IDLE_RPM / RPM_PER_RAD_S) // the idle keeps it running
    return { torque: clutchTorque * ratio * DRIVETRAIN_EFFICIENCY, inertia: 0 }
  }

  /** After the wheels have moved: a locked engine turns with the rear wheel. */
  settle(wheelSpin: number, p: BikeParams): void {
    if (this.locked) this.engineSpin = p.gears[this.gear - 1] * wheelSpin
  }

  private chooseGear(throttle: number, brake: number, wheelSpin: number, p: BikeParams): void {
    if (this.shiftLeft > 0 || this.sinceShift < SHIFT.gap) return
    const ratio = p.gears[this.gear - 1]
    // What the engine turns at in this gear once the clutch is home.
    const geared = wheelSpin * ratio * RPM_PER_RAD_S
    const up = this.upShiftRpm(throttle, p.revLimit)
    const overRev = geared > p.revLimit - SHIFT.belowLimit
    if (this.gear < p.gears.length && geared > up && (brake < 0.1 || overRev)) {
      this.shift(false)
      return
    }
    if (this.gear === 1) return
    const lower = (geared * p.gears[this.gear - 2]) / ratio
    if (lower > up - SHIFT.downRoom) return
    const braking = brake >= 0.1 && geared < SHIFT.downBraking
    const kick = throttle > SHIFT.kickThrottle && geared < SHIFT.kickDown
    if (braking || kick || geared < SHIFT.downAlways) this.shift(true)
  }

  private shift(down: boolean): void {
    this.gear += down ? -1 : 1
    this.shiftDown = down
    this.shiftLeft = SHIFT.time
    this.sinceShift = 0
    this.locked = false
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Share of peak torque at `rpm`, read off the torque curve. */
function torqueCurve(rpm: number): number {
  const c = TORQUE_CURVE
  if (rpm <= c[0][0]) return c[0][1]
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) {
      const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0])
      return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t
    }
  }
  return c[c.length - 1][1]
}
