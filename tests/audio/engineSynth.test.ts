import { describe, expect, it } from 'vitest'
import { EngineSynth, type EngineSound } from '../../src/audio/engineSynth'

const RATE = 48000

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function play(sound: Partial<EngineSound>, seconds = 1): { synth: EngineSynth; out: Float32Array } {
  const synth = new EngineSynth(RATE, seeded(7))
  const full: EngineSound = { rpm: 6000, load: 0.5, cut: false, revLimit: 11000, volume: 1, ...sound }
  synth.set(full)
  synth.set(full) // twice, so the rpm doesn't glide from idle
  const out = new Float32Array(Math.round(RATE * seconds))
  synth.render(out)
  return { synth, out }
}

function rms(a: Float32Array): number {
  let sum = 0
  for (const v of a) sum += v * v
  return Math.sqrt(sum / a.length)
}

describe('EngineSynth', () => {
  it('fires once every two engine turns', () => {
    expect(play({ rpm: 6000 }).synth.firings).toBeGreaterThan(48)
    expect(play({ rpm: 6000 }).synth.firings).toBeLessThan(52)
    expect(play({ rpm: 1500 }).synth.firings).toBeLessThan(14)
  })

  it('is silent while the ignition is cut', () => {
    const { synth, out } = play({ cut: true }, 0.5)
    expect(synth.firings).toBe(0)
    expect(rms(out)).toBeLessThan(1e-3)
  })

  it('is louder with the throttle open', () => {
    expect(rms(play({ load: 1 }).out)).toBeGreaterThan(rms(play({ load: 0.1 }).out) * 1.5)
  })

  it('misses firings at the limiter', () => {
    const free = play({ rpm: 10000 }).synth.firings
    const limiting = play({ rpm: 10990 }).synth.firings
    expect(limiting).toBeLessThan((free * 11000) / 10000 * 0.8)
  })

  it('pops now and then off the throttle at high rpm', () => {
    expect(play({ load: 0, rpm: 7000 }, 2).synth.pops).toBeGreaterThan(3)
    expect(play({ load: 1, rpm: 7000 }, 2).synth.pops).toBe(0)
  })

  it('stays within −1…1 and follows the volume', () => {
    const loud = play({ load: 1, rpm: 9000 }).out
    expect(Math.max(...loud.map(Math.abs))).toBeLessThanOrEqual(1)
    expect(rms(play({ volume: 0 }).out)).toBe(0)
  })

  it('stays quiet and sound before it hears from the game, then fires', () => {
    const synth = new EngineSynth(RATE, seeded(3))
    const early = new Float32Array(128)
    synth.render(early)
    expect(early.every((v) => v === 0)).toBe(true)
    synth.set({ rpm: 6000, load: 0.5, cut: false, revLimit: 11000, volume: 1 })
    const out = new Float32Array(RATE)
    synth.render(out)
    expect(synth.firings).toBeGreaterThan(40)
    expect(out.every(Number.isFinite)).toBe(true)
  })
})
