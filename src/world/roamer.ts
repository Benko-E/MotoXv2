import { randomStream } from './hills'

/** How hard it can turn, in radians per second. */
const MAX_TURN = 0.8
/** How quickly its mind about turning changes, per second. */
const WOBBLE = 1.5

/**
 * Something that wanders the map on its own: drives forward, turning
 * smoothly at random, and swings back towards the middle near the edge.
 * Heading 0 = north (−z), clockwise, like the hills' facing.
 */
export class Roamer {
  x = 0
  z = 0
  heading = 0
  private turn = 0
  private readonly random: () => number

  constructor(seed: number) {
    this.random = randomStream(seed)
    this.heading = this.random() * Math.PI * 2
  }

  update(dt: number, speed: number, mapSize: number): void {
    const half = mapSize / 2
    const margin = Math.min(40, half * 0.3)

    // Random, smoothly changing turn
    this.turn += (this.random() * 2 - 1) * WOBBLE * dt
    this.turn = Math.max(-1, Math.min(1, this.turn))
    let rate = this.turn * MAX_TURN

    // Near the edge, turn towards the middle instead
    if (Math.abs(this.x) > half - margin || Math.abs(this.z) > half - margin) {
      const toMiddle = Math.atan2(-this.x, this.z)
      const off = Math.atan2(Math.sin(toMiddle - this.heading), Math.cos(toMiddle - this.heading))
      rate = Math.sign(off) * MAX_TURN * 2
    }
    this.heading += rate * dt

    this.x += Math.sin(this.heading) * speed * dt
    this.z -= Math.cos(this.heading) * speed * dt
    // Never outside the map, even right after the map shrinks
    const limit = half - 1
    this.x = Math.max(-limit, Math.min(limit, this.x))
    this.z = Math.max(-limit, Math.min(limit, this.z))
  }
}
