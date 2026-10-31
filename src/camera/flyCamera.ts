import { MathUtils, type PerspectiveCamera } from 'three'
import type { Input } from './input'

/** Flying feel. Not in the menu yet. */
export const FLY = {
  /** Metres per second. */
  speed: 40,
  /** Speed × this while Shift is held. */
  fastMultiplier: 5,
  /** Radians turned per pixel of mouse movement. */
  lookSensitivity: 0.002,
}

const MAX_PITCH = MathUtils.degToRad(89)

/**
 * A free camera. WASD fly level with the ground whichever way you look,
 * Space goes up, C goes down, Shift goes faster, the mouse looks around.
 */
export class FlyCamera {
  private yaw = 0
  private pitch = 0

  constructor(private readonly camera: PerspectiveCamera) {
    camera.rotation.order = 'YXZ'
    this.applyRotation()
  }

  update(dt: number, input: Pick<Input, 'isDown' | 'takeMouse'>, mouseLook: boolean): void {
    const { dx, dy } = input.takeMouse()
    if (mouseLook) {
      this.yaw -= dx * FLY.lookSensitivity
      this.pitch = MathUtils.clamp(this.pitch - dy * FLY.lookSensitivity, -MAX_PITCH, MAX_PITCH)
      this.applyRotation()
    }

    const axis = (plus: string, minus: string) => (input.isDown(plus) ? 1 : 0) - (input.isDown(minus) ? 1 : 0)
    const forward = axis('KeyW', 'KeyS')
    const right = axis('KeyD', 'KeyA')
    const up = axis('Space', 'KeyC')
    const fast = input.isDown('ShiftLeft') || input.isDown('ShiftRight')
    const step = FLY.speed * (fast ? FLY.fastMultiplier : 1) * dt

    // Forward is (-sin yaw, 0, -cos yaw); right is (cos yaw, 0, -sin yaw).
    const sin = Math.sin(this.yaw)
    const cos = Math.cos(this.yaw)
    const p = this.camera.position
    p.x += (-sin * forward + cos * right) * step
    p.z += (-cos * forward - sin * right) * step
    p.y += up * step
  }

  /** Puts the camera above one corner of the map, looking at its middle. */
  placeOverCorner(mapSize: number): void {
    const p = this.camera.position.set(-0.6 * mapSize, 0.5 * mapSize, 0.6 * mapSize)
    const look = p.clone().negate().normalize()
    this.yaw = Math.atan2(-look.x, -look.z)
    this.pitch = MathUtils.clamp(Math.asin(look.y), -MAX_PITCH, MAX_PITCH)
    this.applyRotation()
  }

  private applyRotation(): void {
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }
}
