import { describe, expect, it } from 'vitest'
import { type HillRules, hillRadius, placeHills, randomStream, rollValue } from '../../src/world/hills'

const v = (value: number, variation: number, min: number) => ({ value, variation, min })
const rules: HillRules = {
  count: 12,
  spacing: 40,
  height: v(30, 40, 1),
  top: v(8, 100, 0),
  runUp: { length: v(120, 30, 5), foot: v(2.5, 20, 1), shoulder: v(1.5, 20, 1) },
  runDown: { length: v(50, 30, 5), foot: v(2, 20, 1), shoulder: v(2.5, 20, 1) },
}

describe('randomStream', () => {
  it('gives the same numbers for the same seed, in 0..1', () => {
    const a = randomStream(1337)
    const b = randomStream(1337)
    for (let i = 0; i < 100; i++) {
      const n = a()
      expect(n).toBe(b())
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })

  it('gives different numbers for a different seed', () => {
    expect(randomStream(1)()).not.toBe(randomStream(2)())
  })
})

describe('rollValue', () => {
  it('spreads 40 at 50 % between 20 and 60', () => {
    expect(rollValue(v(40, 50, 1), 0)).toBeCloseTo(20)
    expect(rollValue(v(40, 50, 1), 0.5)).toBeCloseTo(40)
    expect(rollValue(v(40, 50, 1), 0.999999)).toBeCloseTo(60, 3)
  })

  it('gives exactly the value at 0 %', () => {
    expect(rollValue(v(40, 0, 1), 0.9)).toBe(40)
  })

  it('never goes below the minimum', () => {
    expect(rollValue(v(2, 100, 1), 0)).toBe(1)
  })
})

describe('placeHills', () => {
  const hills = placeHills(rules, 1000, 1337)

  it('is the same map for the same seed', () => {
    expect(placeHills(rules, 1000, 1337)).toEqual(hills)
    expect(placeHills(rules, 1000, 7)).not.toEqual(hills)
  })

  it('places some hills, at most Count', () => {
    expect(hills.length).toBeGreaterThan(0)
    expect(hills.length).toBeLessThanOrEqual(12)
  })

  it('keeps every footprint inside the map', () => {
    for (const h of hills) {
      const r = hillRadius(h)
      expect(Math.abs(h.x) + r).toBeLessThanOrEqual(500)
      expect(Math.abs(h.z) + r).toBeLessThanOrEqual(500)
    }
  })

  it('keeps feet at least Spacing apart', () => {
    for (let i = 0; i < hills.length; i++) {
      for (let j = i + 1; j < hills.length; j++) {
        const d = Math.hypot(hills[i].x - hills[j].x, hills[i].z - hills[j].z)
        expect(d).toBeGreaterThanOrEqual(hillRadius(hills[i]) + hillRadius(hills[j]) + 40 - 1e-9)
      }
    }
  })

  it('rolls values within the variation', () => {
    for (const h of hills) {
      expect(h.height).toBeGreaterThanOrEqual(18)
      expect(h.height).toBeLessThanOrEqual(42)
      expect(h.facing).toBeGreaterThanOrEqual(0)
      expect(h.facing).toBeLessThan(360)
    }
    expect(new Set(hills.map((h) => h.height)).size).toBeGreaterThan(1)
  })

  it('at 0 % variation every hill is the same height', () => {
    const flat = placeHills({ ...rules, height: v(30, 0, 1) }, 1000, 1337)
    for (const h of flat) expect(h.height).toBe(30)
  })

  it('changing a shape slider keeps each hill its own roll (they grow in place)', () => {
    const taller = placeHills({ ...rules, height: v(60, 40, 1) }, 1000, 1337)
    expect(taller[0].height).toBeCloseTo(hills[0].height * 2)
    expect(taller[0].facing).toBe(hills[0].facing)
  })

  it('changing a length keeps the hill on the same spot', () => {
    const longer = placeHills({ ...rules, runUp: { ...rules.runUp, length: v(130, 30, 5) } }, 1000, 1337)
    expect(longer[0].x).toBe(hills[0].x)
    expect(longer[0].z).toBe(hills[0].z)
  })

  it('places none when Count is 0 or no hill fits', () => {
    expect(placeHills({ ...rules, count: 0 }, 1000, 1337)).toEqual([])
    expect(placeHills(rules, 100, 1337)).toEqual([])
  })

  it('reports fewer when the map is full', () => {
    expect(placeHills({ ...rules, count: 100 }, 1000, 1337).length).toBeLessThan(100)
  })
})
