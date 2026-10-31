import { Quaternion, Vector3 } from 'three'

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
  /** The temporary push key's force (stand-in for the engine). */
  push: number
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
  push: 600,
}

export type Terrain = { heightAt(x: number, z: number): number }
export type BikeInput = { push: boolean; brake: boolean }

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
}

const GRAVITY = 9.81
/** Box the mass is spread through, for how hard it is to turn: width, height, length. */
const SHAPE = { w: 0.8, h: 1.2, l: 2.1 }
/** Suspension mounts, relative to the centre of mass (nose is −z). */
const MOUNTS = { front: new Vector3(0, -0.1, -0.74), rear: new Vector3(0, -0.1, 0.74) }
const RADIUS = { front: 0.36, rear: 0.34 }
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

  constructor(public params: BikeParams) {}

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
    }
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

    const wheels: [WheelState, Vector3, number, number, number][] = [
      [this.front, MOUNTS.front, RADIUS.front, p.frontSpring, p.frontDamping],
      [this.rear, MOUNTS.rear, RADIUS.rear, p.rearSpring, p.rearDamping],
    ]
    for (const [wheel, mountLocal, radius, spring, damping] of wheels) {
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
        wheel.center.copy(extended)
        wheel.groundForce.set(0, 0, 0)
        continue
      }

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

      // Tyre: sticks to the ground sideways (and along, when braking) like a
      // stiff spring to the spot it touched down on, until the force needed
      // passes grip × load; then it slides and sticks again where it is.
      const grip = p.grip * pressure
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
      const offset = wheel.contactPoint.clone().sub(wheel.anchor)
      offset.addScaledVector(normal, -offset.dot(normal))
      const slide = pointVelocity.clone().addScaledVector(normal, -pointVelocity.dot(normal))
      if (!input.brake) {
        // Rolling freely: the stuck spot rolls along with the wheel.
        const rolled = offset.dot(rolling)
        wheel.anchor.addScaledVector(rolling, rolled)
        offset.addScaledVector(rolling, -rolled)
        slide.copy(side).multiplyScalar(pointVelocity.dot(side))
      }
      const friction = offset.multiplyScalar(-STICK_STIFFNESS).addScaledVector(slide, -TYRE_STIFFNESS)
      if (friction.length() > grip) {
        friction.setLength(grip)
        wheel.anchor.copy(wheel.contactPoint) // broke loose
      }
      if (!input.brake) friction.addScaledVector(rolling, -ROLLING_RESISTANCE * pressure * Math.tanh(pointVelocity.dot(rolling) / 0.1))
      addForceAt(friction, wheel.contactPoint)
      wheel.groundForce.copy(load).add(friction)
    }

    if (input.push && (this.front.contact || this.rear.contact)) force.addScaledVector(forward, p.push)

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
  }
}

/** The ground's upward-facing normal at (x, z), from the heights around it. */
function groundNormal(terrain: Terrain, x: number, z: number): Vector3 {
  const s = SLOPE_STEP
  const dx = terrain.heightAt(x + s, z) - terrain.heightAt(x - s, z)
  const dz = terrain.heightAt(x, z + s) - terrain.heightAt(x, z - s)
  return new Vector3(-dx, 2 * s, -dz).normalize()
}
