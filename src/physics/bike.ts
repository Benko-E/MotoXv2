import { Quaternion, Vector3 } from 'three'
import { Drivetrain } from './drivetrain'

/** Everything about the bike you can tune. Forces in N, lengths in m. */
export type BikeParams = {
  bikeMass: number
  riderMass: number
  /** Suspension travel, each wheel. */
  travel: number
  /** Spring stiffness, N per metre of compression. */
  frontSpring: number
  rearSpring: number
  /** Damping, N per m/s of compression speed. */
  frontDamping: number
  rearDamping: number
  /** Tyre friction coefficient: the most a tyre can push is grip × its load. */
  grip: number
  /** Share of grip left while the tyre is sliding (0–1). */
  slideGrip: number
  /** The engine's best torque, N·m (at 7500 rpm). */
  peakTorque: number
  /** Engine turns per rear wheel turn in each gear, 1st first. */
  gears: number[]
  /** No drive above this, rpm. */
  revLimit: number
  /** Engine braking torque at the limiter with the throttle shut, N·m. */
  engineBraking: number
  /** Most brake torque on each wheel, N·m. */
  frontBrake: number
  rearBrake: number
  /**
   * Temporary stand-in for the rider: eases the throttle off as a wheelie
   * gets high, and the front brake off as the rear lifts (a stoppie).
   */
  riderControl: boolean
  /** The bike can fall over (off: only upside down still counts as down). */
  canCrash: boolean
  /** Most lean, radians: the rider leans into a turn as far as it needs, up to this. */
  maxLean: number
  /** How far A/D turn the bars, radians (slow; faster they turn less, see `turnAtSpeed`). */
  barLock: number
  /** How tight it turns at speed: 1 = as tight as the tyres hold, less leaves grip spare. */
  turnAtSpeed: number
  /** How far the rider moves back (↓) on the bike, m (forward is 80 % of it). */
  riderReach: number
  /** Leaning further than this is a crash, radians. */
  crashLean: number
}

export const DEFAULT_BIKE: BikeParams = {
  bikeMass: 105,
  riderMass: 75,
  travel: 0.3,
  frontSpring: 9000,
  rearSpring: 10000,
  frontDamping: 1200,
  rearDamping: 1200,
  grip: 1,
  slideGrip: 0.8,
  peakTorque: 50,
  gears: [19, 15.2, 12.6, 10.9, 9.5],
  revLimit: 11000,
  engineBraking: 12,
  frontBrake: 450,
  rearBrake: 300,
  riderControl: true,
  canCrash: true,
  maxLean: (35 * Math.PI) / 180,
  barLock: (45 * Math.PI) / 180,
  turnAtSpeed: 0.7,
  riderReach: 0.3,
  crashLean: (70 * Math.PI) / 180,
}

export type Terrain = { heightAt(x: number, z: number): number }
/** What the player asks for. Throttle and brakes 0 (off) to 1 (fully on). */
export type BikeInput = {
  throttle: number
  /** Both brakes. */
  brake: number
  /** Rear brake only (Space). */
  rearBrake?: number
  /** A/D: −1 (left) … 1 (right). */
  steer?: number
  /** ↓/↑: −1 (rider back) … 1 (rider forward onto the bars). */
  riderShift?: number
}

/** What one wheel is doing this step (for drawing and debug). */
export type WheelState = {
  /** Metres the suspension is pushed in (0 = fully extended). */
  compression: number
  /** The spring + damper force, N. */
  force: number
  contact: boolean
  /** Wheel centre in the world. */
  center: Vector3
  /** Where the tyre touches the ground. */
  contactPoint: Vector3
  /** The ground's push on the tyre (load + friction), N. */
  groundForce: Vector3
  /** Where the tyre is stuck to the ground while it grips (it slides past grip × load). */
  anchor: Vector3
  anchored: boolean
  /** How fast the wheel turns, rad/s (positive = rolling forward). */
  spin: number
  /** How far it has turned, for drawing. */
  angle: number
  /** Slip: (tread speed − ground speed) ÷ ground speed. 0 = rolling cleanly. */
  slip: number
  /** The tyre is sliding (past its grip), not gripping. */
  sliding: boolean
  /** Sideways slip angle: how far the tyre's path is from where it points, radians. */
  slipAngle: number
}

