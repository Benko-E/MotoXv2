import type { Ground } from './ground'
import { type Area, type HillShape, hillBounds, hillHeight, hillReach, indexRange } from './hill'
import { makeNoise2D } from './noise'

/** The rolling ground under and between the hills. */
export type NoiseRules = {
  /** Roughly how far up or down the ground rolls, in metres. */
  height: number
  /** Metres from one big rise to the next. */
  width: number
  /** 0–100 %: how much the smaller bumps add on top of the big swells. */
  detail: number
  /** Metres past a hill's foot over which the small bumps return. */
  calm: number
}

/** The noise in metres, split into the big swells and the small bumps on them. */
export type NoiseField = { big(x: number, z: number): number; small(x: number, z: number): number }

/** Smaller bump layers on top of the big swell, each half the size of the last. */
const SMALL_LAYERS = 4

export function makeNoiseField(rules: NoiseRules, seed: number): NoiseField {
  // Each layer gets its own pattern, so their rises don't line up.
  const layers = Array.from({ length: SMALL_LAYERS + 1 }, (_, i) => makeNoise2D(seed * 31 + i + 1))
  const keep = 0.55 * (rules.detail / 100) // how much of each layer the next one keeps
  const amplitudes = layers.map((_, i) => keep ** i)
  // Scaled so big + small never pass ± the bump height.
  const scale = rules.height / amplitudes.reduce((a, b) => a + b, 0)
  const width = Math.max(rules.width, 1e-6)
  return {
    big: (x, z) => scale * layers[0](x / width, z / width),
    small: (x, z) => {
      if (keep === 0 || scale === 0) return 0
      let sum = 0
      for (let i = 1; i <= SMALL_LAYERS; i++) {
        const f = 2 ** i / width
        sum += amplitudes[i] * layers[i](x * f, z * f)
      }
      return scale * sum
    },
  }
}

/** The square a hill calms the noise in: its footprint plus the calm distance. */
export function calmBounds(hill: HillShape, calm: number): Area {
  const b = hillBounds(hill)
  return { minX: b.minX - calm, maxX: b.maxX + calm, minZ: b.minZ - calm, maxZ: b.maxZ + calm }
}

/**
 * Recalculates every height inside `area`: the big swells, the small bumps
 * (faded out on hills and within the calm distance of their feet), and the
 * hills on top (the higher hill wins where two meet).
 */
export function bakeArea(ground: Ground, hills: HillShape[], field: NoiseField, rules: NoiseRules, area: Area): void {
  const { cellSize, samples, heights } = ground
  const half = ground.size / 2
  const { ix0, ix1, iz0, iz1 } = indexRange(ground, area)
  const w = ix1 - ix0 + 1
  const calm = new Float32Array(w * (iz1 - iz0 + 1)) // 1 = no small bumps
  const raise = new Float32Array(calm.length) // the hills' height

  for (const hill of hills) {
    const r = indexRange(ground, calmBounds(hill, rules.calm))
    for (let iz = Math.max(r.iz0, iz0); iz <= Math.min(r.iz1, iz1); iz++) {
      const dz = -half + iz * cellSize - hill.z
      for (let ix = Math.max(r.ix0, ix0); ix <= Math.min(r.ix1, ix1); ix++) {
        const dx = -half + ix * cellSize - hill.x
        const k = (iz - iz0) * w + (ix - ix0)
        const past = Math.hypot(dx, dz) - hillReach(hill, dx, dz) // metres past the foot
        let c = 1
        if (past > 0) {
          const t = rules.calm > 0 ? Math.min(past / rules.calm, 1) : 1
          c = 1 - t * t * (3 - 2 * t)
        }
        if (c > calm[k]) calm[k] = c
        const h = hillHeight(hill, hill.x + dx, hill.z + dz)
        if (h > raise[k]) raise[k] = h
      }
    }
  }

  for (let iz = iz0; iz <= iz1; iz++) {
    const z = -half + iz * cellSize
    for (let ix = ix0; ix <= ix1; ix++) {
      const x = -half + ix * cellSize
      const k = (iz - iz0) * w + (ix - ix0)
      const bumps = calm[k] < 1 ? (1 - calm[k]) * field.small(x, z) : 0
      heights[iz * samples + ix] = field.big(x, z) + bumps + raise[k]
    }
  }
}
