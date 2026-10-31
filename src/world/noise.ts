import { randomStream } from './hills'

/** Eight evenly spread slope directions, one picked per grid corner. */
const GX = Float64Array.from({ length: 8 }, (_, i) => Math.cos((i * Math.PI) / 4))
const GY = Float64Array.from({ length: 8 }, (_, i) => Math.sin((i * Math.PI) / 4))

/**
 * Smooth gradient (Perlin) noise from a seed: rolling values in -1..1 that
 * change smoothly, with about one rise or dip per 1 unit of x or y.
 */
export function makeNoise2D(seed: number): (x: number, y: number) => number {
  // A shuffled 0..255 table, doubled so corner lookups never wrap by hand.
  const random = randomStream(seed)
  const order = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = order[i & 255]

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  // Flat number arrays, not nested ones: this runs millions of times per bake.
  const corner = (ix: number, iy: number, fx: number, fy: number) => {
    const g = perm[perm[ix & 255] + (iy & 255)] & 7
    return GX[g] * fx + GY[g] * fy
  }

  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const u = fade(fx)
    const v = fade(fy)
    const a = corner(x0, y0, fx, fy)
    const b = corner(x0 + 1, y0, fx - 1, fy)
    const c = corner(x0, y0 + 1, fx, fy - 1)
    const d = corner(x0 + 1, y0 + 1, fx - 1, fy - 1)
    const value = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
    // Raw values stay within about ±0.71; stretch to ±1.
    return Math.max(-1, Math.min(1, value * Math.SQRT2))
  }
}