/** A point of the bike or rider that can hit the ground (for drawing and debug). */
export type BodyPoint = {
  /** Where it is in the world this step. */
  at: Vector3
  touching: boolean
  /** Rider or bars: touching the ground is a crash. */
  crashes: boolean
}

const GRAVITY = 9.81
/** Box the mass is spread through, for how hard it is to turn: width, height, length. */
const SHAPE = { w: 0.8, h: 1.2, l: 2.1 }
/** Suspension mounts, relative to the centre of mass (nose is −z). */
const MOUNTS = { front: new Vector3(0, -0.1, -0.74), rear: new Vector3(0, -0.1, 0.74) }
/** Front axle to rear axle, m. */
const WHEELBASE = MOUNTS.rear.z - MOUNTS.front.z
const RADIUS = { front: 0.36, rear: 0.34 }
/** Radius of the tyre's round crown (across the tread), m. */
const TYRE_CROWN = 0.07
/** Wheel inertia, kg·m². The rear also spins the engine while the clutch is locked. */
const WHEEL_INERTIA = { front: 0.9, rear: 1.0 }
/** Past full travel: a very stiff, well-damped stop, so bottoming out doesn't bounce. */
const BUMP_STOP = { stiffness: 200000, damping: 8000 }
const ROLLING_RESISTANCE = 0.02
/** How stiffly a gripping tyre resists sliding, N per m/s (it then caps at grip × load). */
const TYRE_STIFFNESS = 8000
/** How hard a gripping tyre pulls back to the spot it's stuck to, N per metre. */
const STICK_STIFFNESS = 60000
/**
 * A wheel leaning further than this from the ground (cosine of 60°) doesn't
 * touch it: that's a crash, for the body to handle, not the suspension.
 */
const MIN_ALONG = 0.5
/** From MIN_ALONG up to this much more, the wheel's push fades in (so a fallen bike rolling back can't be kicked). */
const ALONG_FADE = 0.1
/**
 * Temporary wheelie control (step E replaces it with rider lean): the
 * throttle eases off from `start` to fully shut at `start + range` of
 * wheelie, looking `ahead` seconds forward at how fast the nose is rising.
 */
const WHEELIE = { start: (20 * Math.PI) / 180, range: (15 * Math.PI) / 180, ahead: 0.2 }
/** The same for the front brake, nose down. */
const STOPPIE = { start: (4 * Math.PI) / 180, range: (8 * Math.PI) / 180, ahead: 0.2 }
/** Turning (A/D held), he keeps the front down: the wheelie limit drops to this. */
const TURNING_WHEELIE_START = (2 * Math.PI) / 180
/**
 * Leaned over, he eases off the throttle as the rear wheel spins up: from
 * `start` slip to fully shut at `start + range`, counting fully from `lean`.
 */
const SPIN = { start: 0.03, range: 0.07, lean: (15 * Math.PI) / 180 }
/** And as either tyre slides sideways: from `start` to fully shut at `start + range`, radians. */
const SKID = { start: (2 * Math.PI) / 180, range: (4 * Math.PI) / 180 }
/** Rolling backwards faster than this (m/s) with no throttle, he holds the brakes. */
const ROLL_BACK = 0.1
/** How fast his weight moves the bike's centre of mass, m/s. */
const COM_SHIFT_SPEED = 0.5
/** How far forward (share of his reach) he sits while turning. */
const TURN_FORWARD = 0.6
/**
 * The rider's balance: he twists the bike to the lean its turn needs, N·m
 * per radian off and per rad/s of lean speed, at most `most` N·m.
 */
const BALANCE = { stiffness: 20000, damping: 1500, most: 4000 }
/**
 * How long he takes to swing the bars as far as they may go, s. Faster, where
 * they may go less far, he moves them slower: a flick at speed slides the front.
 */
