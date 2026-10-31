import type { Setting } from './types'

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
]
