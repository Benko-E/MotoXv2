import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { FollowCamera } from '../../src/camera/followCamera'

describe('FollowCamera', () => {
  it('settles behind and above the bike, looking at it', () => {
    const camera = new PerspectiveCamera()
    const follow = new FollowCamera(camera)
    const bike = new Vector3(10, 2, 20)
    const nose = new Vector3(0, 0, -1) // facing north
    for (let i = 0; i < 300; i++) follow.update(1 / 60, bike, nose)
    expect(camera.position.z).toBeGreaterThan(bike.z + 4) // behind = south
    expect(camera.position.y).toBeGreaterThan(bike.y + 1)
    expect(Math.abs(camera.position.x - bike.x)).toBeLessThan(0.1)
    const look = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    expect(look.z).toBeLessThan(-0.8)
  })

  it('swings round smoothly, not in one jump, when the bike turns', () => {
    const camera = new PerspectiveCamera()
    const follow = new FollowCamera(camera)
    const bike = new Vector3()
    for (let i = 0; i < 300; i++) follow.update(1 / 60, bike, new Vector3(0, 0, -1))
    follow.update(1 / 60, bike, new Vector3(1, 0, 0)) // now facing east
    expect(camera.position.x).toBeGreaterThan(-1) // hasn't jumped to the west side yet
    for (let i = 0; i < 300; i++) follow.update(1 / 60, bike, new Vector3(1, 0, 0))
    expect(camera.position.x).toBeLessThan(-4)
  })

  it('snap() jumps straight behind', () => {
    const camera = new PerspectiveCamera()
    const follow = new FollowCamera(camera)
    follow.snap(new Vector3(), new Vector3(1, 0, 0))
    expect(camera.position.x).toBeLessThan(-4)
  })
})
