import type { SettingsStore } from '../settings/store'
import type { Setting } from '../settings/types'
import './menu.css'
import { Section } from './section'
import { SliderRow } from './sliderRow'
import { Tabs } from './tabs'
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
): { window: MenuWindow; tabs: Tabs; rows: Map<string, SliderRow> } {
  const menu = new MenuWindow('MotoX debug', storage)
  menu.addTitleButton('Reset all', () => store.resetAll())

  const tabSet = new Tabs(tabs)
  menu.add(tabSet)

  const sections = new Map<string, Section>()
  const rows = new Map<string, SliderRow>()
  for (const s of settings) {
    const key = `${s.tab}/${s.section}`
    let section = sections.get(key)
    if (!section) {
      section = new Section(s.section)
      tabSet.page(s.tab).add(section)
      sections.set(key, section)
    }
    const row = new SliderRow(s, store)
    section.add(row)
    rows.set(s.id, row)
  }

  return { window: menu, tabs: tabSet, rows }
}
