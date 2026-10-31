// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { connectMenuKey } from '../../src/camera/menuKey'
import { MenuWindow } from '../../src/ui/window'

const press = (code: string, repeat = false) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { code, repeat }))

function setup() {
  const menu = new MenuWindow('Debug', null)
  connectMenuKey(menu, document)
  return menu
}

describe('connectMenuKey', () => {
  it('` opens and closes the menu', () => {
    const menu = setup()
    press('Backquote')
    expect(menu.isOpen).toBe(true)
    press('Backquote')
    expect(menu.isOpen).toBe(false)
  })

  it('holding ` down does not flicker the menu', () => {
    const menu = setup()
    press('Backquote')
    press('Backquote', true)
    press('Backquote', true)
    expect(menu.isOpen).toBe(true)
  })

  it('Esc does nothing', () => {
    const menu = setup()
    press('Escape')
    expect(menu.isOpen).toBe(false)
  })
})
