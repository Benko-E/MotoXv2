// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { Tabs } from '../../src/ui/tabs'

function button(tabs: Tabs, name: string): HTMLButtonElement {
  const b = [...tabs.el.querySelectorAll<HTMLButtonElement>(':scope > .menu-tabbar > button')]
    .find((x) => x.textContent === name)
  if (!b) throw new Error(`no tab button ${name}`)
  return b
}

describe('Tabs', () => {
  it('shows the first page at the start', () => {
    const tabs = new Tabs(['MAP', 'RIDER'])
    expect(tabs.selected).toBe('MAP')
    expect(tabs.page('MAP').el.hidden).toBe(false)
    expect(tabs.page('RIDER').el.hidden).toBe(true)
  })

  it('clicking a tab shows its page and hides the others', () => {
    const tabs = new Tabs(['MAP', 'RIDER'])
    button(tabs, 'RIDER').click()
    expect(tabs.selected).toBe('RIDER')
    expect(tabs.page('RIDER').el.hidden).toBe(false)
    expect(tabs.page('MAP').el.hidden).toBe(true)
  })

  it('tabs inside a page work on their own', () => {
    const outer = new Tabs(['MAP', 'RIDER'])
    const inner = new Tabs(['Terrain', 'Track'])
    outer.page('MAP').add(inner)
    button(inner, 'Track').click()
    expect(inner.selected).toBe('Track')
    expect(outer.selected).toBe('MAP')
    expect(outer.page('MAP').el.contains(inner.el)).toBe(true)
  })
})
