import { Vector3, type PerspectiveCamera } from 'three'

/** Where the follow camera sits: metres behind and above the bike, and how quickly it catches up. */
const FOLLOW = {
  behind: 6,
  above: 2.5,
  /** Looks at a point this far above the bike. */
  lookAbove: 1,
  /** Seconds to close most of the gap to where it should be (smaller = stiffer). */
  lag: 0.25,
}

/** A simple camera that trails behind the bike (step F brings the real chase camera). */
export class FollowCamera {
  private readonly heading = new Vector3(0, 0, -1)

  constructor(private readonly camera: PerspectiveCamera) {}

  /** Moves toward the spot behind `bike` (facing `nose`), easing in over `FOLLOW.lag`. */
  update(dt: number, bike: Vector3, nose: Vector3): void {
    const ease = 1 - Math.exp(-dt / FOLLOW.lag)
    const flat = nose.clone().setY(0)
    if (flat.lengthSq() > 1e-4) this.heading.lerp(flat.normalize(), ease).normalize()
    this.camera.position.lerp(this.spot(bike), ease)
    this.camera.lookAt(bike.x, bike.y + FOLLOW.lookAbove, bike.z)
  }

  /** Jumps straight to the spot behind the bike. */
  snap(bike: Vector3, nose: Vector3): void {
    const flat = nose.clone().setY(0)
    if (flat.lengthSq() > 1e-4) this.heading.copy(flat.normalize())
    this.camera.position.copy(this.spot(bike))
    this.camera.lookAt(bike.x, bike.y + FOLLOW.lookAbove, bike.z)
  }

  private spot(bike: Vector3): Vector3 {
    return bike.clone().addScaledVector(this.heading, -FOLLOW.behind).add(new Vector3(0, FOLLOW.above, 0))
  }
}
