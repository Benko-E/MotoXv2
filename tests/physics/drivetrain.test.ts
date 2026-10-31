import { describe, expect, it } from 'vitest'
import { DEFAULT_BIKE } from '../../src/physics/bike'
import { Drivetrain } from '../../src/physics/drivetrain'

const p = DEFAULT_BIKE
const DT = 1 / 500
const RPM = 60 / (2 * Math.PI)

/** Rear wheel spin that turns the engine at `rpm` in `gear`. */
function wheelFor(rpm: number, gear: number): number {
  return rpm / RPM / p.gears[gear - 1]
}

/** Runs the drivetrain for `seconds` with the rear wheel held at `wheel`. */
function hold(d: Drivetrain, seconds: number, throttle: number, brake: number, wheel: number) {
  let out = { torque: 0, inertia: 0 }
  for (let t = 0; t < seconds; t += DT) {
    out = d.drive(DT, throttle, brake, wheel, p)
    d.settle(wheel, p)
  }
  return out
}

describe('Drivetrain', () => {
  it('idles at 1500 rpm in 1st at rest, with no drive', () => {
    const d = new Drivetrain()
    const out = hold(d, 1, 0, 0, 0)
    expect(d.gear).toBe(1)
    expect(d.rpm).toBeCloseTo(1500, -1)
    expect(Math.abs(out.torque)).toBeLessThan(1)
  })

  it('wide open from rest: the engine flares up with the clutch slipping and drives the wheel', () => {
    const d = new Drivetrain()
    const out = hold(d, 0.5, 1, 0, 0)
    expect(d.state).toBe('slipping')
    expect(d.rpm).toBeGreaterThan(4000)
    expect(d.rpm).toBeLessThan(9000)
    expect(out.torque).toBeGreaterThan(300)
  })

  it('locks when the wheel catches up, then the engine turns with the wheel', () => {
    const d = new Drivetrain()
    hold(d, 0.5, 0.5, 0, wheelFor(7000, 1))
    expect(d.state).toBe('locked')
    expect(d.rpm).toBeCloseTo(7000, -1)
    const out = hold(d, 0.01, 0.5, 0, wheelFor(7000, 1))
    expect(out.inertia).toBeGreaterThan(1) // the engine's weight is on the wheel
  })

  it('shut throttle when locked brakes the wheel', () => {
    const d = new Drivetrain()
    d.gear = 3
    hold(d, 0.5, 0.5, 0, wheelFor(6000, 3))
    const out = hold(d, 0.02, 0, 0, wheelFor(6000, 3))
    expect(d.state).toBe('locked')
    expect(out.torque).toBeLessThan(0)
  })

  it('shifts up near the limiter wide open, and cuts the drive while shifting', () => {
    const d = new Drivetrain()
    hold(d, 0.5, 1, 0, wheelFor(10000, 1))
    expect(d.gear).toBe(1)
    const out = hold(d, 0.01, 1, 0, wheelFor(10700, 1))
    expect(d.gear).toBe(2)
    expect(d.state).toBe('shifting')
    expect(out.torque).toBe(0)
  })

  it('shifts up earlier at part throttle', () => {
    const d = new Drivetrain()
    hold(d, 0.5, 0.3, 0, wheelFor(8500, 1))
    expect(d.gear).toBe(2)
  })

  it('shifts down under braking', () => {
    const d = new Drivetrain()
    d.gear = 3
    hold(d, 0.05, 0, 1, wheelFor(4000, 3))
    expect(d.gear).toBe(2)
  })

  it('kicks down when the throttle is opened wide at low rpm', () => {
    const d = new Drivetrain()
    d.gear = 3
    hold(d, 0.05, 1, 0, wheelFor(5000, 3))
    expect(d.gear).toBe(2)
  })

  it('waits at least 0.3 s between shifts', () => {
    const d = new Drivetrain()
    d.gear = 5
    hold(d, 0.25, 0, 1, 0)
    expect(d.gear).toBe(4)
    hold(d, 0.1, 0, 1, 0)
    expect(d.gear).toBe(3)
  })

  it('never stalls: the clutch lets go near idle', () => {
    const d = new Drivetrain()
    d.gear = 2
    hold(d, 0.5, 0.3, 0, wheelFor(4000, 2))
    hold(d, 1, 0, 0, wheelFor(800, 2))
    expect(d.rpm).toBeGreaterThanOrEqual(1499)
    expect(d.state).toBe('slipping')
  })

  it('does not shift in the air, with the rear spinning free', () => {
    const d = new Drivetrain()
    for (let t = 0; t < 1; t += DT) {
      d.drive(DT, 1, 0, wheelFor(10900, 1), p, 1, false)
      d.settle(wheelFor(10900, 1), p)
    }
    expect(d.gear).toBe(1)
  })

  it('shifts below a lowered rev limit, and never down into it', () => {
    const low = { ...p, revLimit: 6000 }
    const d = new Drivetrain()
    for (let t = 0; t < 0.2; t += DT) d.drive(DT, 1, 0, 5800 / RPM / low.gears[0], low)
    expect(d.gear).toBe(2)
    const e = new Drivetrain()
    e.gear = 3
    // In 2nd this would be 5900 × 15.2 / 12.6 ≈ 7100 rpm: over the limit.
    for (let t = 0; t < 0.2; t += DT) e.drive(DT, 1, 1, 4900 / RPM / low.gears[2], low)
    expect(e.gear).toBe(3)
  })
})
