import type { KeySetting, Setting, SliderSetting, ToggleSetting } from './types'

type Value = number | boolean | string
type Saved = { values: Record<string, Value>; debug: Record<string, boolean> }

/**
 * Holds every setting's current value and debug-lines flag. Tells listeners
 * the moment anything changes and saves to the browser so a reload keeps it.
 */
export class SettingsStore {
  private readonly byId = new Map<string, Setting>()
  private readonly values = new Map<string, Value>()
  private readonly debugs = new Map<string, boolean>()
  private readonly listeners = new Set<(id: string) => void>()

  constructor(
    list: Setting[],
    private readonly storage: Storage | null,
    private readonly storageKey = 'motox.settings',
  ) {
    for (const s of list) {
      this.byId.set(s.id, s)
      this.values.set(s.id, s.default)
      this.debugs.set(s.id, s.debugDefault)
    }
    this.load()
  }

  /** A slider's value. */
  get(id: string): number {
    this.slider(id)
    return this.values.get(id) as number
  }

  set(id: string, value: number): void {
    const s = this.slider(id)
    if (!Number.isFinite(value)) return
    this.values.set(id, clamp(s, value))
    this.changed(id)
  }

  /** An on/off setting's state. */
  isOn(id: string): boolean {
    this.toggle(id)
    return this.values.get(id) as boolean
  }

  setOn(id: string, on: boolean): void {
    this.toggle(id)
    this.values.set(id, on)
    this.changed(id)
  }

  /** The key bound to an action (a KeyboardEvent.code). */
  key(id: string): string {
    this.keySetting(id)
    return this.values.get(id) as string
  }

  setKey(id: string, code: string): void {
    this.keySetting(id)
    this.values.set(id, code)
    this.changed(id)
  }

  debug(id: string): boolean {
    this.setting(id)
    return this.debugs.get(id)!
  }

  setDebug(id: string, on: boolean): void {
    this.setting(id)
    this.debugs.set(id, on)
    this.changed(id)
  }

  reset(id: string): void {
    const s = this.setting(id)
    this.values.set(id, s.default)
    this.debugs.set(id, s.debugDefault)
    this.changed(id)
  }

  resetAll(): void {
    for (const id of this.byId.keys()) this.reset(id)
  }

  /** Every setting whose value differs from its default (debug flags left out). */
  changedFromDefaults(): Record<string, Value> {
    const changed: Record<string, Value> = {}
    for (const [id, s] of this.byId) {
      const v = this.values.get(id)!
      if (v !== s.default) changed[id] = v
    }
    return changed
  }

  /** Calls `fn` with the setting's id on every change. Returns an unsubscribe. */
  onChange(fn: (id: string) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setting(id: string): Setting {
    const s = this.byId.get(id)
    if (!s) throw new Error(`Unknown setting "${id}"`)
    return s
  }

  private slider(id: string): SliderSetting {
    const s = this.setting(id)
    if (s.kind !== 'slider') throw new Error(`"${id}" is not a slider`)
    return s
  }

  private toggle(id: string): ToggleSetting {
    const s = this.setting(id)
    if (s.kind !== 'toggle') throw new Error(`"${id}" is not an on/off setting`)
    return s
  }

  private keySetting(id: string): KeySetting {
    const s = this.setting(id)
    if (s.kind !== 'key') throw new Error(`"${id}" is not a key`)
    return s
  }

  private changed(id: string): void {
    this.save()
    for (const fn of this.listeners) fn(id)
  }

  private load(): void {
    let saved: Partial<Saved>
    try {
      saved = JSON.parse(this.storage?.getItem(this.storageKey) ?? '{}')
    } catch {
      return // broken data: keep the defaults
    }
    for (const [id, s] of this.byId) {
      const v = saved?.values?.[id]
      if (s.kind === 'slider' && typeof v === 'number' && Number.isFinite(v)) {
        this.values.set(id, clamp(s, v))
      }
      if (s.kind === 'toggle' && typeof v === 'boolean') this.values.set(id, v)
      if (s.kind === 'key' && typeof v === 'string' && v !== '') this.values.set(id, v)
      const d = saved?.debug?.[id]
      if (typeof d === 'boolean') this.debugs.set(id, d)
    }
  }

  private save(): void {
    const saved: Saved = {
      values: Object.fromEntries(this.values),
      debug: Object.fromEntries(this.debugs),
    }
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(saved))
    } catch {
      // storage full or blocked: settings still work for this visit
    }
  }
}

function clamp(s: SliderSetting, value: number): number {
  return Math.min(s.max, Math.max(s.min, value))
}
