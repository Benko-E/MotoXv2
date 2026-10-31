import { describe, expect, it } from 'vitest'
import { makeGround } from '../../src/world/ground'
import { type HillShape, hillHeight } from '../../src/world/hill'
import { bakeArea, calmBounds, makeNoiseField, type NoiseRules } from '../../src/world/terrain'

const hill: HillShape = {
  x: 0,
  z: 0,
  facing: 0,
  height: 30,
  top: 8,
  runUp: { length: 80, foot: 2.5, shoulder: 1.5 },
  runDown: { length: 50, foot: 2, shoulder: 2.5 },
}
const rules: NoiseRules = { height: 4, width: 60, detail: 50, calm: 40 }
const whole = (size: number) => ({ minX: -size / 2, maxX: size / 2, minZ: -size / 2, maxZ: size / 2 })

describe('makeNoiseField', () => {
  it('stays within about the bump height', () => {
    const field = makeNoiseField(rules, 1337)
    for (let i = 0; i < 500; i++) {
      const v = field.big(i * 3.1, i * 1.7) + field.small(i * 3.1, i * 1.7)
      expect(Math.abs(v)).toBeLessThanOrEqual(4 + 1e-9)
    }
  })

  it('has no small bumps at 0 % detail', () => {
    const field = makeNoiseField({ ...rules, detail: 0 }, 1337)
    expect(field.small(12, 34)).toBe(0)
  })
})

describe('bakeArea', () => {
  const field = makeNoiseField(rules, 1337)

  it('with no bump height, the ground is just the hills', () => {
    const ground = makeGround(400, 2)
    const flat = { ...rules, height: 0 }
    bakeArea(ground, [hill], makeNoiseField(flat, 1337), flat, whole(400))
    expect(ground.heightAt(0, 30)).toBeCloseTo(hillHeight(hill, 0, 30))
    expect(ground.heightAt(150, 150)).toBe(0)
  })

  it('far from hills the full noise shows', () => {
    const ground = makeGround(400, 2)
    bakeArea(ground, [hill], field, rules, whole(400))
    expect(ground.heightAt(180, 180)).toBeCloseTo(field.big(180, 180) + field.small(180, 180), 4)
  })

  it('on a hill the small bumps are gone but the big swell stays', () => {
    const ground = makeGround(400, 2)
    bakeArea(ground, [hill], field, rules, whole(400))
    expect(ground.heightAt(0, 0)).toBeCloseTo(field.big(0, 0) + 30, 4)
  })

  it('calm bounds reach past the footprint by the calm distance', () => {
    expect(calmBounds(hill, 40)).toEqual({ minX: -120, maxX: 120, minZ: -120, maxZ: 120 })
  })

  it('redoing only the old and new calm areas matches a full bake', () => {
    const moved = { ...hill, x: 90, z: -40 }
    const partial = makeGround(400, 2)
    bakeArea(partial, [hill], field, rules, whole(400))
    bakeArea(partial, [moved], field, rules, calmBounds(hill, rules.calm))
    bakeArea(partial, [moved], field, rules, calmBounds(moved, rules.calm))
    const full = makeGround(400, 2)
    bakeArea(full, [moved], field, rules, whole(400))
    expect(partial.heights).toEqual(full.heights)
  })
})