const STEER_TIME = 0.25
/** How fast the bars straighten when the rider has let go, rad/s. */
const LET_GO_RATE = 2
/** How fast he straightens them himself with the front wheel in the air, rad/s. */
const STEER_RATE_AIR = 4
/** Where the rider's weight goes, per metre of reach (local, nose is −z): back is also lower. */
const RIDER_BACK = new Vector3(0, -0.3, 1)
const RIDER_FORWARD = new Vector3(0, 0.15, -0.8)
/**
 * Points that can hit the ground, relative to the centre of mass with the
 * rider sitting normally (nose −z, right +x). `crashes`: rider and bars;
 * `rider`: moves with him when he shifts his weight.
 */
const BODY_POINTS: { local: Vector3; crashes: boolean; rider?: boolean }[] = [
  { local: new Vector3(0.22, -0.31, 0.05), crashes: false }, // footpegs
  { local: new Vector3(-0.22, -0.31, 0.05), crashes: false },
  { local: new Vector3(0, -0.33, -0.1), crashes: false }, // engine bottom
  { local: new Vector3(0, 0.1, -1.0), crashes: false }, // front fender
  { local: new Vector3(0, 0.25, 1.0), crashes: false }, // rear fender
  { local: new Vector3(0.42, 0.35, -0.55), crashes: true }, // bar ends
  { local: new Vector3(-0.42, 0.35, -0.55), crashes: true },
  { local: new Vector3(0.25, 0.85, 0.05), crashes: true, rider: true }, // shoulders
  { local: new Vector3(-0.25, 0.85, 0.05), crashes: true, rider: true },
  { local: new Vector3(0, 1.15, 0.05), crashes: true, rider: true }, // head
]
/** Body against the ground: spring + damper out of it, sliding friction along it. */
const BODY = { stiffness: 60000, damping: 3000, friction: 0.5, drag: 3000 }
/** Spacing for reading the ground's slope. */
const SLOPE_STEP = 0.25

export class Bike {
  readonly position = new Vector3()
  readonly orientation = new Quaternion()
  readonly velocity = new Vector3()
  readonly angularVelocity = new Vector3()
  readonly front: WheelState = emptyWheel()
  readonly rear: WheelState = emptyWheel()
  /** Engine, clutch and gearbox. */
  readonly drivetrain = new Drivetrain()
  /** How far the throttle is open this step, 0–1 (after rider control). */
  throttle = 0
  /** The throttle the rider asks for, 0–1. */
  riderThrottle = 0
  /** Share of the rider's throttle rider control took away this step (wheelie, wheelspin, skid), 0–1. */
  throttleCut = 0
  /** Share of the rider's front brake stoppie control took away this step, 0–1. */
  stoppieCut = 0
  /** Nose up (+) or down (−) from the ground under the bike, radians. */
  pitch = 0
  /** Torque the engine sends to the rear wheel this step, N·m (negative = engine braking). */
  driveTorque = 0
  /** Bar angle, radians (+ = right). */
  steer = 0
  /** Lean from upright, radians (+ = right), and the lean the rider is aiming for. */
  lean = 0
  targetLean = 0
  /** Down: the rider has let go until the bike is picked up. */
  crashed = false
  /** Where the rider's weight has moved the centre of mass, in the bike's frame. */
  readonly comShift = new Vector3()
  readonly body: BodyPoint[] = BODY_POINTS.map((b) => ({ at: new Vector3(), touching: false, crashes: b.crashes }))

  constructor(public params: BikeParams) {}

  /** Engine speed, rpm. */
  get rpm(): number {
    return this.drivetrain.rpm
  }

  get mass(): number {
    return this.params.bikeMass + this.params.riderMass
  }

  /** Speed in m/s, whichever way it's going. */
  get speed(): number {
    return this.velocity.length()
  }

