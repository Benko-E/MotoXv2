import { describe, expect, it } from 'vitest'
import { buildChunkGeometry, SKIRT_TRIANGLES_PER_EDGE_STEP } from '../../src/render/chunkGeometry'
import { makeGround } from '../../src/world/ground'

describe('buildChunkGeometry', () => {
  // A 128 m map with 1 m cells and a gentle slope, so heights differ per point.
  const ground = makeGround(128, 1)
  for (let iz = 0; iz < ground.samples; iz++) {
    for (let ix = 0; ix < ground.samples; ix++) ground.heights[iz * ground.samples + ix] = ix * 0.1 + iz * 0.2
  }
  const x = { start: 64, end: 128 }
  const z = { start: 0, end: 64 }

  it('has one top point per sample and two triangles per quad, plus the skirt', () => {
    const geo = buildChunkGeometry(ground, x, z, 1)
    const top = 65 * 65
    const skirtPoints = 4 * 65
    expect(geo.getAttribute('position').count).toBe(top + skirtPoints)
    const topTriangles = 64 * 64 * 2
    const skirtTriangles = 4 * 64 * SKIRT_TRIANGLES_PER_EDGE_STEP
    expect(geo.getIndex()!.count / 3).toBe(topTriangles + skirtTriangles)
  })

  it('puts every top point at the stored height', () => {
    const geo = buildChunkGeometry(ground, x, z, 4)
    const pos = geo.getAttribute('position')
    const points = 17 * 17
    for (let i = 0; i < points; i++) {
      expect(pos.getY(i)).toBeCloseTo(ground.heightAt(pos.getX(i), pos.getZ(i)), 5)
    }
    // The chunk covers x 0..64 m and z -64..0 m in the world.
    expect(pos.getX(0)).toBe(0)
    expect(pos.getZ(0)).toBe(-64)
    expect(pos.getX(points - 1)).toBe(64)
    expect(pos.getZ(points - 1)).toBe(0)
  })

  it('on a hill, the skirt reaches below the lowest point in the chunk', () => {
    // A 50 m ridge along the chunk's edge: a coarser neighbour's edge line can
    // run anywhere between the chunk's lowest and highest point, so the skirt
    // must hang down past the lowest one or a slit shows through.
    const hilly = makeGround(128, 1)
    for (let iz = 0; iz < hilly.samples; iz++) hilly.heights[iz * hilly.samples + 64] = 50
    const geo = buildChunkGeometry(hilly, x, z, 1)
    const pos = geo.getAttribute('position')
    for (let i = 65 * 65; i < pos.count; i++) expect(pos.getY(i)).toBeLessThan(0)
  })

  it('lights the map edge with the same slope as just inside it', () => {
    // ground rises 0.1 m per cell along x everywhere; the last chunk touches the map edge
    const geo = buildChunkGeometry(ground, x, z, 1)
    const n = geo.getAttribute('normal')
    const edge = 64 // top row, last point: x index 128, the map's edge
    const inside = 63
    expect(n.getX(edge)).toBeCloseTo(n.getX(inside), 5)
    expect(n.getY(edge)).toBeCloseTo(n.getY(inside), 5)
  })

  it('hangs the skirt below the edge', () => {
    const geo = buildChunkGeometry(ground, x, z, 4)
    const pos = geo.getAttribute('position')
    const points = 17 * 17
    for (let i = points; i < pos.count; i++) {
      expect(pos.getY(i)).toBeLessThan(ground.heightAt(pos.getX(i), pos.getZ(i)) - 0.5)
    }
  })
})
