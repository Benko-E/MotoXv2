import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { readHillRules } from '../../src/world/hillSettings'
import { fakeStorage } from '../helpers/fakeStorage'

describe('readHillRules', () => {
  it('reads value, variation and the slider minimum for each shape setting', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.set('hillHeightVar', 50)
    const rules = readHillRules(store)
    expect(rules.count).toBe(12)
    expect(rules.spacing).toBe(40)
    expect(rules.height).toEqual({ value: 30, variation: 50, min: 1 })
    expect(rules.top).toEqual({ value: 8, variation: 100, min: 0 })
    expect(rules.runUp.length).toEqual({ value: 120, variation: 30, min: 5 })
    expect(rules.runDown.shoulder).toEqual({ value: 2.5, variation: 20, min: 1 })
  })
})
