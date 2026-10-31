import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { fakeStorage } from '../helpers/fakeStorage'

describe('on/off settings', () => {
  it('start at their default', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(store.isOn('wireframe')).toBe(false)
  })

  it('switch, notify, save and load', () => {
    const storage = fakeStorage()
    const a = new SettingsStore(SETTINGS, storage)
    const heard: string[] = []
    a.onChange((id) => heard.push(id))
    a.setOn('wireframe', true)
    expect(a.isOn('wireframe')).toBe(true)
    expect(heard).toEqual(['wireframe'])
    expect(new SettingsStore(SETTINGS, storage).isOn('wireframe')).toBe(true)
  })

  it('reset goes back to the default', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.setOn('wireframe', true)
    store.resetAll()
    expect(store.isOn('wireframe')).toBe(false)
  })

  it('mixing up kinds is an error', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(() => store.get('wireframe')).toThrow()
    expect(() => store.isOn('mapSize')).toThrow()
  })

  it('saved data from step 1 loads, new settings get defaults', () => {
    const old = '{"values":{"mapSize":2000,"cellSize":1},"debug":{"mapSize":false,"cellSize":true}}'
    const store = new SettingsStore(SETTINGS, fakeStorage({ 'motox.settings': old }))
    expect(store.get('mapSize')).toBe(2000)
    expect(store.get('detailDistance')).toBe(150)
    expect(store.debug('detailDistance')).toBe(true)
    expect(store.isOn('wireframe')).toBe(false)
  })

  it('a saved value of the wrong kind is ignored', () => {
    const odd = '{"values":{"wireframe":5,"mapSize":true}}'
    const store = new SettingsStore(SETTINGS, fakeStorage({ 'motox.settings': odd }))
    expect(store.isOn('wireframe')).toBe(false)
    expect(store.get('mapSize')).toBe(1000)
  })
})
