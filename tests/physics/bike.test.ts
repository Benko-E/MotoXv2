import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Bike, DEFAULT_BIKE, type Terrain } from '../../src/physics/bike'

const STEP = 1 / 500
const flat: Terrain = { heightAt: () => 0 }
/** Rises towards the north (−z): 20 cm per metre. */
const slope: Terrain = { heightAt: (_x, z) => -0.2 * z }
const idle = { throttle: 0, brake: 0 }
const braking = { throttle: 0, brake: 1 }
const full = { throttle: 1, brake: 0 }

function run(bike: Bike, seconds: number, terrain: Terrain, input = idle): void {
  for (let i = 0; i < Math.round(seconds / STEP); i++) bike.step(STEP, input, terrain)
}

const weight = (DEFAULT_BIKE.bikeMass + DEFAULT_BIKE.riderMass) * 9.81

describe('Bike (step A)', () => {
  it('dropped on flat ground it settles upright on its sag', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 3, flat)
    run(bike, 6, flat)
    expect(bike.velocity.length()).toBeLessThan(0.01)
    expect(bike.angularVelocity.length()).toBeLessThan(0.01)
    const up = new Vector3(0, 1, 0).applyQuaternion(bike.orientation)
    expect(up.y).toBeGreaterThan(0.999)
    expect(bike.front.compression).toBeCloseTo(weight / 2 / DEFAULT_BIKE.frontSpring, 2)
    expect(bike.rear.compression).toBeCloseTo(weight / 2 / DEFAULT_BIKE.rearSpring, 2)
    expect(bike.front.contact && bike.rear.contact).toBe(true)
  })

  it('falls freely while in the air', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 3, flat)
    const y = bike.position.y
    run(bike, 0.5, flat)
    expect(bike.position.y).toBeCloseTo(y - 0.5 * 9.81 * 0.25, 1)
  })

  it('survives a 10 m drop and settles', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 10, flat)
    run(bike, 8, flat)
    expect(Number.isFinite(bike.position.y)).toBe(true)
    expect(bike.velocity.length()).toBeLessThan(0.02)
    expect(bike.position.y).toBeGreaterThan(0.4)
  })

  it('on a slope it stays put with the brake held', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.2, slope)
    run(bike, 5, slope, braking)
    expect(bike.velocity.length()).toBeLessThan(0.05)
  })

  it('on a slope it rolls downhill and speeds up without the brake', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.2, slope)
    run(bike, 2, slope)
    const z = bike.position.z
    const speed = bike.velocity.length()
    run(bike, 2, slope)
    expect(bike.position.z).toBeGreaterThan(z) // downhill is +z
    expect(bike.velocity.length()).toBeGreaterThan(speed)
  })

  it('faces its heading when dropped', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, Math.PI / 2, 1, flat) // east
    const nose = new Vector3(0, 0, -1).applyQuaternion(bike.orientation)
    expect(nose.x).toBeCloseTo(1, 5)
  })

  it('the brake holds on a steep 30° slope (tyres stick until they break loose)', () => {
    const steep: Terrain = { heightAt: (_x, z) => -Math.tan(Math.PI / 6) * z }
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.3, steep)
    run(bike, 3, steep, braking)
    const at = bike.position.clone()
    run(bike, 10, steep, braking)
    expect(bike.position.distanceTo(at)).toBeLessThan(0.02)
  })

  it('parked across a slope it does not slide sideways', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, Math.PI / 2, 0.2, slope) // facing east, slope falls to the side
    run(bike, 3, slope)
    const z = bike.position.z
    run(bike, 10, slope)
    expect(Math.abs(bike.position.z - z)).toBeLessThan(0.02)
  })

  it('in the air nothing turns it upright (that is the rider’s job later)', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 20, flat)
    bike.orientation.setFromAxisAngle(new Vector3(0, 0, 1), 1.2) // leaning 70° in the air
    run(bike, 0.5, flat)
    expect(bike.angularVelocity.length()).toBeLessThan(1e-6)
  })

  it('a wheel leaning more than 60° from the ground ignores it', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0, flat)
    bike.orientation.setFromAxisAngle(new Vector3(0, 0, 1), 1.3) // 75° over
    bike.position.y = 0.3
    bike.step(STEP, idle, flat)
    expect(bike.front.contact).toBe(false)
    expect(bike.rear.contact).toBe(false)
  })
})

