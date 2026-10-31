// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { Input, isTypingTarget } from '../../src/camera/input'

const key = (code: string, type = 'keydown') => new KeyboardEvent(type, { code, bubbles: true })

describe('Input', () => {
  it('tracks held keys', () => {
    const input = new Input(window)
    window.dispatchEvent(key('KeyW'))
    expect(input.isDown('KeyW')).toBe(true)
    window.dispatchEvent(key('KeyW', 'keyup'))
    expect(input.isDown('KeyW')).toBe(false)
  })

  it('ignores keys typed into a number box', () => {
    const input = new Input(window)
    const box = document.createElement('input')
    box.type = 'number'
    document.body.append(box)
    box.dispatchEvent(key('KeyW'))
    expect(input.isDown('KeyW')).toBe(false)
  })

  it('lets go of every key when the window loses focus', () => {
    const input = new Input(window)
    window.dispatchEvent(key('KeyW'))
    window.dispatchEvent(new Event('blur'))
    expect(input.isDown('KeyW')).toBe(false)
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
