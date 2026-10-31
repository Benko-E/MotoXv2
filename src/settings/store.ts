import type { Setting } from './types'

type Saved = { values: Record<string, number>; debug: Record<string, boolean> }

/**
 * Holds every setting's current value and debug-lines flag. Tells listeners
 * the moment anything changes and saves to the browser so a reload keeps it.
 */
export class SettingsStore {
  private readonly byId = new Map<string, Setting>()
  private readonly values = new Map<string, number>()
  private readonly debugs = new Map<string, boolean>()
  private readonly listeners = new Set<(id: string) => void>()

  constructor(
    list: Setting[],
    private readonly storage: Storage | null,
    private readonly key = 'motox.settings',
  ) {
    for (const s of list) {
      this.byId.set(s.id, s)
      this.values.set(s.id, s.default)
      this.debugs.set(s.id, s.debugDefault)
    }
    this.load()
  }

  get(id: string): number {
    this.setting(id)
    return this.values.get(id)!
  }

  set(id: string, value: number): void {
    const s = this.setting(id)
    if (!Number.isFinite(value)) return
    this.values.set(id, Math.min(s.max, Math.max(s.min, value)))
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

  private changed(id: string): void {
    this.save()
    for (const fn of this.listeners) fn(id)
  }

  private load(): void {
    let saved: Partial<Saved>
    try {
      saved = JSON.parse(this.storage?.getItem(this.key) ?? '{}')
    } catch {
      return // broken data: keep the defaults
    }
    for (const [id, s] of this.byId) {
      const v = saved?.values?.[id]
      if (typeof v === 'number' && Number.isFinite(v)) {
        this.values.set(id, Math.min(s.max, Math.max(s.min, v)))
      }
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
      this.storage?.setItem(this.key, JSON.stringify(saved))
    } catch {
      // storage full or blocked: settings still work for this visit
    }
  }
}
