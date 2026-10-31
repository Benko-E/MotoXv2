import { SETTINGS } from '../settings/list'
import type { SettingsStore } from '../settings/store'
import type { HillRules, Varied } from './hills'

/** The hill rules as the settings describe them. */
export function readHillRules(store: SettingsStore): HillRules {
  const varied = (id: string): Varied => {
    const setting = SETTINGS.find((s) => s.id === id)
    const min = setting && setting.kind === 'slider' ? setting.min : 0
    return { value: store.get(id), variation: store.get(`${id}Var`), min }
  }
  const side = (prefix: string) => ({
    length: varied(`${prefix}Length`),
    foot: varied(`${prefix}Foot`),
    shoulder: varied(`${prefix}Shoulder`),
  })
  return {
    count: store.get('hillCount'),
    spacing: store.get('hillSpacing'),
    height: varied('hillHeight'),
    top: varied('hillTop'),
    runUp: side('runUp'),
    runDown: side('runDown'),
  }
}
