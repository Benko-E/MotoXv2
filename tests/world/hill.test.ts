import { describe, expect, it } from 'vitest'
import { makeGround } from '../../src/world/ground'
import { bakeHill, type HillShape, hillBounds, hillHeight, profile } from '../../src/world/hill'

/** Facing north (0°): the run-down side (D) is towards −z, the run-up (A) towards +z. */
const hill: HillShape = {
  x: 0,
  z: 0,
  facing: 0,
  height: 30,
  top: 8,
  runUp: { length: 120, foot: 2.5, shoulder: 1.5 },
  runDown: { length: 50, foot: 2, shoulder: 2.5 },
}

describe('profile', () => {
  it('goes from 0 at the foot to 1 at the top edge', () => {
    expect(profile(0, 2, 2)).toBe(0)
    expect(profile(1, 2, 2)).toBe(1)
  })

  it('is a straight slope when foot and shoulder are 1', () => {
    expect(profile(0.25, 1, 1)).toBeCloseTo(0.25)
  })

  it('a softer foot starts lower, a rounder shoulder ends higher', () => {
    expect(profile(0.2, 4, 1)).toBeLessThan(profile(0.2, 1, 1))
    expect(profile(0.8, 1, 4)).toBeGreaterThan(profile(0.8, 1, 1))
  })
})

describe('hillHeight', () => {
  it('is full height at the pole and across the flat top', () => {
    expect(hillHeight(hill, 0, 0)).toBe(30)
    expect(hillHeight(hill, 7.9, 0)).toBe(30)
  })

  it('reaches the ground exactly at A and D, and stays there beyond', () => {
    expect(hillHeight(hill, 0, 120)).toBe(0) // A, behind
    expect(hillHeight(hill, 0, -50)).toBe(0) // D, ahead
    expect(hillHeight(hill, 0, -60)).toBe(0)
    expect(hillHeight(hill, 300, 300)).toBe(0)
  })

  it('the run-up side is gentler than the run-down side', () => {
    expect(hillHeight(hill, 0, 30)).toBeGreaterThan(hillHeight(hill, 0, -30))
  })

  it('turns with its facing', () => {
    const east = { ...hill, facing: 90 } // D towards +x
    expect(hillHeight(east, 30, 0)).toBeCloseTo(hillHeight(hill, 0, -30))
    expect(hillHeight(east, -30, 0)).toBeCloseTo(hillHeight(hill, 0, 30))
  })

  it('has no seam going round the pole', () => {
    let worst = 0
    let previous = hillHeight(hill, 0, -40)
    for (let deg = 1; deg <= 360; deg++) {
      const a = (deg * Math.PI) / 180
      const h = hillHeight(hill, 40 * Math.sin(a), -40 * Math.cos(a))
      worst = Math.max(worst, Math.abs(h - previous))
      previous = h
    }
    expect(worst).toBeLessThan(0.5) // metres per degree round a 40 m circle
  })
})

describe('bakeHill', () => {
  it('writes the hill into the heightmap inside the area', () => {
    const ground = makeGround(400, 2)
    const area = hillBounds(hill)
    bakeHill(ground, hill, area)
    expect(ground.heightAt(0, 0)).toBeCloseTo(30)
    expect(ground.heightAt(0, 30)).toBeCloseTo(hillHeight(hill, 0, 30))
    expect(ground.heightAt(150, 150)).toBe(0)
  })

  it('a moved hill leaves no trace where it was, when both areas are baked', () => {
    const ground = makeGround(400, 2)
    bakeHill(ground, hill, hillBounds(hill))
    const moved = { ...hill, x: 150 }
    const a = hillBounds(hill)
    const b = hillBounds(moved)
    const both = { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minZ: Math.min(a.minZ, b.minZ), maxZ: Math.max(a.maxZ, b.maxZ) }
    bakeHill(ground, moved, both)
    expect(ground.heightAt(0, 0)).toBe(0)
    expect(ground.heightAt(150, 0)).toBeCloseTo(30)
  })

  it('bounds cover the longest side', () => {
    expect(hillBounds(hill)).toEqual({ minX: -120, maxX: 120, minZ: -120, maxZ: 120 })
  })

  it('bounds cover a flat top wider than both sides', () => {
    const wide = { ...hill, top: 100, runUp: { ...hill.runUp, length: 5 }, runDown: { ...hill.runDown, length: 5 } }
    const b = hillBounds(wide)
    expect(b.maxX - wide.x).toBeGreaterThanOrEqual(100)
    expect(wide.z - b.minZ).toBeGreaterThanOrEqual(100)
  })
})
