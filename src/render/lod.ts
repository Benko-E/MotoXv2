/** Cells along one side of a chunk. */
export const CHUNK_CELLS = 64

/** Coarsest level: every 64th point, one quad per chunk. */
export const MAX_LEVEL = Math.log2(CHUNK_CELLS)

/**
 * Detail level for something `distance` metres away. Level 0 (every cell)
 * closer than `detailDistance`, then one level coarser each time the distance
 * doubles: level 1 up to 2×, level 2 up to 4×, and so on.
 */
export function lodLevel(distance: number, detailDistance: number): number {
  if (distance < detailDistance) return 0
  return Math.min(MAX_LEVEL, Math.floor(Math.log2(distance / detailDistance)) + 1)
}

/** Splits a side of `cells` cells into chunks; the last one may be smaller. */
export function chunkRanges(cells: number): { start: number; end: number }[] {
  const ranges = []
  for (let start = 0; start < cells; start += CHUNK_CELLS) {
    ranges.push({ start, end: Math.min(start + CHUNK_CELLS, cells) })
  }
  return ranges
}

/** Grid points from `start` to `end` every `step`, always ending on `end`. */
export function sampleIndices(start: number, end: number, step: number): number[] {
  const out = []
  for (let i = start; i < end; i += step) out.push(i)
  out.push(end)
  return out
}
