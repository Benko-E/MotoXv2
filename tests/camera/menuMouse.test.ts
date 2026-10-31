// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { connectMenuAndMouse } from '../../src/camera/menuMouse'
import { MenuWindow } from '../../src/ui/window'

function setup() {
  const menu = new MenuWindow('Debug', null)
  const canvas = document.createElement('canvas')
  connectMenuAndMouse(menu, canvas, document)
  return menu
}

describe('connectMenuAndMouse', () => {
  it('Esc opens and closes the menu', () => {
    const menu = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    expect(menu.isOpen).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    expect(menu.isOpen).toBe(false)
  })

  it('holding Esc down does not flicker the menu', () => {
    const menu = setup()
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    for (let i = 0; i < 3; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', repeat: true }))
    }
    expect(menu.isOpen).toBe(true)
  })

  it('opens the menu when the browser drops the mouse (the swallowed Esc)', () => {
    const menu = setup()
    document.dispatchEvent(new Event('pointerlockchange'))
    expect(menu.isOpen).toBe(true)
  })
})
