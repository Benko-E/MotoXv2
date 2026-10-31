import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { fakeStorage } from '../helpers/fakeStorage'

describe('SettingsStore', () => {
  it('starts at defaults', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(store.get('mapSize')).toBe(1000)
    expect(store.get('cellSize')).toBe(1)
    expect(store.debug('mapSize')).toBe(true)
    expect(store.debug('cellSize')).toBe(true)
  })

  it('set clamps and ignores NaN', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.set('mapSize', 99999)
    expect(store.get('mapSize')).toBe(4000)
    store.set('mapSize', -5)
    expect(store.get('mapSize')).toBe(100)
    store.set('mapSize', NaN)
    expect(store.get('mapSize')).toBe(100)
  })

  it('throws on an unknown id', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(() => store.get('nope')).toThrow()
  })

  it('listeners hear changes and can unsubscribe', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const heard: string[] = []
    const stop = store.onChange((id) => heard.push(id))
    store.set('cellSize', 2)
    store.setDebug('mapSize', false)
    expect(heard).toEqual(['cellSize', 'mapSize'])
    stop()
    store.set('cellSize', 3)
    expect(heard).toHaveLength(2)
  })

  it('saves and loads', () => {
    const storage = fakeStorage()
    const a = new SettingsStore(SETTINGS, storage)
    a.set('mapSize', 2500)
    a.setDebug('cellSize', false)
    const b = new SettingsStore(SETTINGS, storage)
    expect(b.get('mapSize')).toBe(2500)
    expect(b.debug('cellSize')).toBe(false)
  })

  it('broken saved data falls back to defaults', () => {
    const junk = new SettingsStore(SETTINGS, fakeStorage({ 'motox.settings': '{not json' }))
    expect(junk.get('mapSize')).toBe(1000)

    const odd = new SettingsStore(
      SETTINGS,
      fakeStorage({ 'motox.settings': '{"values":{"mapSize":999999,"ghost":3,"cellSize":"big"}}' }),
    )
    expect(odd.get('mapSize')).toBe(4000)
    expect(odd.get('cellSize')).toBe(1)
  })

  it('works without storage', () => {
    const store = new SettingsStore(SETTINGS, null)
    store.set('mapSize', 500)
    expect(store.get('mapSize')).toBe(500)
  })

  it('reset and resetAll go back to defaults and notify', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    store.set('mapSize', 2000)
    store.set('cellSize', 5)
    store.setDebug('cellSize', false)
    const heard: string[] = []
    store.onChange((id) => heard.push(id))
    store.reset('mapSize')
    expect(store.get('mapSize')).toBe(1000)
    expect(store.get('cellSize')).toBe(5)
    store.resetAll()
    expect(store.get('cellSize')).toBe(1)
    expect(store.debug('cellSize')).toBe(true)
    expect(heard).toContain('mapSize')
    expect(heard).toContain('cellSize')
  })
})
