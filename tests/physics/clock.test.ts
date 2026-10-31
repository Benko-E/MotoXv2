import { describe, expect, it } from 'vitest'
import { FixedClock } from '../../src/physics/clock'

describe('FixedClock', () => {
  it('runs one fixed step per step-length of frame time', () => {
    const clock = new FixedClock(1 / 500)
    let steps = 0
    clock.advance(0.01, () => steps++)
    expect(steps).toBe(5)
  })

  it('carries leftover time to the next frame', () => {
    const clock = new FixedClock(1 / 500)
    let steps = 0
    clock.advance(0.003, () => steps++) // 1.5 steps
    clock.advance(0.003, () => steps++) // 1.5 more
    expect(steps).toBe(3)
  })

  it('gives the same number of steps however frames are split', () => {
    const a = new FixedClock(1 / 500)
    const b = new FixedClock(1 / 500)
    let sa = 0
    let sb = 0
    for (let i = 0; i < 60; i++) a.advance(1 / 60, () => sa++)
    for (let i = 0; i < 144; i++) b.advance(1 / 144, () => sb++)
    expect(Math.abs(sa - sb)).toBeLessThanOrEqual(1)
    expect(sa).toBeGreaterThanOrEqual(499)
  })

  it('catches up at most 0.1 s per frame after a stall', () => {
    const clock = new FixedClock(1 / 500)
    let steps = 0
    clock.advance(2, () => steps++)
    expect(steps).toBe(50)
    steps = 0
    clock.advance(0.002, () => steps++)
    expect(steps).toBe(1) // the stall is dropped, not owed
  })
})
