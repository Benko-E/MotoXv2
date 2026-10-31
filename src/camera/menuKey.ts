import type { MenuWindow } from '../ui/window'

/** The key that shows and hides the debug menu (` , left of 1). */
const MENU_KEY = 'Backquote'

/** ` shows and hides the debug menu. Holding it down doesn't flicker. */
export function connectMenuKey(menu: MenuWindow, doc: Document): void {
  doc.addEventListener('keydown', (e) => {
    if (e.code !== MENU_KEY || e.repeat) return
    e.preventDefault() // don't type ` into a focused number box
    menu.toggle()
  })
}