  /**
   * Puts the bike `height` metres above the ground at (x, z), at rest,
   * facing `heading` (radians, 0 = north, clockwise).
   */
  drop(x: number, z: number, heading: number, height: number, terrain: Terrain): void {
    const restHeight = this.params.travel - MOUNTS.front.y + RADIUS.front // wheels just touching
    this.position.set(x, terrain.heightAt(x, z) + restHeight + height, z)
    this.orientation.setFromAxisAngle(new Vector3(0, 1, 0), -heading)
    this.velocity.set(0, 0, 0)
    this.angularVelocity.set(0, 0, 0)
    for (const w of [this.front, this.rear]) {
      w.compression = 0
      w.force = 0
      w.contact = false
      w.anchored = false
      w.spin = 0
      w.slip = 0
      w.sliding = false
      w.slipAngle = 0
    }
    this.drivetrain.reset()
    this.steer = 0
    this.lean = 0
    this.targetLean = 0
    this.crashed = false
    this.comShift.set(0, 0, 0)
    this.throttleCut = 0
    this.stoppieCut = 0
  }

  /** Stands a fallen bike back up where it lies, facing the way it was. */
  pickUp(terrain: Terrain): void {
    const nose = new Vector3(0, 0, -1).applyQuaternion(this.orientation).setY(0)
    const heading = nose.lengthSq() < 1e-4 ? 0 : Math.atan2(nose.x, -nose.z)
    this.drop(this.position.x, this.position.z, heading, 0.2, terrain)
  }

