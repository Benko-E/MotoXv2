// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { SETTINGS } from '../../src/settings/list'
import { SettingsStore } from '../../src/settings/store'
import type { SliderSetting } from '../../src/settings/types'
import { SliderRow } from '../../src/ui/sliderRow'
import { fakeStorage } from '../helpers/fakeStorage'

const mapSize = SETTINGS.find((s) => s.id === 'mapSize') as SliderSetting

describe('SliderRow', () => {
  let store: SettingsStore
  let row: SliderRow
  const q = <T extends HTMLElement>(sel: string) => row.el.querySelector<T>(sel)!

  beforeEach(() => {
    store = new SettingsStore(SETTINGS, fakeStorage())
    row = new SliderRow(mapSize, store)
  })

  it('lays out checkbox, name, slider, number box in that order', () => {
    const kids = [...row.el.querySelectorAll('.menu-debug, .menu-name, .menu-range, .menu-number')]
    expect(kids.map((k) => k.className)).toEqual(['menu-debug', 'menu-name', 'menu-range', 'menu-number'])
    expect(q('.menu-name').textContent).toBe('Map size')
  })

  it('dragging the slider sets the value live', () => {
    const range = q<HTMLInputElement>('.menu-range')
    range.value = '2000'
    range.dispatchEvent(new Event('input'))
    expect(store.get('mapSize')).toBe(2000)
    expect(q<HTMLInputElement>('.menu-number').value).toBe('2000')
  })

  it('typed nonsense reverts on blur', () => {
    const box = q<HTMLInputElement>('.menu-number')
    box.value = 'abc'
    box.dispatchEvent(new Event('change'))
    box.dispatchEvent(new Event('blur'))
    expect(store.get('mapSize')).toBe(1000)
    expect(box.value).toBe('1000')
  })

  it('a typed value past the max clamps', () => {
    const box = q<HTMLInputElement>('.menu-number')
    box.value = '99999'
    box.dispatchEvent(new Event('change'))
    expect(store.get('mapSize')).toBe(4000)
    expect(box.value).toBe('4000')
  })

  it('the checkbox flips debug lines', () => {
    document.body.append(row.el)
    q<HTMLInputElement>('.menu-debug').click()
    expect(store.debug('mapSize')).toBe(false)
  })

  it('follows changes made elsewhere', () => {
    store.set('mapSize', 750)
    expect(q<HTMLInputElement>('.menu-range').value).toBe('750')
    expect(q<HTMLInputElement>('.menu-number').value).toBe('750')
    store.setDebug('mapSize', false)
    expect(q<HTMLInputElement>('.menu-debug').checked).toBe(false)
  })

  it('the reset button goes back to the default', () => {
    store.set('mapSize', 3000)
    q<HTMLButtonElement>('.menu-reset').click()
    expect(store.get('mapSize')).toBe(1000)
  })

  it('shows a note', () => {
    row.setNote('real size 1,002 m')
    expect(q('.menu-note').textContent).toBe('real size 1,002 m')
  })
})
