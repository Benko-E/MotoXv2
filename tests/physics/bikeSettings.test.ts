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

  it('turns the menu degrees and per cent into radians and shares', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.set('barLock', 60)
    store.set('turnAtSpeed', 120)
    expect(readBikeParams(store).barLock).toBeCloseTo(Math.PI / 3, 9)
    expect(readBikeParams(store).turnAtSpeed).toBeCloseTo(1.2, 9)
  })

  it('what the menu does not show stays at the physics default', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(SETTINGS.some((s) => s.id === 'frontSpring')).toBe(false)
    expect(readBikeParams(store).frontSpring).toBe(DEFAULT_BIKE.frontSpring)
    expect(readBikeParams(store).gears).toEqual(DEFAULT_BIKE.gears)
  })
})
