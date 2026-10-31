import { BufferAttribute, BufferGeometry } from 'three'
import type { Ground } from '../world/ground'
import { sampleIndices } from './lod'

export const SKIRT_TRIANGLES_PER_EDGE_STEP = 2

/**
 * The shape of one chunk of ground at one detail level: every `step`-th grid
 * point of the cells in `xr` × `zr`, at its stored height.
 *
 * A skirt hangs down from all four edges, past the chunk's lowest point, so
 * where this chunk meets a coarser or finer neighbour no gap can show.
 * Normals come from the heightmap itself, so lighting matches across chunk
 * edges.
 */
export function buildChunkGeometry(
  ground: Ground,
  xr: { start: number; end: number },
  zr: { start: number; end: number },
  step: number,
): BufferGeometry {
  const xs = sampleIndices(xr.start, xr.end, step)
  const zs = sampleIndices(zr.start, zr.end, step)
  const nx = xs.length
  const nz = zs.length
  const half = ground.size / 2
  const { heights, samples, cellSize, cells } = ground

  // A neighbour's edge line (at any detail level) runs somewhere between this
  // chunk's lowest and highest point, so hanging the skirt down past the
  // lowest point always closes the gap.
  let low = Infinity
  let high = -Infinity
  for (let iz = zr.start; iz <= zr.end; iz++) {
    for (let ix = xr.start; ix <= xr.end; ix++) {
      const v = heights[iz * samples + ix]
      if (v < low) low = v
      if (v > high) high = v
    }
  }
  const skirtDepth = Math.max(1, high - low + 1)

  const pointCount = nx * nz + 2 * (nx + nz)
  const positions = new Float32Array(pointCount * 3)
  const normals = new Float32Array(pointCount * 3)
  const indices: number[] = []
  let p = 0

  const h = (ix: number, iz: number) =>
    heights[Math.min(Math.max(iz, 0), cells) * samples + Math.min(Math.max(ix, 0), cells)]

  const addPoint = (ix: number, iz: number, drop: number): number => {
    positions[p * 3] = -half + ix * cellSize
    positions[p * 3 + 1] = h(ix, iz) - drop
    positions[p * 3 + 2] = -half + iz * cellSize
    // Slope from the neighbouring grid points. At the map's edge there is
    // only one neighbour, so its one-cell difference counts double.
    const x0 = Math.max(ix - 1, 0)
    const x1 = Math.min(ix + 1, cells)
    const z0 = Math.max(iz - 1, 0)
    const z1 = Math.min(iz + 1, cells)
    const sx = ((h(x0, iz) - h(x1, iz)) * 2) / (x1 - x0)
    const sz = ((h(ix, z0) - h(ix, z1)) * 2) / (z1 - z0)
    const len = Math.hypot(sx, 2 * cellSize, sz)
    normals[p * 3] = sx / len
    normals[p * 3 + 1] = (2 * cellSize) / len
    normals[p * 3 + 2] = sz / len
    return p++
  }

  // Top surface, row by row.
  for (const iz of zs) for (const ix of xs) addPoint(ix, iz, 0)
  const top = (i: number, j: number) => j * nx + i
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = top(i, j)
      const b = top(i + 1, j)
      const c = top(i, j + 1)
      const d = top(i + 1, j + 1)
      indices.push(a, c, b, b, c, d) // counter-clockwise seen from above
    }
  }

  // Skirts: a copy of each edge, dropped down, joined to the edge.
  const edges: number[][] = [
    xs.map((_, i) => top(i, 0)),
    xs.map((_, i) => top(i, nz - 1)),
    zs.map((_, j) => top(0, j)),
    zs.map((_, j) => top(nx - 1, j)),
  ]
  for (const edge of edges) {
    const hung = edge.map((t) => {
      const ix = Math.round((positions[t * 3] + half) / cellSize)
      const iz = Math.round((positions[t * 3 + 2] + half) / cellSize)
      return addPoint(ix, iz, skirtDepth)
    })
    for (let k = 0; k < edge.length - 1; k++) {
      indices.push(edge[k], hung[k], edge[k + 1], edge[k + 1], hung[k], hung[k + 1])
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
