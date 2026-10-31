import type { MenuWindow } from '../ui/window'

/**
 * Shares the mouse between the camera and the menu. Menu open: the mouse is
 * free. Menu closed: the mouse steers the camera (pointer lock).
 *
 * While the mouse is locked the browser keeps Esc for itself: it only lets go
 * of the mouse and never tells the page the key was pressed. So losing the
 * lock while the menu is closed counts as pressing Esc.
 */
export function connectMenuAndMouse(menu: MenuWindow, canvas: HTMLCanvasElement, doc: Document): void {
  const lock = () => {
    try {
      // Can be refused, e.g. straight after the browser itself let go of the
      // mouse, or when Esc closed the menu (Esc doesn't count as a user
      // action for locking). A click on the game then locks it.
      void canvas.requestPointerLock?.()?.catch(() => {})
    } catch {
      // older browsers throw instead of rejecting
    }
  }

  doc.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !e.repeat) menu.toggle() // held Esc repeats: ignore
  })

  menu.onOpenChange((open) => {
    if (open) {
      if (doc.pointerLockElement) doc.exitPointerLock?.()
    } else {
      lock()
    }
  })

  doc.addEventListener('pointerlockchange', () => {
    if (!doc.pointerLockElement && !menu.isOpen) menu.open()
  })

  canvas.addEventListener('click', () => {
    if (!menu.isOpen && !doc.pointerLockElement) lock()
  })
}
