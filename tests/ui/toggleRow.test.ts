// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import type { ToggleSetting } from '../../src/settings/types'
import { ToggleRow } from '../../src/ui/toggleRow'
import { fakeStorage } from '../helpers/fakeStorage'

const wireframe = SETTINGS.find((s) => s.id === 'wireframe') as ToggleSetting

describe('ToggleRow', () => {
  it('clicking the switch turns the setting on and off', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new ToggleRow(wireframe, store)
    document.body.append(row.el)
    const sw = row.el.querySelector<HTMLInputElement>('.menu-toggle')!
    sw.click()
    expect(store.isOn('wireframe')).toBe(true)
    sw.click()
    expect(store.isOn('wireframe')).toBe(false)
  })

  it('follows changes made elsewhere', () => {
    const store = new SettingsStore(SETTINGS, fakeStorage())
    const row = new ToggleRow(wireframe, store)
    store.setOn('wireframe', true)
    expect(row.el.querySelector<HTMLInputElement>('.menu-toggle')!.checked).toBe(true)
  })

  it('shows its name and a note', () => {
    const row = new ToggleRow(wireframe, new SettingsStore(SETTINGS, fakeStorage()))
    expect(row.el.querySelector('.menu-name')!.textContent).toBe('Wireframe')
    row.setNote('hello')
    expect(row.el.querySelector('.menu-note')!.textContent).toBe('hello')
  })
})
