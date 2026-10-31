import type { SettingsStore } from '../settings/store'
import type { BikeParams } from './bike'

/** The bike as the BIKE tab describes it (springs and dampers are set in kN). */
export function readBikeParams(store: SettingsStore): BikeParams {
  return {
    bikeMass: store.get('bikeMass'),
    riderMass: store.get('riderMass'),
    travel: store.get('travel'),
    frontSpring: store.get('frontSpring') * 1000,
    rearSpring: store.get('rearSpring') * 1000,
    frontDamping: store.get('frontDamping') * 1000,
    rearDamping: store.get('rearDamping') * 1000,
    grip: store.get('grip'),
    push: store.get('pushForce'),
  }
}
