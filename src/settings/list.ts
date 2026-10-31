import type { Setting, SliderSetting } from './types'

/** The menu's top tabs, left to right. */
export const TABS: readonly string[] = ['MAP', 'RIDER', 'BIKE', 'AI']

/**
 * Every setting in the game, described once. The menu builds its rows from
 * this list, in this order.
 */
export const SETTINGS: Setting[] = [
  {
    kind: 'slider',
    id: 'mapSize',
    name: 'Map size',
    tab: 'MAP',
    section: 'Terrain',
    min: 100,
    max: 4000,
    step: 50,
    default: 1000,
    unit: 'm',
    hasDebug: true,
    debugDefault: true,
  },
  {
    kind: 'slider',
    id: 'cellSize',
    name: 'Cell size',
    tab: 'MAP',
    section: 'Terrain',
    min: 0.25,
    max: 20,
    step: 0.25,
    default: 1,
    unit: 'm',
    hasDebug: true,
    debugDefault: true,
  },
  {
    kind: 'slider',
    id: 'detailDistance',
    name: 'Detail distance',
    tab: 'MAP',
    section: 'Detail',
    min: 25,
    max: 2000,
    step: 25,
    default: 150,
    unit: 'm',
    hasDebug: true,
    debugDefault: true,
  },
  {
    kind: 'toggle',
    id: 'wireframe',
    name: 'Wireframe',
    tab: 'MAP',
    section: 'Detail',
    default: false,
    hasDebug: false,
    debugDefault: false,
  },
  {
    kind: 'slider',
    id: 'seed',
    name: 'Seed',
    tab: 'MAP',
    section: 'Features',
    min: 0,
    max: 9999,
    step: 1,
    default: 1337,
    unit: '',
    hasDebug: false,
    debugDefault: false,
    reroll: true,
  },
  hillSetting('hillCount', 'Count', 0, 100, 1, 12, ''),
  hillSetting('hillSpacing', 'Spacing', 0, 500, 5, 40, 'm'),
  ...varied('hillHeight', 'Height', 1, 200, 1, 30, 'm', 40),
  ...varied('hillTop', 'Top size', 0, 100, 1, 8, 'm', 100),
  ...varied('runUpLength', 'Run-up length', 5, 1000, 5, 120, 'm', 30),
  ...varied('runUpFoot', 'Run-up foot', 1, 6, 0.1, 2.5, '', 20),
  ...varied('runUpShoulder', 'Run-up shoulder', 1, 6, 0.1, 1.5, '', 20),
  ...varied('runDownLength', 'Run-down length', 5, 1000, 5, 50, 'm', 30),
  ...varied('runDownFoot', 'Run-down foot', 1, 6, 0.1, 2, '', 20),
  ...varied('runDownShoulder', 'Run-down shoulder', 1, 6, 0.1, 2.5, '', 20),
]

/** A slider on the Features → Hill tab, debug lines on by default. */
function hillSetting(
  id: string,
  name: string,
  min: number,
  max: number,
  step: number,
  value: number,
  unit: string,
): SliderSetting {
  return { kind: 'slider', id, name, tab: 'MAP', section: 'Features', subtab: 'Hill', min, max, step, default: value, unit, hasDebug: true, debugDefault: true }
}

/** A hill setting plus its indented Variation row (id + 'Var', ± %). */
function varied(
  id: string,
  name: string,
  min: number,
  max: number,
  step: number,
  value: number,
  unit: string,
  variation: number,
): SliderSetting[] {
  return [
    hillSetting(id, name, min, max, step, value, unit),
    { ...hillSetting(`${id}Var`, 'Variation', 0, 100, 5, variation, '%'), hasDebug: false, debugDefault: false, indent: true },
  ]
}
