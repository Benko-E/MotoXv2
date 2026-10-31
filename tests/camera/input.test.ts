// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { Input, isTypingTarget } from '../../src/camera/input'

const key = (code: string, type = 'keydown') => new KeyboardEvent(type, { code, bubbles: true })

/** The game canvas the mouse looks around on. */
function surface(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  document.body.append(canvas)
  return canvas
}

const mouse = (type: string, init: MouseEventInit) => new MouseEvent(type, { bubbles: true, ...init })

describe('Input', () => {
  it('tracks held keys', () => {
    const input = new Input(window, surface())
    window.dispatchEvent(key('KeyW'))
    expect(input.isDown('KeyW')).toBe(true)
    window.dispatchEvent(key('KeyW', 'keyup'))
    expect(input.isDown('KeyW')).toBe(false)
  })

  it('ignores keys typed into a number box', () => {
    const input = new Input(window, surface())
    const box = document.createElement('input')
    box.type = 'number'
    document.body.append(box)
    box.dispatchEvent(key('KeyW'))
    expect(input.isDown('KeyW')).toBe(false)
  })

  it('lets go of every key when the window loses focus', () => {
    const input = new Input(window, surface())
    window.dispatchEvent(key('KeyW'))
    window.dispatchEvent(new Event('blur'))
    expect(input.isDown('KeyW')).toBe(false)
  })
})

describe('Input mouse look (hold the right button on the game)', () => {
  it('counts mouse movement while the right button is held', () => {
    const canvas = surface()
    const input = new Input(window, canvas)
    canvas.dispatchEvent(mouse('mousedown', { button: 2 }))
    window.dispatchEvent(mouse('mousemove', { movementX: 5, movementY: -3 }))
    window.dispatchEvent(mouse('mousemove', { movementX: 2, movementY: 0 }))
    expect(input.isLooking).toBe(true)
    expect(input.takeMouse()).toEqual({ dx: 7, dy: -3 })
    expect(input.takeMouse()).toEqual({ dx: 0, dy: 0 })
  })

  it('ignores movement without the right button', () => {
    const canvas = surface()
    const input = new Input(window, canvas)
    canvas.dispatchEvent(mouse('mousedown', { button: 0 }))
    window.dispatchEvent(mouse('mousemove', { movementX: 5 }))
    expect(input.takeMouse()).toEqual({ dx: 0, dy: 0 })
  })

  it('a right press on the menu does not look around', () => {
    const input = new Input(window, surface())
    const menu = document.createElement('div')
    document.body.append(menu)
    menu.dispatchEvent(mouse('mousedown', { button: 2 }))
    window.dispatchEvent(mouse('mousemove', { movementX: 5 }))
    expect(input.takeMouse()).toEqual({ dx: 0, dy: 0 })
  })

  it('stops when the button is let go, even off the game', () => {
    const canvas = surface()
    const input = new Input(window, canvas)
    canvas.dispatchEvent(mouse('mousedown', { button: 2 }))
    window.dispatchEvent(mouse('mouseup', { button: 2 }))
    window.dispatchEvent(mouse('mousemove', { movementX: 5 }))
    expect(input.isLooking).toBe(false)
    expect(input.takeMouse()).toEqual({ dx: 0, dy: 0 })
  })

  it('stops when the window loses focus', () => {
    const canvas = surface()
    const input = new Input(window, canvas)
    canvas.dispatchEvent(mouse('mousedown', { button: 2 }))
    window.dispatchEvent(new Event('blur'))
    expect(input.isLooking).toBe(false)
  })

  it('no right-click menu pops up over the game', () => {
    const canvas = surface()
    new Input(window, canvas)
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    canvas.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })
})

describe('isTypingTarget', () => {
  const make = (type: string) => Object.assign(document.createElement('input'), { type })

  it('counts text and number boxes', () => {
    expect(isTypingTarget(make('number'))).toBe(true)
    expect(isTypingTarget(make('text'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
  })

  it('does not count checkboxes, sliders or the page', () => {
    expect(isTypingTarget(make('checkbox'))).toBe(false)
    expect(isTypingTarget(make('range'))).toBe(false)
    expect(isTypingTarget(document.body)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
