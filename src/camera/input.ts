/** True when keys pressed here are typing, not flying (text and number boxes). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'color'].includes(target.type)
  }
  return false
}

/** Which keys are held, and how far the mouse moved while it steers the camera. */
export class Input {
  private readonly keys = new Set<string>()
  private dx = 0
  private dy = 0

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return
      this.keys.add(e.code)
      if (e.code === 'Space') e.preventDefault() // don't scroll the page
    })
    target.addEventListener('keyup', (e) => this.keys.delete(e.code))
    target.addEventListener('blur', () => this.keys.clear())
    target.addEventListener('mousemove', (e) => {
      if (!target.document.pointerLockElement) return
      this.dx += e.movementX
      this.dy += e.movementY
    })
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