/** A settled bike on `terrain` (on its wheels, at rest), facing north. */
function settled(terrain: Terrain, params = DEFAULT_BIKE): Bike {
  const bike = new Bike(params)
  bike.drop(0, 0, 0, 0.05, terrain)
  run(bike, 2, terrain, braking)
  return bike
}

describe('Bike (step B: wheels and engine)', () => {
  it('a rolling bike spins its wheels up to match the ground', () => {
    const bike = settled(flat)
    bike.velocity.set(0, 0, -10) // 10 m/s north, wheels still
    // The rear also spins the engine through the gearing, so it takes longer.
    run(bike, 1.5, flat)
    expect(bike.front.spin * 0.36).toBeCloseTo(bike.speed, 0)
    expect(bike.rear.spin * 0.34).toBeCloseTo(bike.speed, 0)
    expect(bike.speed).toBeGreaterThan(7)
  })

  it('full throttle from a standstill speeds it up with little rear slip', () => {
    const bike = settled(flat)
    run(bike, 3, flat, full)
    expect(bike.speed).toBeGreaterThan(10)
    expect(bike.speed).toBeLessThan(30)
    expect(Math.abs(bike.rear.slip)).toBeLessThan(0.15)
    expect(bike.position.z).toBeLessThan(-5) // nose is −z
  })

  it('at low grip the rear wheel spins much faster than the ground goes by', () => {
    const slippery = { ...DEFAULT_BIKE, grip: 0.25 }
    const bike = settled(flat, slippery)
    run(bike, 1, flat, full)
    expect(bike.rear.spin * 0.34).toBeGreaterThan(bike.speed * 1.3 + 1)
  })

  it('full throttle uphill is slower than on the flat, downhill faster', () => {
    const up: Terrain = { heightAt: (_x, z) => -0.15 * z } // rises northwards
    const down: Terrain = { heightAt: (_x, z) => 0.15 * z }
    const results = [flat, up, down].map((t) => {
      const bike = settled(t)
      run(bike, 3, t, full)
      return bike.speed
    })
    expect(results[1]).toBeLessThan(results[0] * 0.9)
    expect(results[2]).toBeGreaterThan(results[0] * 1.05)
  })

  it('off the throttle the engine slows it faster than rolling alone', () => {
    const coast = (params: typeof DEFAULT_BIKE) => {
      const bike = settled(flat, params)
      run(bike, 4, flat, full)
      const before = bike.speed
      run(bike, 2, flat, idle)
      return before - bike.speed
    }
    expect(coast(DEFAULT_BIKE)).toBeGreaterThan(coast({ ...DEFAULT_BIKE, engineBraking: 0 }) * 1.3)
  })

  it('the rev limiter caps top speed', () => {
    const bike = settled(flat)
    run(bike, 25, flat, full)
    const limit = ((DEFAULT_BIKE.revLimit / DEFAULT_BIKE.gearRatio) * 2 * Math.PI) / 60 * 0.34
    expect(bike.speed).toBeLessThan(limit * 1.03)
    expect(bike.speed).toBeGreaterThan(limit * 0.8)
    expect(bike.rpm).toBeLessThanOrEqual(DEFAULT_BIKE.revLimit * 1.03)
  })

  it('full brakes bring it to a stop', () => {
    const bike = settled(flat)
    run(bike, 3, flat, full)
    run(bike, 4, flat, braking)
    expect(bike.speed).toBeLessThan(0.05)
    expect(bike.front.spin).toBe(0)
  })
})
