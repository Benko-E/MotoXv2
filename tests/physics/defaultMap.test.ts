import { describe, expect, it } from 'vitest'
import { Bike } from '../../src/physics/bike'
import { readBikeParams } from '../../src/physics/bikeSettings'
import { ramp, rampTo } from '../../src/physics/controls'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { type Ground, makeGround } from '../../src/world/ground'
import { readHillRules } from '../../src/world/hillSettings'
import { placeHills } from '../../src/world/hills'
import { bakeArea, makeNoiseField } from '../../src/world/terrain'
import { fakeStorage } from '../helpers/fakeStorage'

/** The map the game starts on, built the way the game builds it. */
function defaultMap(store: SettingsStore): Ground {
  const seed = Math.round(store.get('seed'))
  const ground = makeGround(store.get('mapSize'), store.get('cellSize'))
  const rules = {
    height: store.get('noiseHeight'),
    width: store.get('noiseWidth'),
    detail: store.get('noiseDetail'),
    calm: store.get('noiseCalm'),
  }
  const half = ground.size / 2
  const hills = placeHills(readHillRules(store), ground.size, seed)
  bakeArea(ground, hills, makeNoiseField(rules, seed), rules, { minX: -half, maxX: half, minZ: -half, maxZ: half })
  return ground
}

describe('Bike on the default map', () => {
  it('holding W, then A or D, for 25 s (round and round, off crests at top speed): it stays up', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const ground = defaultMap(store)
    const FRAME = 1 / 60
    const STEPS = 8 // 480 steps a second, near enough the game's 500
    for (const turnAt of [0.3, 1, 2, 3, 5]) {
      for (const steer of [1, -1]) {
        const bike = new Bike(readBikeParams(store))
        bike.drop(0, 0, 0, 3, ground)
        const keys = { throttle: 0, brake: 0, rearBrake: 0, steer: 0, riderShift: 0 }
        for (let n = 0; n < 60 * 3 * STEPS; n++) bike.step(1 / 480, keys, ground)
        for (let n = 0; n < 60 * 25; n++) {
          // Eased in like the keys in the game.
          keys.throttle = ramp(keys.throttle, true, FRAME, 0.25, 0.15)
          keys.steer = rampTo(keys.steer, n * FRAME >= turnAt ? steer : 0, FRAME, 0.12)
          for (let k = 0; k < STEPS; k++) bike.step(1 / 480, keys, ground)
          if (bike.crashed) break
        }
        expect(bike.crashed, `${steer > 0 ? 'D' : 'A'} at ${turnAt} s`).toBe(false)
      }
    }
  })
})
