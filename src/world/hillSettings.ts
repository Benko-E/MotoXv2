import type { SettingsStore } from '../settings/store'
import type { HillShape } from './hill'

/** Ids of every setting that shapes the hill. */
export const HILL_SETTINGS = [
  'hillX',
  'hillZ',
  'hillFacing',
  'hillHeight',
  'hillTop',
  'runUpLength',
  'runUpFoot',
  'runUpShoulder',
  'runDownLength',
  'runDownFoot',
  'runDownShoulder',
] as const

/** The hill as the settings describe it. */
export function readHill(store: SettingsStore): HillShape {
  return {
    x: store.get('hillX'),
    z: store.get('hillZ'),
    facing: store.get('hillFacing'),
    height: store.get('hillHeight'),
    top: store.get('hillTop'),
    runUp: {
      length: store.get('runUpLength'),
      foot: store.get('runUpFoot'),
      shoulder: store.get('runUpShoulder'),
    },
    runDown: {
      length: store.get('runDownLength'),
      foot: store.get('runDownFoot'),
      shoulder: store.get('runDownShoulder'),
    },
  }
}
