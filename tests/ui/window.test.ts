// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { clampToScreen, MenuWindow } from '../../src/ui/window'
import { fakeStorage } from '../helpers/fakeStorage'

describe('clampToScreen', () => {
  it('pulls a window dragged past the bottom-right back on screen', () => {
    const p = clampToScreen(5000, 5000, 380, 600, 1280, 720)
    expect(p.x).toBeLessThanOrEqual(1280 - 380)
    expect(p.y).toBeLessThanOrEqual(720 - 32)
  })

  it('pulls negative positions back to the edge', () => {
    expect(clampToScreen(-50, -10, 380, 600, 1280, 720)).toEqual({ x: 0, y: 0 })
  })

  it('keeps the title bar reachable when the screen is smaller than the window', () => {
    expect(clampToScreen(200, 500, 380, 600, 300, 400)).toEqual({ x: 0, y: 400 - 32 })
  })
})

describe('MenuWindow', () => {
  it('toggles open and tells listeners', () => {
    const w = new MenuWindow('Debug', fakeStorage())
    const heard: boolean[] = []
    w.onOpenChange((open) => heard.push(open))
    expect(w.isOpen).toBe(false)
    w.toggle()
    expect(w.isOpen).toBe(true)
    expect(w.el.hidden).toBe(false)
    w.toggle()
    expect(w.el.hidden).toBe(true)
    expect(heard).toEqual([true, false])
  })

  it('remembers where it was put', () => {
    const storage = fakeStorage()
    const a = new MenuWindow('Debug', storage)
    a.moveTo(120, 80)
    const b = new MenuWindow('Debug', storage)
    expect(b.el.style.left).toBe('120px')
    expect(b.el.style.top).toBe('80px')
  })
})
