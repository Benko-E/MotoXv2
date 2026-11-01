import { describe, expect, it } from 'vitest'
import { SETTINGS, TABS } from '../../src/settings/list'
import { keyLabel } from '../../src/settings/keys'
import { SettingsStore } from '../../src/settings/store'
import { fakeStorage } from '../helpers/fakeStorage'

describe('key settings', () => {
  it('ride on WASD, Space and the arrows by default, on a CONTROLS tab', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(store.key('keyThrottle')).toBe('KeyW')
    expect(store.key('keyBrake')).toBe('KeyS')
    expect(store.key('keyLeft')).toBe('KeyA')
    expect(store.key('keyRight')).toBe('KeyD')
    expect(store.key('keyRearBrake')).toBe('Space')
    expect(store.key('keyRiderBack')).toBe('ArrowDown')
    expect(store.key('keyRiderForward')).toBe('ArrowUp')
    expect(store.key('keyCamera')).toBe('KeyC')
    expect(TABS).toContain('CONTROLS')
    expect(SETTINGS.filter((s) => s.kind === 'key').every((s) => s.tab === 'CONTROLS')).toBe(true)
  })

  it('rebind, notify, save, load and reset', () => {
    const storage = fakeStorage()
    const a = new SettingsStore(SETTINGS, storage)
    const heard: string[] = []
    a.onChange((id) => heard.push(id))
    a.setKey('keyThrottle', 'KeyI')
    expect(heard).toEqual(['keyThrottle'])
    expect(new SettingsStore(SETTINGS, storage).key('keyThrottle')).toBe('KeyI')
    a.resetAll()
    expect(a.key('keyThrottle')).toBe('KeyW')
  })

  it('mixing up kinds is an error', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    expect(() => store.key('mapSize')).toThrow()
    expect(() => store.get('keyThrottle')).toThrow()
  })

  it('name keys the way they read on the keyboard', () => {
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('Digit3')).toBe('3')
    expect(keyLabel('ArrowUp')).toBe('↑')
    expect(keyLabel('Space')).toBe('Space')
    expect(keyLabel('ShiftLeft')).toBe('Left Shift')
    expect(keyLabel('Numpad4')).toBe('Num 4')
  })
})
