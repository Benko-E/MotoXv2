import type { SettingsStore } from '../settings/store'
import type { BikeParams } from './bike'

const DEG = Math.PI / 180

/** The bike as the BIKE and RIDER tabs describe it (springs and dampers in kN, angles in degrees). */
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
    slideGrip: store.get('slideGrip') / 100,
    peakTorque: store.get('peakTorque'),
    gears: [1, 2, 3, 4, 5].map((n) => store.get(`gear${n}`)),
    revLimit: store.get('revLimit'),
    engineBraking: store.get('engineBraking'),
    frontBrake: store.get('frontBrake'),
    rearBrake: store.get('rearBrake'),
    riderControl: store.isOn('riderControl'),
    canCrash: store.isOn('canCrash'),
    maxLean: store.get('maxLean') * DEG,
    barLock: store.get('barLock') * DEG,
    turnAtSpeed: store.get('turnAtSpeed') / 100,
    riderReach: store.get('riderReach'),
    crashLean: store.get('crashLean') * DEG,
  }
}
