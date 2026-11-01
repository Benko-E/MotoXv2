import { Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { Bike, DEFAULT_BIKE, type BikeInput, type BikeParams, type Terrain } from '../../src/physics/bike'

const STEP = 1 / 500
const flat: Terrain = { heightAt: () => 0 }
const DEG = 180 / Math.PI

function input(over: Partial<BikeInput> = {}): BikeInput {
  return { throttle: 0, brake: 0, rearBrake: 0, steer: 0, riderShift: 0, ...over }
}

function run(bike: Bike, seconds: number, i: BikeInput, each?: () => void): void {
  for (let n = 0; n < Math.round(seconds / STEP); n++) {
    bike.step(STEP, i, flat)
    each?.()
  }
}

/** Settled at rest on flat ground, facing north (−z). */
function settled(params: BikeParams = DEFAULT_BIKE): Bike {
  const bike = new Bike(params)
  bike.drop(0, 0, 0, 0.05, flat)
  run(bike, 2, input({ brake: 1 }))
  return bike
}

/** Rolling north at `speed` m/s, wheels turning to match. */
function rolling(speed: number, params: BikeParams = DEFAULT_BIKE): Bike {
  const bike = settled(params)
  bike.velocity.set(0, 0, -speed)
  bike.front.spin = speed / 0.36
  bike.rear.spin = speed / 0.34
  run(bike, 0.5, input({ throttle: 0.25 }))
  return bike
}

/** Heading in degrees, clockwise from north. */
function heading(bike: Bike): number {
  const nose = new Vector3(0, 0, -1).applyQuaternion(bike.orientation)
  return Math.atan2(nose.x, -nose.z) * DEG
}

describe('Bike (step D: steering)', () => {
  it('rides straight with no input: stays up and on course', () => {
    const bike = rolling(10)
    let most = 0
    run(bike, 5, input({ throttle: 0.25 }), () => (most = Math.max(most, Math.abs(bike.lean))))
    expect(most * DEG).toBeLessThan(3)
    expect(Math.abs(heading(bike))).toBeLessThan(5)
    expect(bike.speed).toBeGreaterThan(6)
  })

  it('holding D at speed leans right and turns right, near the target lean', () => {
    const bike = rolling(12)
    run(bike, 3, input({ throttle: 0.2, steer: 1 }))
    expect(bike.lean * DEG).toBeGreaterThan(20)
    expect(Math.abs(bike.lean - bike.targetLean) * DEG).toBeLessThan(8)
    expect(heading(bike)).toBeGreaterThan(30) // clockwise = right
    expect(bike.crashed).toBe(false)
  })

  it('A turns left the same way', () => {
    const bike = rolling(12)
    run(bike, 3, input({ throttle: 0.2, steer: -1 }))
    expect(bike.lean * DEG).toBeLessThan(-20)
    expect(heading(bike)).toBeLessThan(-30)
  })

  it('letting go stands it back up', () => {
    const bike = rolling(12)
    run(bike, 2, input({ throttle: 0.2, steer: 1 }))
    run(bike, 3, input({ throttle: 0.3 }))
    expect(Math.abs(bike.lean) * DEG).toBeLessThan(4)
    expect(bike.crashed).toBe(false)
  })

  it('starting a right turn steers the bars left first (countersteer)', () => {
    const bike = rolling(12)
    let leftmost = 0
    run(bike, 0.3, input({ throttle: 0.3, steer: 1 }), () => (leftmost = Math.min(leftmost, bike.steer)))
    expect(leftmost).toBeLessThan(-0.005)
  })

  it('at walking pace the bars follow A directly and it stays up', () => {
    const bike = rolling(1.5)
    let leftmost = 0
    run(bike, 2, input({ throttle: 0.15, steer: -1 }), () => (leftmost = Math.min(leftmost, bike.steer)))
    expect(leftmost * DEG).toBeLessThan(-20)
    expect(Math.abs(bike.lean) * DEG).toBeLessThan(15)
    expect(heading(bike)).toBeLessThan(-10)
  })

  it('holding W and D together at speed stays up (he keeps the rear from spinning loose)', () => {
    for (const speed of [12, 20, 30]) {
      const bike = rolling(speed)
      run(bike, 4, input({ throttle: 1, steer: 1 }))
      expect(bike.crashed).toBe(false)
      expect(heading(bike)).toBeGreaterThan(10) // turning right, wider the faster
    }
  })

  it('from a standstill, W then D: stays up', () => {
    const bike = settled()
    run(bike, 2.5, input({ throttle: 1 }))
    run(bike, 8, input({ throttle: 1, steer: 1 }))
    expect(bike.crashed).toBe(false)
  })

  it('grabbing both brakes mid-turn at 58 km/h and letting go of D: he eases the brakes, stays up and stops', () => {
    const bike = rolling(16)
    run(bike, 2.5, input({ throttle: 0.2, steer: 1 }))
    run(bike, 4, input({ brake: 1 }))
    expect(bike.crashed).toBe(false)
    expect(bike.speed).toBeLessThan(3)
  })

  it('with the front wheel in the air the bars go straight', () => {
    const bike = settled()
    bike.position.y += 1.5
    bike.velocity.set(0, 0, -12)
    bike.steer = 0.4 // turned when it took off
    run(bike, 0.3, input({ steer: 1 }))
    expect(bike.front.contact).toBe(false)
    expect(Math.abs(bike.steer) * DEG).toBeLessThan(1)
  })

  it('with Can crash off, hard turns never lean past the most-lean setting', () => {
    const params = { ...DEFAULT_BIKE, canCrash: false, grip: 0.6 }
    const bike = rolling(20, params)
    let most = 0
    run(bike, 4, input({ throttle: 1, steer: 1 }), () => (most = Math.max(most, Math.abs(bike.lean))))
    expect(most).toBeLessThan(params.maxLean + (5 / DEG))
    expect(bike.crashed).toBe(false)
  })
})

describe('Bike (step D: rider weight, rear brake, body)', () => {
  it('rider back takes load off the front, forward puts it on', () => {
    const neutral = settled().front.force
    const back = settled()
    run(back, 1.5, input({ brake: 1, riderShift: -1 }))
    const forward = settled()
    run(forward, 1.5, input({ brake: 1, riderShift: 1 }))
    expect(back.front.force).toBeLessThan(neutral * 0.9)
    expect(forward.front.force).toBeGreaterThan(neutral * 1.08)
  })

  it('Space locks the rear only', () => {
    const bike = rolling(10)
    run(bike, 0.5, input({ rearBrake: 1 }))
    expect(bike.rear.spin).toBe(0)
    expect(bike.front.spin).toBeGreaterThan(10)
  })

  it('crashing on bumpy hills: when it rolls back onto its wheels it is not flung about', () => {
    // A fallen bike's wheels are ignored past 60° of lean; rolling back, they
    // can land deep in the ground, which must not kick it (this once ran to NaN).
    const bumpy: Terrain = { heightAt: (x, z) => 3 * Math.sin(x / 15) * Math.cos(z / 20) + 0.3 * Math.sin(x * 0.7 + z * 0.9) }
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.05, bumpy)
    let fastestSpin = 0
    for (let n = 0; n < 500 * 15; n++) {
      const t = n * STEP
      bike.step(STEP, input({ throttle: Math.min(1, t / 0.25), steer: t > 0.5 ? 1 : 0 }), bumpy)
      fastestSpin = Math.max(fastestSpin, bike.angularVelocity.length())
    }
    expect(bike.crashed).toBe(true)
    expect(fastestSpin).toBeLessThan(20)
    expect(Number.isFinite(bike.position.y)).toBe(true)
  })

  it('stopped facing up a steep hill with no keys, he holds the brakes instead of rolling back', () => {
    const hill: Terrain = { heightAt: (_x, z) => -0.35 * z } // rises 19° to the north
    const bike = new Bike(DEFAULT_BIKE)
    bike.drop(0, 0, 0, 0.05, hill)
    for (let n = 0; n < 500; n++) bike.step(STEP, input(), hill) // lands
    const landed = bike.position.clone()
    for (let n = 0; n < 500 * 5; n++) bike.step(STEP, input(), hill)
    expect(bike.position.distanceTo(landed)).toBeLessThan(0.5)
    expect(bike.speed).toBeLessThan(0.2)
    expect(bike.crashed).toBe(false)
  })

  it('with rider control off he lets it roll back (that hold is an assist)', () => {
    const hill: Terrain = { heightAt: (_x, z) => -0.35 * z }
    const bike = new Bike({ ...DEFAULT_BIKE, riderControl: false })
    bike.drop(0, 0, 0, 0.05, hill)
    for (let n = 0; n < 500 * 3; n++) bike.step(STEP, input(), hill)
    expect(bike.speed).toBeGreaterThan(1)
  })

  it('the head and shoulders move with the rider when he shifts back', () => {
    const bike = settled()
    const local = (i: number) => bike.body[i].at.clone().sub(bike.position).applyQuaternion(bike.orientation.clone().invert())
    const HEAD = 9
    const PEG = 0
    run(bike, 0.1, input({ brake: 1 }))
    const neutral = local(HEAD).sub(local(PEG))
    run(bike, 1.5, input({ brake: 1, riderShift: -1 }))
    const back = local(HEAD).sub(local(PEG))
    // The rider moves 0.3 m back (and 9 cm down) relative to the bike.
    expect(back.z - neutral.z).toBeCloseTo(0.3, 2)
    expect(back.y - neutral.y).toBeCloseTo(-0.09, 2)
  })

  it('with Can crash off, upside down still counts as down and it lies still', () => {
    const bike = settled({ ...DEFAULT_BIKE, canCrash: false })
    bike.orientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI))
    bike.position.y = 1.3
    run(bike, 3, input())
    expect(bike.crashed).toBe(true)
    expect(bike.angularVelocity.length()).toBeLessThan(0.5)
  })

  it('laid on its side it rests on its body, crashed; pickUp stands it up', () => {
    const bike = settled()
    bike.orientation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, -1), Math.PI / 2))
    bike.position.y = 0.6
    run(bike, 2, input())
    expect(bike.crashed).toBe(true)
    expect(bike.position.y).toBeGreaterThan(0.1)
    expect(bike.speed).toBeLessThan(0.2)
    bike.pickUp(flat)
    run(bike, 2, input({ brake: 1 }))
    expect(bike.crashed).toBe(false)
    expect(Math.abs(bike.lean) * DEG).toBeLessThan(3)
  })
})
