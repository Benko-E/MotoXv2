/** The most physics time one frame may catch up; beyond this it slows down instead. */
const MAX_CATCH_UP = 0.1

/**
 * Runs physics in fixed-length steps however fast the screen draws, so
 * springs and tyres behave the same at 30 or 144 frames a second.
 */
export class FixedClock {
  private owed = 0

  constructor(readonly step: number) {}

  /** Adds `dt` seconds of frame time and runs `stepFn` once per whole step owed. */
  advance(dt: number, stepFn: (step: number) => void): void {
    this.owed = Math.min(this.owed + dt, MAX_CATCH_UP)
    // A tiny tolerance so 0.01 s at 1/500 is 5 steps, not 4 plus rounding dust.
    while (this.owed >= this.step - 1e-9) {
      stepFn(this.step)
      this.owed -= this.step
    }
    if (this.owed < 0) this.owed = 0
  }
}