  step(dt: number, input: BikeInput, terrain: Terrain): void {
    const p = this.params
    const q = this.orientation
    const up = new Vector3(0, 1, 0).applyQuaternion(q)
    const forward = new Vector3(0, 0, -1).applyQuaternion(q)

    const force = new Vector3(0, -GRAVITY * this.mass, 0)
    const torque = new Vector3()
    const addForceAt = (f: Vector3, at: Vector3) => {
      force.add(f)
      torque.add(at.clone().sub(this.position).cross(f))
    }

    const right = new Vector3(1, 0, 0).applyQuaternion(q)

    // Lean from upright (against gravity), + = right. Turning about the
    // nose axis tips the top to the right.
    const flatRight = right.clone().setY(0)
    if (flatRight.lengthSq() < 1e-6) flatRight.copy(forward).cross(new Vector3(0, 1, 0))
    flatRight.normalize()
    this.lean = Math.atan2(up.dot(flatRight), up.y)
    const leanSpeed = this.angularVelocity.dot(forward)
    const along = this.velocity.dot(forward)

    // The rider: off the bike once it's crashed (he's let go of everything).
    const riding = !this.crashed
    if (!riding) this.steer = straighten(this.steer, LET_GO_RATE * dt)
    // Front wheel off the ground (wheelie, jump): the bars do nothing, so
    // he straightens them for the landing.
    else if (!this.front.contact) this.steer = straighten(this.steer, STEER_RATE_AIR * dt)
    else {
      // A/D turn the bars: all the way slow, faster only as far as the tyres hold.
      const most = barLimit(this.speed, p)
      const wanted = clampSigned(input.steer ?? 0) * most
      const rate = (Math.max(most, Math.abs(this.steer)) / STEER_TIME) * dt
      this.steer += Math.max(-rate, Math.min(rate, wanted - this.steer))
    }
    // He leans as far as the bars' turn pulls sideways against gravity, up to
    // the most lean. (By the bars, not by how it actually turns: that would
    // feed on itself, a lean that turns it asking for more lean.)
    const pull = (along * Math.abs(along) * Math.tan(this.steer)) / WHEELBASE
    this.targetLean = riding ? Math.max(-p.maxLean, Math.min(p.maxLean, Math.atan(pull / GRAVITY))) : 0
    // His weight: back (↓) or forward onto the bars (↑), as a share of the whole bike.
    // Turning, he sits forward to keep weight on the front (unless ↑/↓ say otherwise).
    const turnForward = TURN_FORWARD * Math.abs(clampSigned(input.steer ?? 0))
    const shift = riding ? clampSigned((input.riderShift ?? 0) || turnForward) : 0
    const share = (p.riderMass / this.mass) * p.riderReach
    // He takes a moment to move: the centre of mass follows at a limited speed.
    const wantedShift = (shift < 0 ? RIDER_BACK : RIDER_FORWARD).clone().multiplyScalar(Math.abs(shift) * share)
    const move = wantedShift.sub(this.comShift)
    this.comShift.add(move.clampLength(0, COM_SHIFT_SPEED * dt))

    // Wheelie and stoppie go by the ground under the bike, not the horizon,
    // so climbing and descending hills don't count.
    const slope = groundNormal(terrain, this.position.x, this.position.z)
    const downSlope = forward.clone().addScaledVector(slope, -forward.dot(slope)).normalize()
    this.pitch = Math.asin(Math.max(-1, Math.min(1, forward.y))) - Math.asin(Math.max(-1, Math.min(1, downSlope.y)))
    const rising = this.pitch + WHEELIE.ahead * this.angularVelocity.dot(right)
    const turning = riding ? Math.abs(clampSigned(input.steer ?? 0)) : 0
    const wheelieStart = WHEELIE.start + (TURNING_WHEELIE_START - WHEELIE.start) * turning
    const leaned = clamp01(Math.abs(this.lean) / SPIN.lean)
    const skid = Math.max(Math.abs(this.front.slipAngle), Math.abs(this.rear.slipAngle))
    const spinCut = Math.max(clamp01((this.rear.slip - SPIN.start) / SPIN.range) * leaned, clamp01((skid - SKID.start) / SKID.range))
    this.throttleCut = p.riderControl ? Math.max(clamp01((rising - wheelieStart) / WHEELIE.range), spinCut) : 0
    const diving = -(this.pitch + STOPPIE.ahead * this.angularVelocity.dot(right))
    this.stoppieCut = p.riderControl ? clamp01((diving - STOPPIE.start) / STOPPIE.range) : 0
    const wanted = riding ? clamp01(input.throttle) : 0
    // Space: the rider pulls the clutch and stamps on the rear brake, so it locks.
    const spaceBrake = riding ? clamp01(input.rearBrake ?? 0) : 0
    this.riderThrottle = wanted
    const throttle = wanted * (1 - this.throttleCut)
    this.throttle = throttle
    // Rolling backwards without throttle he holds the brakes: nobody rides backwards on purpose.
    const rollingBack = p.riderControl && along < -ROLL_BACK && wanted === 0
    // He brakes (S, not Space) only as hard as the lean leaves grip for (a
    // steady lean uses tan(lean) of it), and eases off as the tyres slide sideways.
    const cornering = Math.tan(Math.min(Math.abs(this.lean), 1.4)) / p.grip
    const room = Math.sqrt(clamp01(1 - cornering * cornering))
    // (Cubed: braking also moves the weight off the rear tyre, and he keeps
    // some grip spare to stand the bike up.)
    const brakeCut = p.riderControl ? Math.max(1 - room ** 3, clamp01((skid - SKID.start) / SKID.range)) : 0
    const brake = riding ? Math.max(clamp01(input.brake) * (1 - brakeCut), rollingBack ? 1 : 0) : 0
    const rearBrake = Math.max(brake, spaceBrake)
    // The front wheel points where the bars do (turning right = clockwise from above).
    const frontHeading = forward.clone().applyAxisAngle(up, -this.steer)
    const engine = this.drivetrain.drive(dt, throttle, brake, this.rear.spin, p, wanted, this.rear.contact, spaceBrake > 0.5)
    this.driveTorque = engine.torque

    const wheels: [WheelState, Vector3, Vector3, number, number, number, number, number, number][] = [
      [
        this.front,
        MOUNTS.front,
        frontHeading,
        RADIUS.front,
        p.frontSpring,
        p.frontDamping,
        WHEEL_INERTIA.front,
        0,
        brake * p.frontBrake * (1 - this.stoppieCut),
      ],
      [
        this.rear,
        MOUNTS.rear,
        forward,
        RADIUS.rear,
        p.rearSpring,
        p.rearDamping,
        WHEEL_INERTIA.rear + engine.inertia,
        this.driveTorque,
        rearBrake * p.rearBrake,
      ],
    ]
    for (const [wheel, mountLocal, heading, radius, spring, damping, inertia, drive, brakeTorque] of wheels) {
      // The engine turns the wheel; the bike gets the opposite twist (squat, wheelies).
      torque.addScaledVector(right, drive)
      let spin = wheel.spin
      // Brakes slow the wheel and can stop it dead (locked); the bike gets the
      // opposite twist (nose dive under the front brake).
      const brakeMost = (brakeTorque * dt) / inertia
      let brakeTwist = 0 // the last brake decision this step is the one that counts
      const applyBrake = (free: number) => {
        const held = Math.abs(free) <= brakeMost ? 0 : free - Math.sign(free) * brakeMost
        brakeTwist = (-(free - held) * inertia) / dt
        return held
      }
      // The rider's weight moving one way moves the bike the other way under it.
      const mount = mountLocal.clone().sub(this.comShift).applyQuaternion(q).add(this.position)
      const extended = mount.clone().addScaledVector(up, -p.travel)
      const normal = groundNormal(terrain, extended.x, extended.z)
      // How far the wheel would sink into the ground at full extension, along
      // the ground's normal, turned into compression along the suspension.
      const ground = terrain.heightAt(extended.x, extended.z)
      // The tyre is a ring of the wheel's radius with a small round crown, so
      // leaned over it touches down nearer the crown, not under the hub.
      const axle = heading.clone().cross(up).normalize()
      const tilt = axle.dot(normal)
      const toGround = normal.clone().negate().addScaledVector(axle, tilt) // down, within the wheel
      if (toGround.lengthSq() < 1e-9) toGround.copy(up).negate()
      toGround.normalize()
      const reach = TYRE_CROWN + (radius - TYRE_CROWN) * Math.sqrt(Math.max(0, 1 - tilt * tilt))
      const sink = reach - (extended.y - ground) * normal.y
      const upright = up.dot(normal)
      const compression = sink > 0 && upright >= MIN_ALONG ? sink / upright : 0

      if (compression <= 0) {
        wheel.compression = 0
        wheel.force = 0
        wheel.contact = false
        wheel.anchored = false
        wheel.sliding = false
        wheel.slip = 0
        wheel.slipAngle = 0
        wheel.center.copy(extended)
        wheel.groundForce.set(0, 0, 0)
        spin = applyBrake(spin + (drive * dt) / inertia)
      } else {
        // Just touching down, the damper goes by how fast the wheel closes on
        // the ground, not by the jump from nothing to however deep it landed.
        const closing = this.angularVelocity.clone().cross(extended.clone().sub(this.position)).add(this.velocity)
        const speed = wheel.contact ? (compression - wheel.compression) / dt : Math.max(0, -closing.dot(normal)) / upright
        let push = spring * Math.min(compression, p.travel) + damping * speed
        if (compression > p.travel) push += BUMP_STOP.stiffness * (compression - p.travel) + BUMP_STOP.damping * Math.max(speed, 0)
        push = Math.max(push, 0) * clamp01((upright - MIN_ALONG) / ALONG_FADE) // a spring can push the body up, never pull it down
        wheel.compression = compression
        wheel.force = push
        wheel.contact = true
        wheel.center.copy(mount).addScaledVector(up, -(p.travel - Math.min(compression, p.travel)))
        wheel.contactPoint
          .copy(wheel.center)
          .addScaledVector(toGround, radius - TYRE_CROWN)
          .addScaledVector(normal, -TYRE_CROWN)

        // The ground pushes straight out of its surface; the fork carries the
        // part that isn't along the spring, so the spring sets only its size.
        const pressure = push / upright
        const load = normal.clone().multiplyScalar(pressure)
        addForceAt(load, wheel.contactPoint)

        // Tyre: the tread sticks to the ground like a stiff spring plus damper
        // and moves with the wheel's rotation, so any difference between the
        // tread and the ground is slip. Past grip × load it slides.
        const pointVelocity = this.angularVelocity
          .clone()
          .cross(wheel.contactPoint.clone().sub(this.position))
          .add(this.velocity)
        const rolling = heading.clone().addScaledVector(normal, -heading.dot(normal)).normalize()
        const side = rolling.clone().cross(normal)
        if (!wheel.anchored) {
          wheel.anchor.copy(wheel.contactPoint)
          wheel.anchored = true
        }
        wheel.anchor.addScaledVector(rolling, spin * radius * dt) // the tread moves on
        const offset = wheel.contactPoint.clone().sub(wheel.anchor)
        offset.addScaledVector(normal, -offset.dot(normal))
        const dRoll = offset.dot(rolling)
        const dSide = offset.dot(side)
        const vRoll = pointVelocity.dot(rolling)
        const vSide = pointVelocity.dot(side)

        // The wheel's new spin is solved together with the tyre's pull on it
        // (implicitly), so a light wheel against a stiff tyre can't jitter.
        const k = STICK_STIFFNESS
        const c = TYRE_STIFFNESS
        // Brakes act inside the same solve, so a held wheel stays exactly held.
        spin = (spin + (dt / inertia) * (drive + radius * (k * dRoll + c * vRoll))) / (1 + (dt * c * radius * radius) / inertia)
        spin = applyBrake(spin)
        const friction = rolling
          .clone()
          .multiplyScalar(-k * dRoll - c * (vRoll - spin * radius))
          .addScaledVector(side, -k * dSide - c * vSide)
        const grip = p.grip * pressure * (wheel.sliding ? p.slideGrip : 1)
        wheel.sliding = friction.length() > grip
        if (wheel.sliding) {
          friction.setLength(grip)
          // Sliding: the wheel answers to the capped force, and the tread
          // re-sticks where the capped force puts it.
          spin = applyBrake(wheel.spin + (dt / inertia) * (drive - friction.dot(rolling) * radius))
          wheel.anchor.copy(wheel.contactPoint).addScaledVector(friction, 1 / k)
        }
        friction.addScaledVector(rolling, -ROLLING_RESISTANCE * pressure * Math.tanh(vRoll / 0.1))
        // Grip along the wheel pushes the bike at the axle; the twist it puts
        // on the wheel reaches the bike through the brake and the chain. The
        // wheel can't turn sideways, so grip across it acts at the ground.
        const across = side.clone().multiplyScalar(friction.dot(side))
        addForceAt(friction.clone().sub(across), wheel.center)
        addForceAt(across, wheel.contactPoint)
        wheel.groundForce.copy(load).add(friction)
        wheel.slip = (spin * radius - vRoll) / Math.max(Math.abs(vRoll), 1)
        wheel.slipAngle = Math.abs(vRoll) + Math.abs(vSide) > 0.5 ? Math.atan2(vSide, Math.abs(vRoll)) : 0
      }

      torque.addScaledVector(right, brakeTwist)
      wheel.spin = spin
      wheel.angle = (wheel.angle + spin * dt) % (2 * Math.PI)
    }

    this.drivetrain.settle(this.rear.spin, p)

    // The bike's body and the rider against the ground.
    let riderDown = false
    // The rider himself moves by his reach: the centre of mass moves by his share of it.
    const riderMove = this.comShift.clone().multiplyScalar(this.mass / p.riderMass)
    BODY_POINTS.forEach((b, n) => {
      const point = this.body[n]
      point.at.copy(b.local).sub(this.comShift)
      if (b.rider) point.at.add(riderMove)
      point.at.applyQuaternion(q).add(this.position)
      const normal = groundNormal(terrain, point.at.x, point.at.z)
      const depth = (terrain.heightAt(point.at.x, point.at.z) - point.at.y) * normal.y
      point.touching = depth > 0
      if (!point.touching) return
      if (point.crashes) riderDown = true
      const velocity = this.angularVelocity.clone().cross(point.at.clone().sub(this.position)).add(this.velocity)
      const into = velocity.dot(normal)
      const push = Math.max(BODY.stiffness * depth - BODY.damping * into, 0)
      const slide = velocity.addScaledVector(normal, -into).multiplyScalar(-BODY.drag)
      if (slide.length() > BODY.friction * push) slide.setLength(BODY.friction * push)
      addForceAt(slide.addScaledVector(normal, push), point.at)
    })
    if (p.canCrash && riding && (riderDown || Math.abs(this.lean) > p.crashLean)) this.crashed = true
    // Upside down is down, switch or no switch (the invisible hand can't tell which way to push).
    if (riding && up.y < 0) this.crashed = true

    // On the ground the rider holds the bike at the lean its turn needs, so it
    // doesn't fall over by itself (in the air there's nothing to push against).
    const touching = [this.front, this.rear].filter((w) => w.contact)
    if (!this.crashed && touching.length > 0) {
      const twist = BALANCE.stiffness * (this.lean - this.targetLean) + BALANCE.damping * leanSpeed
      // He rolls it about where the tyres touch the ground, not about its
      // middle, so his balancing doesn't shove the tyres sideways.
      const pivot = touching.reduce((sum, w) => sum.add(w.contactPoint), new Vector3()).divideScalar(touching.length)
      const arm = this.position.clone().sub(pivot)
      arm.addScaledVector(forward, -arm.dot(forward))
      const rollInertia = (this.mass / 12) * (SHAPE.w ** 2 + SHAPE.h ** 2)
      const twistMost = Math.max(-BALANCE.most, Math.min(BALANCE.most, twist))
      const roll = forward.clone().multiplyScalar(-twistMost / (rollInertia + this.mass * arm.lengthSq()))
      torque.addScaledVector(roll, rollInertia)
      force.add(roll.clone().cross(arm).multiplyScalar(this.mass))
    }

    this.integrate(dt, force, torque)
  }

