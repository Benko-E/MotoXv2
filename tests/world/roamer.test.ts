import { describe, expect, it } from 'vitest'
import { Roamer } from '../../src/world/roamer'

describe('Roamer', () => {
  it('moves at the given speed', () => {
    const r = new Roamer(1)
    const x = r.x
    const z = r.z
    r.update(0.1, 10, 1000)
    expect(Math.hypot(r.x - x, r.z - z)).toBeCloseTo(1, 5)
  })

  it('wanders: its heading changes over time', () => {
    const r = new Roamer(1)
    const start = r.heading
    for (let i = 0; i < 300; i++) r.update(0.05, 8, 1000)
    expect(r.heading).not.toBeCloseTo(start, 2)
  })

  it('stays inside the map for a long ride', () => {
    const r = new Roamer(42)
    for (let i = 0; i < 20000; i++) {
      r.update(0.05, 20, 300)
      expect(Math.abs(r.x)).toBeLessThan(150)
      expect(Math.abs(r.z)).toBeLessThan(150)
    }
  })

  it('comes back inside if the map shrinks under it', () => {
    const r = new Roamer(3)
    r.x = 900
    r.z = -900
    r.update(0.05, 10, 300)
    expect(Math.abs(r.x)).toBeLessThan(150)
    expect(Math.abs(r.z)).toBeLessThan(150)
  })
})
