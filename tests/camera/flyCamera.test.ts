import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { FLY, FlyCamera } from '../../src/camera/flyCamera'

/** Pretends the given keys are held and the mouse moved by (dx, dy). */
function holding(codes: string[], dx = 0, dy = 0) {
  return { isDown: (c: string) => codes.includes(c), takeMouse: () => ({ dx, dy }) }
}

function setup() {
  const camera = new PerspectiveCamera()
  const fly = new FlyCamera(camera)
  return { camera, fly }
}

describe('FlyCamera', () => {
  it('W flies forward along the ground at the base speed', () => {
    const { camera, fly } = setup()
    fly.update(1, holding(['KeyW']), false)
    expect(camera.position.distanceTo(new Vector3(0, 0, -FLY.speed))).toBeLessThan(1e-6)
  })

  it('Shift goes faster', () => {
    const { camera, fly } = setup()
    fly.update(1, holding(['KeyW', 'ShiftLeft']), false)
    expect(camera.position.length()).toBeCloseTo(FLY.speed * FLY.fastMultiplier)
  })

  it('Space goes up and C goes down', () => {
    const { camera, fly } = setup()
    fly.update(1, holding(['Space']), false)
    expect(camera.position.y).toBeCloseTo(FLY.speed)
    fly.update(2, holding(['KeyC']), false)
    expect(camera.position.y).toBeCloseTo(-FLY.speed)
  })

  it('looking down does not make W dive', () => {
    const { camera, fly } = setup()
    fly.update(0, holding([], 0, 400), true) // mouse pulled back: look down
    fly.update(1, holding(['KeyW']), false)
    expect(camera.position.y).toBeCloseTo(0)
    expect(Math.hypot(camera.position.x, camera.position.z)).toBeCloseTo(FLY.speed)
  })

  it('ignores the mouse unless mouse look is on', () => {
    const { camera, fly } = setup()
    const before = camera.quaternion.clone()
    fly.update(0, holding([], 300, 0), false)
    expect(camera.quaternion.equals(before)).toBe(true)
  })

  it('placeOverCorner looks at the middle of the map from above a corner', () => {
    const { camera, fly } = setup()
    fly.placeOverCorner(1000)
    expect(camera.position.toArray()).toEqual([-600, 500, 600])
    const look = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const toMiddle = camera.position.clone().negate().normalize()
    expect(look.dot(toMiddle)).toBeGreaterThan(0.999)
  })
})
