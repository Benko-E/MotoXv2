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
    setTimeout(() => (copyButton.textContent = 'Copy changes'), 1500)
  })
  menu.addTitleButton('Reset all', () => store.resetAll())

  const tabSet = new Tabs(tabs)
  menu.add(tabSet)

  const sections = new Map<string, Section>()
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
    section.add(row)
    rows.set(s.id, row)
  }

  return { window: menu, tabs: tabSet, rows }
}