  /** Moves and turns the body by one step (semi-implicit Euler). */
  private integrate(dt: number, force: Vector3, torque: Vector3): void {
    this.velocity.addScaledVector(force, dt / this.mass)
    this.position.addScaledVector(this.velocity, dt)

    // Turning is worked out in the bike's own frame, where its inertia is simple.
    const m = this.mass / 12
    const inertia = new Vector3(
      m * (SHAPE.h ** 2 + SHAPE.l ** 2),
      m * (SHAPE.w ** 2 + SHAPE.l ** 2),
      m * (SHAPE.w ** 2 + SHAPE.h ** 2),
    )
    const toLocal = this.orientation.clone().invert()
    const w = this.angularVelocity.clone().applyQuaternion(toLocal)
    const t = torque.clone().applyQuaternion(toLocal)
    const spin = w.clone().cross(w.clone().multiply(inertia)) // the gyroscopic part
    w.add(t.sub(spin).divide(inertia).multiplyScalar(dt))
    this.angularVelocity.copy(w.applyQuaternion(this.orientation))

    const o = this.angularVelocity
    const dq = new Quaternion(o.x * dt * 0.5, o.y * dt * 0.5, o.z * dt * 0.5, 0).multiply(this.orientation)
    this.orientation.set(
      this.orientation.x + dq.x,
      this.orientation.y + dq.y,
      this.orientation.z + dq.z,
      this.orientation.w + dq.w,
    )
    this.orientation.normalize()
  }
}

