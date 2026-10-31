import type { SettingsStore } from '../settings/store'
import type { ToggleSetting } from '../settings/types'
import type { Row } from './page'

/** One on/off setting: (empty debug column), name, switch, note. */
export class ToggleRow implements Row {
  readonly el = document.createElement('div')
  private readonly toggle = document.createElement('input')
  private readonly note = document.createElement('div')

  constructor(setting: ToggleSetting, store: SettingsStore) {
    const s = setting
    this.el.className = 'menu-row'

    const spacer = document.createElement('span') // lines up with the debug checkboxes
    const name = document.createElement('span')
    name.className = 'menu-name'
    name.textContent = s.name

    this.toggle.type = 'checkbox'
    this.toggle.className = 'menu-toggle'
    this.toggle.addEventListener('change', () => store.setOn(s.id, this.toggle.checked))

    this.note.className = 'menu-note'
    this.note.hidden = true

    this.el.append(spacer, name, this.toggle, this.note)
    const refresh = () => {
      this.toggle.checked = store.isOn(s.id)
    }
    store.onChange((id) => {
      if (id === s.id) refresh()
    })
    refresh()
  }

  setNote(text: string): void {
    this.note.textContent = text
    this.note.hidden = text === ''
  }
}
