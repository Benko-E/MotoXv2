// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { SETTINGS, TABS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import { buildMenu } from '../../src/ui/buildMenu'
import { fakeStorage } from '../helpers/fakeStorage'

describe('buildMenu', () => {
  const store = new SettingsStore(SETTINGS, fakeStorage())
  const { window: menu, rows, tabs } = buildMenu(SETTINGS, TABS, store, fakeStorage())

  it('has the five tabs in order', () => {
    const names = [...menu.el.querySelector('.menu-tabbar')!.children].map((b) => b.textContent)
    expect(names).toEqual(['MAP', 'RIDER', 'BIKE', 'CONTROLS', 'AI'])
  })

  it('puts View, Terrain, Noise, Detail and Features sections on the MAP page', () => {
    const page = tabs.page('MAP').el
    const titles = [...page.querySelectorAll('.menu-section-title')].map((t) => t.textContent)
    expect(titles).toEqual(['View', 'Terrain', 'Noise', 'Detail', 'Features'])
    expect(page.querySelectorAll('.menu-row')).toHaveLength(SETTINGS.filter((s) => s.tab === 'MAP').length)
    expect([...rows.keys()].slice(0, 4)).toEqual(['showGrid', 'gridSpacing', 'mapSize', 'cellSize'])
    expect(page.querySelectorAll('.menu-toggle')).toHaveLength(2)
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

  it('puts the bike settings on the BIKE page and the rider ones on RIDER', () => {
    expect(tabs.page('BIKE').el.contains(rows.get('frontSpring')!.el)).toBe(true)
    for (const id of ['barLock', 'turnAtSpeed', 'maxLean']) expect(tabs.page('BIKE').el.contains(rows.get(id)!.el)).toBe(true)
    expect(tabs.page('RIDER').el.contains(rows.get('riderReach')!.el)).toBe(true)
    expect(tabs.page('RIDER').el.contains(rows.get('canCrash')!.el)).toBe(true)
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

  it('closing the menu stops a key row waiting for a key', () => {
    const own = new SettingsStore(SETTINGS, fakeStorage())
    const built = buildMenu(SETTINGS, TABS, own, fakeStorage())
    built.window.open()
    built.rows.get('keyThrottle')!.el.querySelector<HTMLButtonElement>('.menu-key')!.click()
    built.window.close()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', bubbles: true, cancelable: true }))
    expect(own.key('keyThrottle')).toBe('KeyW')
  })

  it('a key used twice in the same mode gets a note on both rows; free-roam may share with riding', () => {
    const own = new SettingsStore(SETTINGS, fakeStorage())
    const built = buildMenu(SETTINGS, TABS, own, fakeStorage())
    const note = (id: string) => built.rows.get(id)!.el.querySelector<HTMLElement>('.menu-note')!
    expect(note('keyThrottle').hidden).toBe(true) // W also flies forward: different modes
    own.setKey('keyThrottle', 'KeyC')
    expect(note('keyThrottle').hidden).toBe(false)
    expect(note('keyThrottle').textContent).toContain('Switch camera')
    expect(note('keyCamera').textContent).toContain('Throttle')
    own.setKey('keyThrottle', 'KeyW')
    expect(note('keyThrottle').hidden).toBe(true)
    expect(note('keyCamera').hidden).toBe(true)
  })

  it('has a reset-all button that resets every setting', () => {
    store.set('mapSize', 2000)
    const btn = [...menu.el.querySelectorAll('button')].find((b) => b.textContent === 'Reset all')!
    btn.click()
    expect(store.get('mapSize')).toBe(1000)
  })
})
