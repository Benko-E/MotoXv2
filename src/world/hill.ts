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

  const facing = (hill.facing * Math.PI) / 180
  const towardsD = (dx * Math.sin(facing) - dz * Math.cos(facing)) / r // cos of the angle to D
  const w = (1 + towardsD) / 2 // 0 straight towards A, 1 straight towards D
  const mix = (a: number, b: number) => a + (b - a) * w
  const reach = mix(hill.runUp.length, hill.runDown.length)
  if (r >= reach) return 0

  const u = 1 - (r - hill.top) / (reach - hill.top)
  return hill.height * profile(u, mix(hill.runUp.foot, hill.runDown.foot), mix(hill.runUp.shoulder, hill.runDown.shoulder))
}

/** The square the hill can reach into. */
export function hillBounds(hill: HillShape): Area {
  const r = Math.max(hill.runUp.length, hill.runDown.length)
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

/**
 * Recalculates the heights inside `area` as flat ground plus the hill.
 * Bake the hill's old and new areas together when it moves, so nothing of
 * the old one is left behind.
 */
export function bakeHill(ground: Ground, hill: HillShape, area: Area): void {
  const { cells, cellSize, samples, heights } = ground
  const half = ground.size / 2
  const toIndex = (v: number) => Math.min(Math.max(v, 0), cells)
  const ix0 = toIndex(Math.floor((area.minX + half) / cellSize))
  const ix1 = toIndex(Math.ceil((area.maxX + half) / cellSize))
  const iz0 = toIndex(Math.floor((area.minZ + half) / cellSize))
  const iz1 = toIndex(Math.ceil((area.maxZ + half) / cellSize))
  for (let iz = iz0; iz <= iz1; iz++) {
    const z = -half + iz * cellSize
    for (let ix = ix0; ix <= ix1; ix++) {
      heights[iz * samples + ix] = hillHeight(hill, -half + ix * cellSize, z)
    }
  }
}
