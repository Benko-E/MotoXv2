/** What the engine is doing, as the sound needs it. */
export type EngineSound = {
  rpm: number
  /** How far the throttle is open, 0–1 (after wheelie control). */
  load: number
  /** Ignition cut (an up-shift): no bangs. */
  cut: boolean
  revLimit: number
  /** 0–1. */
  volume: number
}

/** How quickly the sound follows an rpm change, seconds. */
const RPM_GLIDE = 0.02
/** How long one bang rings, and one pop, seconds. */
const BANG_TIME = 0.003
const POP_TIME = 0.004
/** At the limiter, the share of bangs that miss. */
const LIMITER_MISS = 0.6
const LIMITER_RPM = 150
/** Off the throttle above `rpm`, the chance each bang comes with a pop. */
const POPS = { rpm: 3000, chance: 0.06, belowLoad: 0.05 }

/**
 * A 4-stroke single, made from scratch: one bang every two engine turns,
 * rung through an exhaust's low thump and its rasp, plus pops and crackles
 * off the throttle. Pure numbers, so it runs in an audio worklet and in tests.
 */
export class EngineSynth {
  /** Bangs and pops so far (for tests and debugging). */
  firings = 0
  pops = 0
  private sound: EngineSound = { rpm: 0, load: 0, cut: false, revLimit: 11000, volume: 0 }
  private rpm = NaN
  private phase = 0
  private bang = 0
  private pop = 0
  private readonly glide: number
  private readonly bangFade: number
  private readonly popFade: number
  private readonly thump: Resonator
  private readonly rasp: Resonator
  private readonly crackle: Resonator

  constructor(
    private readonly rate: number,
    private readonly random: () => number = Math.random,
  ) {
    this.glide = 1 - Math.exp(-1 / (RPM_GLIDE * rate))
    this.bangFade = Math.exp(-1 / (BANG_TIME * rate))
    this.popFade = Math.exp(-1 / (POP_TIME * rate))
    this.thump = new Resonator(120, 2, rate)
    this.rasp = new Resonator(800, 3, rate)
    this.crackle = new Resonator(2500, 1, rate)
  }

  set(sound: EngineSound): void {
    this.sound = sound
    if (Number.isNaN(this.rpm)) this.rpm = sound.rpm
  }

  render(out: Float32Array): void {
    // Nothing from the game yet (the audio thread can start first): stay quiet.
    if (Number.isNaN(this.rpm)) {
      out.fill(0)
      return
    }
    const s = this.sound
    const drive = 1 + 2 * s.load
    const raspGain = 0.4 + 0.8 * s.load
    for (let i = 0; i < out.length; i++) {
      this.rpm += (s.rpm - this.rpm) * this.glide
      this.phase += this.rpm / 120 / this.rate // one bang per two turns
      if (this.phase >= 1) {
        this.phase -= 1
        this.fire()
      }
      const excite = this.bang * (0.7 + 0.6 * (this.random() - 0.5))
      this.bang *= this.bangFade
      const crack = this.pop * (this.random() * 2 - 1)
      this.pop *= this.popFade
      const y = 2.5 * this.thump.next(excite) + raspGain * this.rasp.next(excite) + 1.5 * this.crackle.next(crack)
      out[i] = Math.tanh(y * drive) * s.volume * 0.8
    }
  }

  private fire(): void {
    const s = this.sound
    if (s.cut) return
    if (this.rpm > s.revLimit - LIMITER_RPM && this.random() < LIMITER_MISS) return
    this.firings++
    // Each bang a little different: rough, not smooth.
    this.bang = (0.25 + 0.75 * s.load) * (0.85 + 0.3 * this.random())
    if (s.load < POPS.belowLoad && this.rpm > POPS.rpm && this.random() < POPS.chance) {
      this.pops++
      this.pop = 1
    }
  }
}

/** A band-pass filter: rings at `frequency` when struck. */
class Resonator {
  private readonly b0: number
  private readonly a1: number
  private readonly a2: number
  private x1 = 0
  private x2 = 0
  private y1 = 0
  private y2 = 0

  constructor(frequency: number, q: number, rate: number) {
    const w = (2 * Math.PI * frequency) / rate
    const alpha = Math.sin(w) / (2 * q)
    const a0 = 1 + alpha
    this.b0 = alpha / a0
    this.a1 = (-2 * Math.cos(w)) / a0
    this.a2 = (1 - alpha) / a0
  }

  next(x: number): number {
    const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
}
