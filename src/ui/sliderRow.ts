import type { SettingsStore } from '../settings/store'
import type { SliderSetting } from '../settings/types'
import type { Row } from './page'

/**
 * One number setting: debug checkbox, name, slider, number box, reset button,
 * and an optional note underneath.
 */
export class SliderRow implements Row {
  readonly el = document.createElement('div')
  private readonly debug = document.createElement('input')
  private readonly range = document.createElement('input')
  private readonly box = document.createElement('input')
  private readonly note = document.createElement('div')

  constructor(
    private readonly setting: SliderSetting,
    private readonly store: SettingsStore,
  ) {
    const s = setting
    this.el.className = 'menu-row'

    this.debug.type = 'checkbox'
    this.debug.className = 'menu-debug'
    this.debug.title = 'Show debug lines'
    // Kept in the layout even without debug lines, so the columns line up.
    if (!s.hasDebug) this.debug.style.visibility = 'hidden'
    this.debug.addEventListener('change', () => store.setDebug(s.id, this.debug.checked))

    const name = document.createElement('span')
    name.className = 'menu-name'
    name.textContent = s.name

    for (const input of [this.range, this.box]) {
      input.min = String(s.min)
      input.max = String(s.max)
      input.step = String(s.step)
    }
    this.range.type = 'range'
    this.range.className = 'menu-range'
    this.range.addEventListener('input', () => store.set(s.id, Number(this.range.value)))

    this.box.type = 'number'
    this.box.className = 'menu-number'
    this.box.addEventListener('change', () => {
      store.set(s.id, parseFloat(this.box.value))
      this.refresh()
    })
    this.box.addEventListener('blur', () => this.refresh())
    this.box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.box.blur()
    })

    const unit = document.createElement('span')
    unit.className = 'menu-unit'
    unit.textContent = s.unit

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'menu-reset'
    reset.title = `Reset to ${s.default} ${s.unit}`
    reset.textContent = '↺'
    reset.addEventListener('click', () => store.reset(s.id))

    this.note.className = 'menu-note'
    this.note.hidden = true

    this.el.append(this.debug, name, this.range, this.box, unit, reset, this.note)
    store.onChange((id) => {
      if (id === s.id) this.refresh()
    })
    this.refresh()
  }

  setNote(text: string): void {
    this.note.textContent = text
    this.note.hidden = text === ''
  }

  /** Shows the store's value and debug flag. */
  private refresh(): void {
    const value = String(this.store.get(this.setting.id))
    this.range.value = value
    this.box.value = value
    this.debug.checked = this.store.debug(this.setting.id)
  }
}
