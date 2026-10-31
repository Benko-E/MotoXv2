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
    const names = [...menu.el.querySelector('.menu-tabbar')!.children].map((b) => b.textContent)
    expect(names).toEqual(['MAP', 'RIDER', 'BIKE', 'AI'])
  })

  it('puts Terrain, Detail and Features sections on the MAP page', () => {
    const page = tabs.page('MAP').el
    const titles = [...page.querySelectorAll('.menu-section-title')].map((t) => t.textContent)
    expect(titles).toEqual(['Terrain', 'Detail', 'Features'])
    expect(page.querySelectorAll('.menu-row')).toHaveLength(SETTINGS.length)
    expect([...rows.keys()].slice(0, 4)).toEqual(['mapSize', 'cellSize', 'detailDistance', 'wireframe'])
    expect(page.querySelectorAll('.menu-toggle')).toHaveLength(1)
  })

  it('Features has the seed above a row of feature tabs holding Hill', () => {
    const features = [...tabs.page('MAP').el.querySelectorAll('.menu-section')].find(
      (s) => s.querySelector('.menu-section-title')!.textContent === 'Features',
    )!
    const body = features.querySelector('.menu-section-body')!
    expect(body.firstElementChild!.querySelector('.menu-name')!.textContent).toContain('Seed')
    const inner = body.querySelector('.menu-tabs')!
    expect([...inner.querySelectorAll('.menu-tabbar > button')].map((b) => b.textContent)).toEqual(['Hill'])
    expect(inner.contains(rows.get('hillCount')!.el)).toBe(true)
  })

  it('variation rows are indented and have no debug checkbox', () => {
    const row = rows.get('hillHeightVar')!.el
    expect(row.classList.contains('menu-indent')).toBe(true)
    expect((row.querySelector('.menu-debug') as HTMLElement).style.visibility).toBe('hidden')
  })

  it('the dice button picks a new seed', () => {
    const own = new SettingsStore(SETTINGS, fakeStorage())
    const built = buildMenu(SETTINGS, TABS, own, fakeStorage())
    const dice = built.rows.get('seed')!.el.querySelector('.menu-reroll') as HTMLButtonElement
    const seen = new Set<number>()
    for (let i = 0; i < 5; i++) {
      dice.click()
      seen.add(own.get('seed'))
    }
    expect(seen.size).toBeGreaterThan(1)
    for (const s of seen) expect(Number.isInteger(s)).toBe(true)
  })

  it('leaves the other pages empty', () => {
    expect(tabs.page('RIDER').el.children).toHaveLength(0)
  })

  it('Copy changes sits left of Reset all and copies only changed settings', async () => {
    const copied: string[] = []
    const own = new SettingsStore(SETTINGS, fakeStorage())
    const built = buildMenu(SETTINGS, TABS, own, fakeStorage(), async (text) => {
      copied.push(text)
    })
    const buttons = [...built.window.el.querySelectorAll('.menu-titlebuttons button')]
    expect(buttons.map((b) => b.textContent)).toEqual(['Copy changes', 'Reset all'])
    own.set('mapSize', 2500)
    ;(buttons[0] as HTMLButtonElement).click()
    await Promise.resolve()
    await Promise.resolve()
    expect(JSON.parse(copied[0])).toEqual({ mapSize: 2500 })
    expect(buttons[0].textContent).toBe('Copied 1')
  })

  it('has a reset-all button that resets every setting', () => {
    store.set('mapSize', 2000)
    const btn = [...menu.el.querySelectorAll('button')].find((b) => b.textContent === 'Reset all')!
    btn.click()
    expect(store.get('mapSize')).toBe(1000)
  })
})
