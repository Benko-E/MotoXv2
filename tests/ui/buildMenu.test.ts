// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { SETTINGS, TABS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { buildMenu } from '../../src/ui/buildMenu'
import { fakeStorage } from '../helpers/fakeStorage'

describe('buildMenu', () => {
  const store = new SettingsStore(SETTINGS, fakeStorage())
  const { window: menu, rows, tabs } = buildMenu(SETTINGS, TABS, store, fakeStorage())

  it('has the four tabs in order', () => {
    const names = [...menu.el.querySelectorAll('.menu-tabbar > button')].map((b) => b.textContent)
    expect(names).toEqual(['MAP', 'RIDER', 'BIKE', 'AI'])
  })

  it('puts Terrain and Detail sections on the MAP page', () => {
    const page = tabs.page('MAP').el
    const titles = [...page.querySelectorAll('.menu-section-title')].map((t) => t.textContent)
    expect(titles).toEqual(['Terrain', 'Detail'])
    expect(page.querySelectorAll('.menu-row')).toHaveLength(4)
    expect([...rows.keys()]).toEqual(['mapSize', 'cellSize', 'detailDistance', 'wireframe'])
    expect(page.querySelectorAll('.menu-toggle')).toHaveLength(1)
  })

  it('leaves the other pages empty', () => {
    expect(tabs.page('RIDER').el.children).toHaveLength(0)
  })

  it('has a reset-all button that resets every setting', () => {
    store.set('mapSize', 2000)
    const btn = [...menu.el.querySelectorAll('button')].find((b) => b.textContent === 'Reset all')!
    btn.click()
    expect(store.get('mapSize')).toBe(1000)
  })
})
