/** True when keys pressed here are typing, not flying (text and number boxes). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color'].includes(target.type)
  }
  return false
}

/** The mouse button that looks around while held (2 = right, like editors). */
const LOOK_BUTTON = 2

/**
 * Which keys are held, and how far the mouse moved while looking around.
 * Looking = the right button pressed on the game (`lookSurface`) and held;
 * it works the same with the menu open or closed. The cursor stays visible.
 */
export class Input {
  private readonly keys = new Set<string>()
  private looking = false
  private dx = 0
  private dy = 0

  constructor(target: Window, lookSurface: HTMLElement) {
    target.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return
      this.keys.add(e.code)
      if (e.code === 'Space') e.preventDefault() // don't scroll the page
    })
    target.addEventListener('keyup', (e) => this.keys.delete(e.code))
    target.addEventListener('blur', () => {
      this.keys.clear()
      this.looking = false
    })

    lookSurface.addEventListener('mousedown', (e) => {
      if (e.button === LOOK_BUTTON) this.looking = true
    })
    // Let go anywhere, even over the menu or outside the window.
    target.addEventListener('mouseup', (e) => {
      if (e.button === LOOK_BUTTON) this.looking = false
    })
    target.addEventListener('mousemove', (e) => {
      if (!this.looking) return
      this.dx += e.movementX
      this.dy += e.movementY
    })
    // The browser's right-click menu would pop up when the button is let go.
    lookSurface.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  /** True while the right button is held after pressing it on the game. */
  get isLooking(): boolean {
    return this.looking
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  /** Mouse movement since the last call. */
  takeMouse(): { dx: number; dy: number } {
    const moved = { dx: this.dx, dy: this.dy }
    this.dx = 0
    this.dy = 0
    return moved
  }
}
