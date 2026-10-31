/** A number picked with a slider and a number box. */
export type SliderSetting = {
  kind: 'slider'
  id: string
  name: string
  tab: string
  section: string
  min: number
  max: number
  step: number
  default: number
  unit: string
  /** Whether the row gets a debug-lines checkbox. */
  hasDebug: boolean
  debugDefault: boolean
}

/** Every kind of setting. More kinds join this union as the menu grows. */
export type Setting = SliderSetting
