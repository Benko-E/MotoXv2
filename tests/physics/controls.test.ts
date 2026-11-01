import { describe, expect, it } from 'vitest'
import { ramp, rampTo } from '../../src/physics/controls'

describe('ramp', () => {
  it('opens over the open time', () => {
    expect(ramp(0, true, 0.125, 0.25, 0.15)).toBeCloseTo(0.5)
    expect(ramp(0.9, true, 0.1, 0.25, 0.15)).toBe(1)
  })

  it('closes over the close time', () => {
    expect(ramp(1, false, 0.075, 0.25, 0.15)).toBeCloseTo(0.5)
    expect(ramp(0.1, false, 0.1, 0.25, 0.15)).toBe(0)
  })
})

describe('rampTo', () => {
  it('moves toward the target over the given time, either way, and stops there', () => {
    expect(rampTo(0, 1, 0.06, 0.12)).toBeCloseTo(0.5)
    expect(rampTo(0, -1, 0.06, 0.12)).toBeCloseTo(-0.5)
    expect(rampTo(-0.5, 0, 0.12, 0.12)).toBe(0)
    expect(rampTo(0.9, 1, 0.12, 0.12)).toBe(1)
  })
})
