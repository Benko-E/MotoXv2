import type { HillShape } from './hill'

/** A setting's value, how much it varies per hill (± %), and its floor. */
export type Varied = { value: number; variation: number; min: number }

export type VariedSide = { length: Varied; foot: Varied; shoulder: Varied }

/** What every generated hill follows. */
export type HillRules = {
  count: number
  /** Minimum gap between two hills' feet, in metres. */
  spacing: number
  height: Varied
  top: Varied
  runUp: VariedSide
  runDown: VariedSide
}

const TRIES = 50

/** Repeatable random numbers in 0..1 from a seed (mulberry32). */
export function randomStream(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One seed per (seed, stream), so each hill's numbers don't depend on the others. */
function mix(seed: number, stream: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(stream + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d)
  return (h ^ (h >>> 15)) >>> 0
}

/** The value moved by up to ± variation %, `r` (0..1) picking where; never below min. */
export function rollValue(v: Varied, r: number): number {
  return Math.max(v.min, v.value * (1 + (v.variation / 100) * (2 * r - 1)))
}

/** How far the hill reaches from its pole in any direction. */
export function hillRadius(hill: HillShape): number {
  return Math.max(hill.runUp.length, hill.runDown.length, hill.top)
}

/**
 * Rolls up to `rules.count` hills and places them on a map `mapSize` metres
 * wide, centred on 0. Hills whose footprint won't fit inside the map, or
 * Spacing away from the others, in 50 tries are left out.
 */
export function placeHills(rules: HillRules, mapSize: number, seed: number): HillShape[] {
  const half = mapSize / 2
  const placed: HillShape[] = []
  for (let i = 0; i < rules.count; i++) {
    // Shape numbers are drawn in a fixed order, so a slider change only
    // rescales them: hills grow and shrink in place.
    const shape = randomStream(mix(seed, 2 * i))
    const side = (s: VariedSide) => ({
      length: rollValue(s.length, shape()),
      foot: rollValue(s.foot, shape()),
      shoulder: rollValue(s.shoulder, shape()),
    })
    const facing = Math.floor(shape() * 360)
    const height = rollValue(rules.height, shape())
    const top = rollValue(rules.top, shape())
    const runUp = side(rules.runUp)
    const runDown = side(rules.runDown)
    const hill: HillShape = { x: 0, z: 0, facing, height, top, runUp, runDown }

    const r = hillRadius(hill)
    if (r > half) continue
    const where = randomStream(mix(seed, 2 * i + 1))
    for (let t = 0; t < TRIES; t++) {
      // Spots are picked across the whole map, not shrunk by the hill's
      // size, so a size change leaves the hill where it was.
      hill.x = -half + where() * mapSize
      hill.z = -half + where() * mapSize
      if (Math.abs(hill.x) + r > half || Math.abs(hill.z) + r > half) continue
      const clear = placed.every(
        (o) => Math.hypot(o.x - hill.x, o.z - hill.z) >= r + hillRadius(o) + rules.spacing,
      )
      if (clear) {
        placed.push(hill)
        break
      }
    }
  }
  return placed
}
