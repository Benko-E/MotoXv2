import { describe, expect, it } from 'vitest'
import { makeGround } from '../../src/world/ground'

describe('makeGround', () => {
  it('fits whole cells exactly when they divide evenly', () => {
    const g = makeGround(1000, 1)
    expect(g.cells).toBe(1000)
    expect(g.size).toBe(1000)
  })

  it('rounds the cell count up when they do not', () => {
    const g = makeGround(1000, 3)
    expect(g.cells).toBe(334)
    expect(g.size).toBe(1002)
  })

  it('does not add a cell for floating-point noise', () => {
    expect(makeGround(1000, 0.7).cells).toBe(1429)
    expect(makeGround(115, 2.3).cells).toBe(50) // 115 / 2.3 = 50.00000000000001
    expect(makeGround(4000, 0.25).cells).toBe(16000)
  })

  it('reports the real size for uneven cells', () => {
    expect(makeGround(1000, 0.3).size).toBeCloseTo(1000.2)
  })

  it('is flat for now', () => {
    expect(makeGround(1000, 1).heightAt(123, -45)).toBe(0)
  })
})
