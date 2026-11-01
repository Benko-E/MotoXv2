import type { SettingsStore } from '../settings/store'
import { DEFAULT_BIKE, type BikeParams } from './bike'

const DEG = Math.PI / 180

/**
 * The bike as the BIKE and RIDER tabs describe it (angles in degrees, shares
 * in per cent). What the menu doesn't show stays at the physics default.
 */
export function readBikeParams(store: SettingsStore): BikeParams {
  return {
    ...DEFAULT_BIKE,
    barLock: store.get('barLock') * DEG,
    turnAt40: store.get('turnAt40'),
    turnAt100: store.get('turnAt100'),
    maxLean: store.get('maxLean') * DEG,
    riderControl: store.isOn('riderControl'),
    canCrash: store.isOn('canCrash'),
    riderReach: store.get('riderReach'),
    crashLean: store.get('crashLean') * DEG,
  }
}
