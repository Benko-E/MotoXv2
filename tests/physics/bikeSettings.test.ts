import { describe, expect, it } from 'vitest'
import { DEFAULT_BIKE } from '../../src/physics/bike'
import { readBikeParams } from '../../src/physics/bikeSettings'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { fakeStorage } from '../helpers/fakeStorage'

describe('readBikeParams', () => {
  it('the BIKE tab defaults are the physics defaults, in newtons', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(readBikeParams(store)).toEqual(DEFAULT_BIKE)
  })

  it('turns kN into N', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.set('frontSpring', 12.5)
    expect(readBikeParams(store).frontSpring).toBe(12500)
  })
})
