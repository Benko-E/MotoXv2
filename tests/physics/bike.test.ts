import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Bike, DEFAULT_BIKE, type Terrain } from '../../src/physics/bike'

const STEP = 1 / 500
const flat: Terrain = { heightAt: () => 0 }
/** Rises towards the north (−z): 20 cm per metre. */
const slope: Terrain = { heightAt: (_x, z) => -0.2 * z }
const idle = { push: false, brake: false }

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
    run(bike, 5, slope, { push: false, brake: true })
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

  it('pushing on flat ground accelerates at about push ÷ mass', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.1, flat)
    run(bike, 4, flat)
    run(bike, 1, flat, { push: true, brake: false })
    const mass = DEFAULT_BIKE.bikeMass + DEFAULT_BIKE.riderMass
    const expected = DEFAULT_BIKE.push / mass - 0.02 * 9.81
    expect(bike.speed).toBeGreaterThan(expected * 0.85)
    expect(bike.speed).toBeLessThan(expected * 1.1)
    expect(bike.position.z).toBeLessThan(-0.5) // nose is −z
  })

  it('faces its heading when dropped', () => {
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, Math.PI / 2, 1, flat) // east
    const nose = new Vector3(0, 0, -1).applyQuaternion(bike.orientation)
    expect(nose.x).toBeCloseTo(1, 5)
  })
})
