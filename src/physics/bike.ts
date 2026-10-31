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
}

export type Terrain = { heightAt(x: number, z: number): number }
/** Throttle and brake, each 0 (off) to 1 (fully on). */
export type BikeInput = { throttle: number; brake: number }

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
}

const GRAVITY = 9.81
/** Box the mass is spread through, for how hard it is to turn: width, height, length. */
const SHAPE = { w: 0.8, h: 1.2, l: 2.1 }
/** Suspension mounts, relative to the centre of mass (nose is −z). */
const MOUNTS = { front: new Vector3(0, -0.1, -0.74), rear: new Vector3(0, -0.1, 0.74) }
const RADIUS = { front: 0.36, rear: 0.34 }
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
/**
 * Temporary wheelie control (step E replaces it with rider lean): the
 * throttle eases off from `start` to fully shut at `start + range` of
 * wheelie, looking `ahead` seconds forward at how fast the nose is rising.
 */
const WHEELIE = { start: (20 * Math.PI) / 180, range: (15 * Math.PI) / 180, ahead: 0.2 }
/** The same for the front brake, nose down. */
const STOPPIE = { start: (4 * Math.PI) / 180, range: (8 * Math.PI) / 180, ahead: 0.2 }
/** Temporary upright assist (step D replaces it with steering balance). */
const UPRIGHT = { stiffness: 4000, damping: 600 }
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
  /** How far the throttle is open this step, 0–1 (after wheelie control). */
  throttle = 0
  /** The throttle the rider asks for, 0–1. */
  riderThrottle = 0
  /** Share of the rider's throttle wheelie control took away this step, 0–1. */
  wheelieCut = 0
  /** Share of the rider's front brake stoppie control took away this step, 0–1. */
  stoppieCut = 0
  /** Nose up (+) or down (−) from the ground under the bike, radians. */
  pitch = 0
  /** Torque the engine sends to the rear wheel this step, N·m (negative = engine braking). */
  driveTorque = 0

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
    }
    this.drivetrain.reset()
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

    // Wheelie and stoppie go by the ground under the bike, not the horizon,
    // so climbing and descending hills don't count.
    const slope = groundNormal(terrain, this.position.x, this.position.z)
    const along = forward.clone().addScaledVector(slope, -forward.dot(slope)).normalize()
    this.pitch = Math.asin(Math.max(-1, Math.min(1, forward.y))) - Math.asin(Math.max(-1, Math.min(1, along.y)))
    const rising = this.pitch + WHEELIE.ahead * this.angularVelocity.dot(right)
    this.wheelieCut = p.riderControl ? clamp01((rising - WHEELIE.start) / WHEELIE.range) : 0
    const diving = -(this.pitch + STOPPIE.ahead * this.angularVelocity.dot(right))
    this.stoppieCut = p.riderControl ? clamp01((diving - STOPPIE.start) / STOPPIE.range) : 0
    const wanted = clamp01(input.throttle)
    this.riderThrottle = wanted
    const throttle = wanted * (1 - this.wheelieCut)
    this.throttle = throttle
    const brake = clamp01(input.brake)
    const engine = this.drivetrain.drive(dt, throttle, brake, this.rear.spin, p, wanted, this.rear.contact)
    this.driveTorque = engine.torque

    const wheels: [WheelState, Vector3, number, number, number, number, number, number][] = [
      [this.front, MOUNTS.front, RADIUS.front, p.frontSpring, p.frontDamping, WHEEL_INERTIA.front, 0, p.frontBrake * (1 - this.stoppieCut)],
      [
        this.rear,
        MOUNTS.rear,
        RADIUS.rear,
        p.rearSpring,
        p.rearDamping,
        WHEEL_INERTIA.rear + engine.inertia,
        this.driveTorque,
        p.rearBrake,
      ],
    ]
    for (const [wheel, mountLocal, radius, spring, damping, inertia, drive, brakeMax] of wheels) {
      // The engine turns the wheel; the bike gets the opposite twist (squat, wheelies).
      torque.addScaledVector(right, drive)
      let spin = wheel.spin
      // Brakes slow the wheel and can stop it dead (locked); the bike gets the
      // opposite twist (nose dive under the front brake).
      const brakeMost = (brake * brakeMax * dt) / inertia
      let brakeTwist = 0 // the last brake decision this step is the one that counts
      const applyBrake = (free: number) => {
        const held = Math.abs(free) <= brakeMost ? 0 : free - Math.sign(free) * brakeMost
        brakeTwist = (-(free - held) * inertia) / dt
        return held
      }
      const mount = mountLocal.clone().applyQuaternion(q).add(this.position)
      const extended = mount.clone().addScaledVector(up, -p.travel)
      const normal = groundNormal(terrain, extended.x, extended.z)
      // How far the wheel would sink into the ground at full extension, along
      // the ground's normal, turned into compression along the suspension.
      const ground = terrain.heightAt(extended.x, extended.z)
      const sink = radius - (extended.y - ground) * normal.y
      const along = up.dot(normal)
      const compression = sink > 0 && along >= MIN_ALONG ? sink / along : 0

      if (compression <= 0) {
        wheel.compression = 0
        wheel.force = 0
        wheel.contact = false
        wheel.anchored = false
        wheel.sliding = false
        wheel.slip = 0
        wheel.center.copy(extended)
        wheel.groundForce.set(0, 0, 0)
        spin = applyBrake(spin + (drive * dt) / inertia)
      } else {
        const speed = (compression - wheel.compression) / dt
        let push = spring * Math.min(compression, p.travel) + damping * speed
        if (compression > p.travel) push += BUMP_STOP.stiffness * (compression - p.travel) + BUMP_STOP.damping * Math.max(speed, 0)
        push = Math.max(push, 0) // a spring can push the body up, never pull it down
        wheel.compression = compression
        wheel.force = push
        wheel.contact = true
        wheel.center.copy(mount).addScaledVector(up, -(p.travel - Math.min(compression, p.travel)))
        wheel.contactPoint.copy(wheel.center).addScaledVector(normal, -radius)

        // The ground pushes straight out of its surface; the fork carries the
        // part that isn't along the spring, so the spring sets only its size.
        const pressure = push / along
        const load = normal.clone().multiplyScalar(pressure)
        addForceAt(load, wheel.contactPoint)

        // Tyre: the tread sticks to the ground like a stiff spring plus damper
        // and moves with the wheel's rotation, so any difference between the
        // tread and the ground is slip. Past grip × load it slides.
        const pointVelocity = this.angularVelocity
          .clone()
          .cross(wheel.contactPoint.clone().sub(this.position))
          .add(this.velocity)
        const rolling = forward.clone().addScaledVector(normal, -forward.dot(normal)).normalize()
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
      }

      torque.addScaledVector(right, brakeTwist)
      wheel.spin = spin
      wheel.angle = (wheel.angle + spin * dt) % (2 * Math.PI)
    }

    this.drivetrain.settle(this.rear.spin, p)

    // Upright assist: twist round the long axis back towards vertical
    // (only with a wheel on the ground: in the air that's the rider's job).
    const grounded = this.front.contact || this.rear.contact
    const target = new Vector3(0, 1, 0).addScaledVector(forward, -forward.y).normalize()
    const lean = Math.atan2(up.clone().cross(target).dot(forward), up.dot(target))
    if (grounded) torque.addScaledVector(forward, UPRIGHT.stiffness * lean - UPRIGHT.damping * this.angularVelocity.dot(forward))

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
  }
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
