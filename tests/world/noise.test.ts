import { describe, expect, it } from 'vitest'
import { makeNoise2D } from '../../src/world/noise'

describe('makeNoise2D', () => {
  const noise = makeNoise2D(1337)

  it('is the same for the same seed and differs for another', () => {
    const again = makeNoise2D(1337)
    const other = makeNoise2D(7)
    let differs = false
    for (let i = 0; i < 50; i++) {
      const x = i * 0.37
      const y = i * 0.71
      expect(noise(x, y)).toBe(again(x, y))
      if (noise(x, y) !== other(x, y)) differs = true
    }
    expect(differs).toBe(true)
  })

  it('stays within -1..1 and actually varies', () => {
    let low = Infinity
    let high = -Infinity
    for (let i = 0; i < 4000; i++) {
      const v = noise((i % 63) * 0.53, Math.floor(i / 63) * 0.47)
      low = Math.min(low, v)
      high = Math.max(high, v)
    }
    expect(low).toBeGreaterThanOrEqual(-1)
    expect(high).toBeLessThanOrEqual(1)
    expect(high - low).toBeGreaterThan(0.8)
  })

  it('is smooth: close points give close values', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.13
      const y = i * 0.29
      expect(Math.abs(noise(x, y) - noise(x + 0.01, y))).toBeLessThan(0.05)
    }
  })

  it('works for negative coordinates', () => {
    expect(Number.isFinite(noise(-12.3, -45.6))).toBe(true)
    expect(Math.abs(noise(-3.2, 1) - noise(-3.21, 1))).toBeLessThan(0.05)
  })
})
