import type { SettingsStore } from '../settings/store'
import type { Setting } from '../settings/types'
import './menu.css'
import { copyText } from './clipboard'
import { Section } from './section'
import type { Row } from './page'
import { SliderRow } from './sliderRow'
import { Tabs } from './tabs'
import { ToggleRow } from './toggleRow'
import { MenuWindow } from './window'

/**
 * Builds the debug menu from the settings list: one tab per name in `tabs`,
 * one section per distinct section name within a tab, rows in list order.
 */
export function buildMenu(
  settings: Setting[],
  tabs: readonly string[],
  store: SettingsStore,
  storage: Storage | null,
  copy: (text: string) => Promise<void> = copyText,
): { window: MenuWindow; tabs: Tabs; rows: Map<string, Row> } {
  const menu = new MenuWindow('MotoX debug', storage)

  // Copies the settings changed from their defaults, to paste back to Claude.
  let restoreLabel: ReturnType<typeof setTimeout> | undefined
  const copyButton = menu.addTitleButton('Copy changes', async () => {
    const changed = store.changedFromDefaults()
    const count = Object.keys(changed).length
    let label = count === 0 ? 'No changes' : `Copied ${count}`
    try {
      await copy(JSON.stringify(changed, null, 2))
    } catch {
      label = 'Copy failed'
    }
    copyButton.textContent = label
    clearTimeout(restoreLabel) // a quick second click keeps its own label up
    restoreLabel = setTimeout(() => (copyButton.textContent = 'Copy changes'), 1500)
  })
  menu.addTitleButton('Reset all', () => store.resetAll())

  const tabSet = new Tabs(tabs)
  menu.add(tabSet)

  const sections = new Map<string, Section>()
  const subtabs = new Map<string, Tabs>()
  const rows = new Map<string, Row>()
  for (const s of settings) {
    const key = `${s.tab}/${s.section}`
    let section = sections.get(key)
    if (!section) {
      section = new Section(s.section)
      tabSet.page(s.tab).add(section)
      sections.set(key, section)
    }
    const row = s.kind === 'slider' ? new SliderRow(s, store) : new ToggleRow(s, store)
    const subtab = s.kind === 'slider' ? s.subtab : undefined
    if (subtab) {
      // One row of tabs per section, made from the subtab names in list order.
      let inner = subtabs.get(key)
      if (!inner) {
        const names = settings.flatMap((o) =>
          o.kind === 'slider' && o.subtab && `${o.tab}/${o.section}` === key ? [o.subtab] : [],
        )
        inner = new Tabs([...new Set(names)])
        section.add(inner)
        subtabs.set(key, inner)
      }
      inner.page(subtab).add(row)
    } else {
      section.add(row)
    }
    rows.set(s.id, row)
  }

  return { window: menu, tabs: tabSet, rows }
}
