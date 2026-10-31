import * as THREE from 'three'
import { FlyCamera } from './camera/flyCamera'
import { Input } from './camera/input'
import { connectMenuKey } from './camera/menuKey'
import { EdgeOutline } from './render/edgeOutline'
import { TerrainView } from './render/terrainView'
import { SETTINGS, TABS } from './settings/list'
import { SettingsStore } from './settings/store'
import { buildMenu } from './ui/buildMenu'
import { makeGround } from './world/ground'

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
const rows = menu.rows

/** Size and cell size the current ground was built with. */
let built = { mapSize: NaN, cellSize: NaN }

/**
 * Rebuilds the ground if map size or cell size changed. Called once per
 * frame, so dragging a slider rebuilds at most once a frame, not per tick.
 */
function rebuildIfChanged(): void {
  const mapSize = store.get('mapSize')
  const cellSize = store.get('cellSize')
  if (mapSize === built.mapSize && cellSize === built.cellSize) return
  built = { mapSize, cellSize }

  const ground = makeGround(mapSize, cellSize)
  terrain.update(ground)
  outline.update(ground.size)

  const real = `real size ${ground.size.toLocaleString('en-US')} m · ${ground.cells.toLocaleString('en-US')} cells`
  const limit = ground.limited
    ? `limited to ${Math.round(ground.cellSize * 100) / 100} m at this map size · `
    : ''
  rows.get('mapSize')?.setNote(real)
  rows.get('cellSize')?.setNote(limit + real)
}

/** Applies everything that doesn't need a rebuild (debug views, detail). */
function applyViews(): void {
  outline.visible = store.debug('mapSize')
  terrain.setShowGrid(store.debug('cellSize'))
  terrain.setDetailDistance(store.get('detailDistance'))
  terrain.setDebug(store.debug('detailDistance'))
  terrain.setWireframe(store.isOn('wireframe'))
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
  fly.update(dt, input, input.isLooking)
  terrain.updateLod(camera.position)
  renderer.render(scene, camera)
  updateDetailNote(dt)
})
