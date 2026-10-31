/**
 * Most cells along one side of the map. 4,096 per side is about 17 million
 * heights (67 MB); a 4,000 m map with 0.25 m cells would be 1 GB.
 */
export const MAX_CELLS = 4096

/**
 * The map's ground: a square grid of cells centred on the world origin, with
 * one stored height per grid point.
 */
export interface Ground {
  /** Cell size actually used (may be bigger than asked, see `limited`). */
  cellSize: number
  /** Cells along each side. */
  cells: number
  /** Grid points along each side (cells + 1). */
  samples: number
  /** Real side length in metres (cells × cellSize). */
  size: number
  /** True when the map was too big for the asked-for cell size. */
  limited: boolean
  /**
   * Heights, row by row: point (ix, iz) is `heights[iz * samples + ix]`, at
   * x = -size/2 + ix·cellSize, z = -size/2 + iz·cellSize.
   */
  heights: Float32Array
  /** Height anywhere, blended between the four nearest points. */
  heightAt(x: number, z: number): number
}

/** The cell size a map actually uses: the asked one, or bigger if it wouldn't fit MAX_CELLS. */
export function cellSizeUsed(mapSize: number, askedCellSize: number): number {
  return Math.max(askedCellSize, mapSize / MAX_CELLS)
}

/**
 * Fits whole cells over the asked-for size, rounding up, so the real map can
 * be a little bigger than asked (1000 m with 3 m cells is 334 cells, 1002 m).
 * Cells are made bigger when the map wouldn't fit in MAX_CELLS.
 */
export function makeGround(mapSize: number, askedCellSize: number): Ground {
  const cellSize = cellSizeUsed(mapSize, askedCellSize)
  const limited = cellSize !== askedCellSize
  // The small allowance stops float noise (115 / 2.3 = 50.00000000000001)
  // from adding a whole extra cell.
  const cells = Math.ceil(mapSize / cellSize - 1e-9)
  const samples = cells + 1
  const size = cells * cellSize
  const heights = new Float32Array(samples * samples)
  const half = size / 2

  const heightAt = (x: number, z: number): number => {
    const gx = Math.min(Math.max((x + half) / cellSize, 0), cells)
    const gz = Math.min(Math.max((z + half) / cellSize, 0), cells)
    const ix = Math.min(Math.floor(gx), cells - 1)
    const iz = Math.min(Math.floor(gz), cells - 1)
    const fx = gx - ix
    const fz = gz - iz
    const i = iz * samples + ix
    const top = heights[i] * (1 - fx) + heights[i + 1] * fx
    const bottom = heights[i + samples] * (1 - fx) + heights[i + samples + 1] * fx
    return top * (1 - fz) + bottom * fz
  }

  return { cellSize, cells, samples, size, limited, heights, heightAt }
}
