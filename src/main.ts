import * as THREE from 'three'
import { FlyCamera } from './camera/flyCamera'
import { Input } from './camera/input'
import { connectMenuKey } from './camera/menuKey'
import { EdgeOutline } from './render/edgeOutline'
import { HillDebug, HillFieldDebug, type HillPart } from './render/hillDebug'
import { TerrainView } from './render/terrainView'
import { SETTINGS, TABS } from './settings/list'
import { SettingsStore } from './settings/store'
import { buildMenu } from './ui/buildMenu'
import { cellSizeUsed, type Ground, makeGround } from './world/ground'
import { addHill, flattenArea, type HillShape, hillBounds } from './world/hill'
import { placeHills } from './world/hills'
import { readHillRules } from './world/hillSettings'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const ui = document.querySelector<HTMLDivElement>('#ui')!

/** localStorage, or nothing when the browser blocks it. */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#9ec9e8')

const sun = new THREE.DirectionalLight('#ffffff', 2)
sun.position.set(300, 500, 200)
scene.add(sun, new THREE.HemisphereLight('#cfe6ff', '#5a6040', 1))

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20000)

// Settings and menu
const storage = browserStorage()
const store = new SettingsStore(SETTINGS, storage)
const menu = buildMenu(SETTINGS, TABS, store, storage)
ui.append(menu.window.el)

// The map
const terrain = new TerrainView(scene)
const outline = new EdgeOutline(scene)
const hillDebug = new HillDebug(scene)
const hillField = new HillFieldDebug(scene)
const rows = menu.rows

/** Size and cell size the current ground was built with. */
let built = { mapSize: NaN, cellSize: NaN }
let ground: Ground | null = null
let hills: HillShape[] = []
/** The rules and seed the current hills were placed with. */
let hillsKey = ''
/** The hill the full debug drawing is on (nearest the camera). */
let inspected: HillShape | null = null

function currentHillsKey(): string {
  return JSON.stringify([readHillRules(store), Math.round(store.get('seed'))])
}

/** Places the hills for the current settings and bakes them into the ground. */
function bakeHills(g: Ground): void {
  hills = placeHills(readHillRules(store), g.size, Math.round(store.get('seed')))
  hillsKey = currentHillsKey()
  for (const h of hills) addHill(g, h)
  hillField.update(hills, store.get('hillSpacing'))
  inspected = null
  hillDebug.clear() // redrawn on the nearest hill next frame, if any is left
  rows.get('hillCount')?.setNote(`placed ${hills.length} of ${store.get('hillCount')}`)
}

/**
 * Re-places the hills if any hill setting or the seed changed (at most once
 * a frame). Only the old and new footprints are recalculated and redrawn.
 */
function rebakeHillsIfChanged(): void {
  if (!ground || currentHillsKey() === hillsKey) return
  const old = hills.map(hillBounds)
  for (const area of old) flattenArea(ground, area)
  bakeHills(ground)
  terrain.heightsChanged([...old, ...hills.map(hillBounds)])
}

/** Moves the full debug drawing to the hill nearest the camera. */
function inspectNearestHill(eye: THREE.Vector3): void {
  let nearest: HillShape | null = null
  let best = Infinity
  for (const h of hills) {
    const d = Math.hypot(h.x - eye.x, h.z - eye.z)
    if (d < best) {
      best = d
      nearest = h
    }
  }
  if (nearest === inspected) return
  inspected = nearest
  if (nearest) hillDebug.update(nearest)
  else hillDebug.clear()
}

/**
 * Rebuilds the ground if map size or cell size changed. Called once per
 * frame, so dragging a slider rebuilds at most once a frame, not per tick.
 */
function rebuildIfChanged(): void {
  const mapSize = store.get('mapSize')
  const asked = store.get('cellSize')
  // Compare the size actually used: on a limited map, dragging cell size
  // below the limit would otherwise rebuild the same ground every tick.
  const cellSize = cellSizeUsed(mapSize, asked)
  if (mapSize === built.mapSize && cellSize === built.cellSize) return
  built = { mapSize, cellSize }

  ground = makeGround(mapSize, asked)
  bakeHills(ground)
  terrain.update(ground)
  outline.update(ground.size)

  const real = `real size ${ground.size.toLocaleString('en-US')} m · ${ground.cells.toLocaleString('en-US')} cells`
  const limit = ground.limited
    ? `limited to ${Math.round(ground.cellSize * 100) / 100} m at this map size · `
    : ''
  rows.get('mapSize')?.setNote(real)
  rows.get('cellSize')?.setNote(limit + real)
}

/** Which part of the hill drawing each hill setting's debug checkbox shows. */
const HILL_PARTS: [HillPart, string[]][] = [
  ['position', ['hillCount']],
  ['facing', ['hillCount']],
  ['height', ['hillHeight']],
  ['top', ['hillTop']],
  ['runUp', ['runUpLength', 'runUpFoot', 'runUpShoulder']],
  ['runDown', ['runDownLength', 'runDownFoot', 'runDownShoulder']],
]

/** Applies everything that doesn't need a rebuild (debug views, detail). */
function applyViews(): void {
  outline.visible = store.debug('mapSize')
  terrain.setShowGrid(store.debug('cellSize'))
  terrain.setDetailDistance(store.get('detailDistance'))
  terrain.setDebug(store.debug('detailDistance'))
  terrain.setWireframe(store.isOn('wireframe'))
  for (const [part, ids] of HILL_PARTS) hillDebug.setVisible(part, ids.some((id) => store.debug(id)))
  hillField.setVisible(store.debug('hillCount'), store.debug('hillSpacing'))
}
store.onChange(applyViews)
applyViews()

// Camera and controls
const input = new Input(window, canvas)
const fly = new FlyCamera(camera)
fly.placeOverCorner(store.get('mapSize'))
connectMenuKey(menu.window, document)

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  outline.setResolution(window.innerWidth, window.innerHeight)
  hillDebug.setResolution(window.innerWidth, window.innerHeight)
  hillField.setResolution(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', resize)
resize()

/** Live LoD counts in the Detail distance note, twice a second. */
let sinceNote = Infinity
function updateDetailNote(dt: number): void {
  sinceNote += dt
  if (sinceNote < 0.5) return
  sinceNote = 0
  // Counted by the terrain itself: the renderer stops counting triangles
  // in wireframe mode.
  const triangles = terrain.triangleCount.toLocaleString('en-US')
  rows.get('detailDistance')?.setNote(`chunks: ${terrain.chunkCount.toLocaleString('en-US')} · ground triangles: ${triangles}`)
}

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // no huge jump after a stall
  rebuildIfChanged()
  rebakeHillsIfChanged()
  fly.update(dt, input, input.isLooking)
  inspectNearestHill(camera.position)
  terrain.updateLod(camera.position)
  renderer.render(scene, camera)
  updateDetailNote(dt)
})
