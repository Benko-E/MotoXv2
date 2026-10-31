import { describe, expect, it } from 'vitest'
import { cellSizeUsed, makeGround, MAX_CELLS } from '../../src/world/ground'

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
  })

  it('reports the real size for uneven cells', () => {
    expect(makeGround(1000, 0.3).size).toBeCloseTo(1000.2)
  })

  it('is flat for now', () => {
    expect(makeGround(1000, 1).heightAt(123, -45)).toBe(0)
  })
})

describe('cell budget', () => {
  it('limits a big map with tiny cells to MAX_CELLS per side', () => {
    const g = makeGround(4000, 0.25)
    expect(MAX_CELLS).toBe(4096)
    expect(g.cells).toBe(4096)
    expect(g.cellSize).toBe(0.9765625)
    expect(g.size).toBe(4000)
    expect(g.limited).toBe(true)
  })

  it('cellSizeUsed gives the same size for every too-small cell on a big map', () => {
    expect(cellSizeUsed(4000, 0.25)).toBe(0.9765625)
    expect(cellSizeUsed(4000, 0.5)).toBe(0.9765625)
    expect(cellSizeUsed(4000, 2)).toBe(2)
    expect(cellSizeUsed(1000, 0.25)).toBe(0.25)
  })

  it('leaves maps within the budget alone', () => {
    const g = makeGround(1000, 0.25)
    expect(g.cells).toBe(4000)
    expect(g.cellSize).toBe(0.25)
    expect(g.limited).toBe(false)
  })
})

describe('heightmap', () => {
  it('stores one height per grid point', () => {
    const g = makeGround(1000, 3)
    expect(g.samples).toBe(335)
    expect(g.heights.length).toBe(335 * 335)
  })

  it('blends smoothly between grid points', () => {
    const g = makeGround(10, 1) // points at -5, -4, ... 5
    const at = (ix: number, iz: number) => iz * g.samples + ix
    g.heights[at(5, 5)] = 0 // (0, 0)
    g.heights[at(6, 5)] = 2 // (1, 0)
    g.heights[at(5, 6)] = 4 // (0, 1)
    g.heights[at(6, 6)] = 6 // (1, 1)
    expect(g.heightAt(0, 0)).toBe(0)
    expect(g.heightAt(1, 1)).toBe(6)
    expect(g.heightAt(0.5, 0.5)).toBe(3)
    expect(g.heightAt(0.5, 0)).toBe(1)
  })

  it('outside the map reads the nearest edge', () => {
    const g = makeGround(10, 1)
    g.heights[g.samples * g.samples - 1] = 7 // corner (5, 5)
    expect(g.heightAt(50, 50)).toBe(7)
  })
})