/**
 * How far the bars may turn at `speed` m/s, radians. At bar angle a the
 * bike goes round a circle of wheelbase ÷ tan(a), so it pulls sideways with
 * speed² × tan(a) ÷ wheelbase, which the tyres hold up to grip × g.
 */
export function barLimit(speed: number, p: BikeParams): number {
  const tyres = Math.atan((WHEELBASE * p.grip * GRAVITY * p.turnAtSpeed) / Math.max(speed * speed, 1e-6))
  return Math.min(p.barLock, tyres)
}

/** Moves the bars `by` radians back towards straight, stopping there. */
function straighten(steer: number, by: number): number {
  return steer - Math.sign(steer) * Math.min(Math.abs(steer), by)
}

function emptyWheel(): WheelState {
  return {
    compression: 0,
    force: 0,
    contact: false,
    center: new Vector3(),
    contactPoint: new Vector3(),
    groundForce: new Vector3(),
    anchor: new Vector3(),
    anchored: false,
    spin: 0,
    angle: 0,
    slip: 0,
    sliding: false,
    slipAngle: 0,
  }
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** The ground's upward-facing normal at (x, z), from the heights around it. */
function groundNormal(terrain: Terrain, x: number, z: number): Vector3 {
  const s = SLOPE_STEP
  const dx = terrain.heightAt(x + s, z) - terrain.heightAt(x - s, z)
  const dz = terrain.heightAt(x, z + s) - terrain.heightAt(x, z - s)
  return new Vector3(-dx, 2 * s, -dz).normalize()
}
