/**
 * The map's ground: a square grid of cells centred on the world origin.
 * Flat for now; the spline step decides how heights are stored.
 */
export interface Ground {
  cellSize: number
  /** Cells along each side. */
  cells: number
  /** Real side length in metres (cells × cellSize). */
  size: number
  heightAt(x: number, z: number): number
}

/**
 * Fits whole cells over the asked-for size, rounding up, so the real map can
 * be a little bigger than asked (1000 m with 3 m cells is 334 cells, 1002 m).
 */
export function makeGround(mapSize: number, cellSize: number): Ground {
  // The small allowance stops float noise (115 / 2.3 = 50.00000000000001)
  // from adding a whole extra cell.
  const cells = Math.ceil(mapSize / cellSize - 1e-9)
  return {
    cellSize,
    cells,
    size: cells * cellSize,
    heightAt: () => 0,
  }
}
