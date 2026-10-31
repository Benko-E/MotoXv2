import { describe, expect, it } from 'vitest'
import { chunkRanges, lodLevel, MAX_LEVEL, sampleIndices } from '../../src/render/lod'

describe('lodLevel', () => {
  it('is full detail closer than the detail distance', () => {
    expect(lodLevel(100, 150)).toBe(0)
  })

  it('drops one level each time the distance doubles', () => {
    expect(lodLevel(150, 150)).toBe(1)
    expect(lodLevel(299, 150)).toBe(1)
    expect(lodLevel(300, 150)).toBe(2)
    expect(lodLevel(600, 150)).toBe(3)
  })

  it('stops at the coarsest level', () => {
    expect(MAX_LEVEL).toBe(6)
    expect(lodLevel(1e9, 150)).toBe(MAX_LEVEL)
  })
})

describe('chunkRanges', () => {
  it('cuts whole chunks of 64 cells', () => {
    expect(chunkRanges(128)).toEqual([
      { start: 0, end: 64 },
      { start: 64, end: 128 },
    ])
  })

  it('leaves a smaller chunk at the edge when cells do not divide by 64', () => {
    const r = chunkRanges(334)
    expect(r).toHaveLength(6)
    expect(r[5]).toEqual({ start: 320, end: 334 })
  })
})

describe('sampleIndices', () => {
  it('steps through a chunk and always ends on its edge', () => {
    expect(sampleIndices(320, 334, 4)).toEqual([320, 324, 328, 332, 334])
    expect(sampleIndices(0, 64, 64)).toEqual([0, 64])
    expect(sampleIndices(0, 4, 1)).toEqual([0, 1, 2, 3, 4])
  })
})
