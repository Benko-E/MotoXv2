import type { Ground } from './ground'

/** One side of a hill: from the pole out to its foot. */
export type HillSide = {
  /** Metres from the pole (B) to the foot (A or D). */
  length: number
  /** How gradually the slope starts at the foot (1 = sharp corner). */
  foot: number
  /** How rounded the slope is near the top (1 = sharp edge). */
  shoulder: number
}

/** A hill as in the user's drawing: pole B, height to C, run-up to A, run-down to D. */
export type HillShape = {
  x: number
  z: number
  /** Direction from A towards D, in degrees: 0 = north (−z), 90 = east (+x). */
  facing: number
  height: number
  /** Radius of the flat top around the pole. */
  top: number
  runUp: HillSide
  runDown: HillSide
}

/** An area of the map in world metres. */
export type Area = { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * A slope's shape from foot (u = 0) to top edge (u = 1), rising 0 to 1.
 * `foot` and `shoulder` of 1 give a straight slope; bigger values soften the
 * bottom and round the top.
 */
export function profile(u: number, foot: number, shoulder: number): number {
  if (u <= 0) return 0
  if (u >= 1) return 1
  const up = u ** foot
  return up / (up + (1 - u) ** shoulder)
}

/**
 * The hill's height above the ground at (x, z). Going round the pole, the
 * side's length, foot and shoulder blend smoothly from the run-up numbers
 * (straight towards A) to the run-down numbers (straight towards D), so there
 * is no seam down the flanks.
 */
export function hillHeight(hill: HillShape, x: number, z: number): number {
  const dx = x - hill.x
  const dz = z - hill.z
  const r = Math.hypot(dx, dz)
  if (r <= hill.top) return hill.height

  const w = sideMix(hill, dx, dz, r)
  const mix = (a: number, b: number) => a + (b - a) * w
  const reach = mix(hill.runUp.length, hill.runDown.length)
  if (r >= reach) return 0

  const u = 1 - (r - hill.top) / (reach - hill.top)
  return hill.height * profile(u, mix(hill.runUp.foot, hill.runDown.foot), mix(hill.runUp.shoulder, hill.runDown.shoulder))
}

/** 0 looking from the pole straight towards A, 1 straight towards D. */
function sideMix(hill: HillShape, dx: number, dz: number, r: number): number {
  if (r === 0) return 0.5
  const facing = (hill.facing * Math.PI) / 180
  const towardsD = (dx * Math.sin(facing) - dz * Math.cos(facing)) / r // cos of the angle to D
  return (1 + towardsD) / 2
}

/** How far from the pole the hill meets the ground, in the direction (dx, dz). */
export function hillReach(hill: HillShape, dx: number, dz: number): number {
  const w = sideMix(hill, dx, dz, Math.hypot(dx, dz))
  return hill.runUp.length + (hill.runDown.length - hill.runUp.length) * w
}

/** The square the hill can reach into. */
export function hillBounds(hill: HillShape): Area {
  const r = Math.max(hill.runUp.length, hill.runDown.length, hill.top)
  return { minX: hill.x - r, maxX: hill.x + r, minZ: hill.z - r, maxZ: hill.z + r }
}

/** Both areas together. */
export function joinAreas(a: Area, b: Area): Area {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minZ: Math.min(a.minZ, b.minZ),
    maxZ: Math.max(a.maxZ, b.maxZ),
  }
}

/** The sample index range covering `area`, clamped to the map. */
export function indexRange(ground: Ground, area: Area) {
  const { cells, cellSize } = ground
  const half = ground.size / 2
  const toIndex = (v: number) => Math.min(Math.max(v, 0), cells)
  return {
    ix0: toIndex(Math.floor((area.minX + half) / cellSize)),
    ix1: toIndex(Math.ceil((area.maxX + half) / cellSize)),
    iz0: toIndex(Math.floor((area.minZ + half) / cellSize)),
    iz1: toIndex(Math.ceil((area.maxZ + half) / cellSize)),
  }
}

/** Sets the heights inside `area` back to flat ground. */
export function flattenArea(ground: Ground, area: Area): void {
  const { ix0, ix1, iz0, iz1 } = indexRange(ground, area)
  for (let iz = iz0; iz <= iz1; iz++) ground.heights.fill(0, iz * ground.samples + ix0, iz * ground.samples + ix1 + 1)
}

/**
 * Raises the ground to the hill wherever the hill is higher, so where two
 * hills meet the higher one wins. Flatten the old hills' areas first when
 * hills move.
 */
export function addHill(ground: Ground, hill: HillShape): void {
  const { cellSize, samples, heights } = ground
  const half = ground.size / 2
  const { ix0, ix1, iz0, iz1 } = indexRange(ground, hillBounds(hill))
  for (let iz = iz0; iz <= iz1; iz++) {
    const z = -half + iz * cellSize
    for (let ix = ix0; ix <= ix1; ix++) {
      const i = iz * samples + ix
      const h = hillHeight(hill, -half + ix * cellSize, z)
      if (h > heights[i]) heights[i] = h
    }
  }
}
