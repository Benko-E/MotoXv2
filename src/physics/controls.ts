/**
 * Moves a control (throttle, brake) from `value` toward fully on or fully off:
 * fully opening takes `openTime` seconds, fully closing `closeTime`.
 */
export function ramp(value: number, on: boolean, dt: number, openTime: number, closeTime: number): number {
  if (on) return Math.min(1, value + dt / openTime)
  return Math.max(0, value - dt / closeTime)
}

/** Moves a −1…1 control (steering, rider weight) toward `target`, a full swing of 1 taking `time` seconds. */
export function rampTo(value: number, target: number, dt: number, time: number): number {
  const step = dt / time
  return value + Math.max(-step, Math.min(step, target - value))
}
