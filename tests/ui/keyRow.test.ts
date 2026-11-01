// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import type { KeySetting } from '../../src/settings/types'
import { KeyRow } from '../../src/ui/keyRow'
import { fakeStorage } from '../helpers/fakeStorage'

const throttle = SETTINGS.find((s) => s.id === 'keyThrottle') as KeySetting

function press(code: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true })
  window.dispatchEvent(e)
  return e
}

describe('KeyRow', () => {
  it('shows the key, and click then a key press rebinds it', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new KeyRow(throttle, store, window)
    document.body.append(row.el)
    const button = row.el.querySelector<HTMLButtonElement>('.menu-key')!
    expect(button.textContent).toBe('W')
    button.click()
    expect(button.textContent).toBe('press a key…')
    let reached = false
    const later = () => (reached = true)
    window.addEventListener('keydown', later)
    press('KeyI')
    window.removeEventListener('keydown', later)
    expect(store.key('keyThrottle')).toBe('KeyI')
    expect(button.textContent).toBe('I')
    expect(reached).toBe(false) // the game never sees the key that was bound
  })

  it('Escape cancels', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new KeyRow(throttle, store, window)
    const button = row.el.querySelector<HTMLButtonElement>('.menu-key')!
    button.click()
    press('Escape')
    expect(store.key('keyThrottle')).toBe('KeyW')
    expect(button.textContent).toBe('W')
    press('KeyJ') // no longer listening
    expect(store.key('keyThrottle')).toBe('KeyW')
  })

  it('clicking a second row stops the first listening', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const brakes = SETTINGS.find((s) => s.id === 'keyBrake') as KeySetting
    const first = new KeyRow(throttle, store, window)
    const second = new KeyRow(brakes, store, window)
    first.el.querySelector<HTMLButtonElement>('.menu-key')!.click()
    second.el.querySelector<HTMLButtonElement>('.menu-key')!.click()
    expect(first.el.querySelector('.menu-key')!.textContent).toBe('W')
    press('KeyK')
    expect(store.key('keyBrake')).toBe('KeyK')
    expect(store.key('keyThrottle')).toBe('KeyW')
    press('KeyL') // nobody listening any more
    expect(store.key('keyThrottle')).toBe('KeyW')
  })

  it('leaving the window or closing the menu stops listening', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new KeyRow(throttle, store, window)
    const button = row.el.querySelector<HTMLButtonElement>('.menu-key')!
    button.click()
    window.dispatchEvent(new Event('blur'))
    expect(button.textContent).toBe('W')
    press('KeyJ')
    expect(store.key('keyThrottle')).toBe('KeyW')
    button.click()
    row.cancel()
    press('KeyJ')
    expect(store.key('keyThrottle')).toBe('KeyW')
  })

  it('the menu key (`) is never bound: it cancels and still reaches the menu', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new KeyRow(throttle, store, window)
    row.el.querySelector<HTMLButtonElement>('.menu-key')!.click()
    const e = press('Backquote')
    expect(store.key('keyThrottle')).toBe('KeyW')
    expect(e.defaultPrevented).toBe(false)
  })

  it('follows changes made elsewhere', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new KeyRow(throttle, store, window)
    store.setKey('keyThrottle', 'ArrowUp')
    expect(row.el.querySelector('.menu-key')!.textContent).toBe('↑')
  })
})
