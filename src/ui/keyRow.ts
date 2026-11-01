import { keyLabel } from '../settings/keys'
import type { SettingsStore } from '../settings/store'
import type { KeySetting } from '../settings/types'
import type { Row } from './page'

/** The key that opens the menu: never bound, it still works while listening. */
const MENU_KEY = 'Backquote'
/** Only one row listens at a time. */
let listeningRow: KeyRow | null = null

/**
 * One rebindable key: (empty debug column), action, key button, note.
 * Click the button, then press the new key (Escape, ` , leaving the window
 * or clicking another key cancels). The key that gets bound never reaches
 * the game.
 */
export class KeyRow implements Row {
  readonly el = document.createElement('div')
  private readonly button = document.createElement('button')
  private readonly note = document.createElement('div')
  private listening = false
  private readonly refresh: () => void

  constructor(setting: KeySetting, store: SettingsStore, keys: Window) {
    const s = setting
    this.el.className = 'menu-row'

    const spacer = document.createElement('span') // lines up with the debug checkboxes
    const name = document.createElement('span')
    name.className = 'menu-name'
    name.textContent = s.name

    this.button.type = 'button'
    this.button.className = 'menu-key'
    this.button.addEventListener('click', () => {
      listeningRow?.cancel()
      listeningRow = this
      this.listening = true
      this.button.textContent = 'press a key…'
    })

    // Capture on the window: first in line, so it can keep the key from the game.
    keys.addEventListener(
      'keydown',
      (e) => {
        if (!this.listening) return
        if (e.code === MENU_KEY) {
          this.cancel()
          return
        }
        e.preventDefault()
        e.stopImmediatePropagation()
        this.stopListening()
        if (e.code === 'Escape') this.refresh()
        else store.setKey(s.id, e.code)
      },
      { capture: true },
    )
    keys.addEventListener('blur', () => this.cancel())

    this.note.className = 'menu-note'
    this.note.hidden = true

    this.el.append(spacer, name, this.button, this.note)
    this.refresh = () => {
      this.button.textContent = keyLabel(store.key(s.id))
    }
    store.onChange((id) => {
      if (id === s.id) this.refresh()
    })
    this.refresh()
  }

  /** Stops waiting for a key, keeping the old one. */
  cancel(): void {
    if (!this.listening) return
    this.stopListening()
    this.refresh()
  }

  private stopListening(): void {
    this.listening = false
    if (listeningRow === this) listeningRow = null
  }

  setNote(text: string): void {
    this.note.textContent = text
    this.note.hidden = text === ''
  }
}
