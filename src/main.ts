import * as THREE from 'three'
import { FlyCamera } from './camera/flyCamera'
import { Input, isTypingTarget } from './camera/input'
import { connectMenuKey } from './camera/menuKey'
import { EdgeOutline } from './render/edgeOutline'
import { HillDebug, HillFieldDebug, type HillPart } from './render/hillDebug'
import { BikeView } from './render/bikeView'
import { Bike } from './physics/bike'
import { readBikeParams } from './physics/bikeSettings'
import { FixedClock } from './physics/clock'
import { TerrainView } from './render/terrainView'
import { SETTINGS, TABS } from './settings/list'
import { SettingsStore } from './settings/store'
import { buildMenu } from './ui/buildMenu'
import { cellSizeUsed, type Ground, makeGround } from './world/ground'
import type { Area, HillShape } from './world/hill'
import { placeHills } from './world/hills'
import { readHillRules } from './world/hillSettings'
import { bakeArea, calmBounds, makeNoiseField, type NoiseField, type NoiseRules } from './world/terrain'

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
const bike = new Bike(readBikeParams(store))
const bikeView = new BikeView(scene)
const physicsClock = new FixedClock(1 / 500)
/** The map the bike was dropped on; a new map drops it again. */
let bikeGround: Ground | null = null

/** Runs the bike's physics for this frame's time, then draws it. */
function moveBike(dt: number): void {
  if (!ground) return
  const g = ground
  if (bikeGround !== g) {
    bike.drop(0, 0, 0, store.get('dropHeight'), g)
    bikeGround = g
  }
  bike.params = readBikeParams(store)
  const controls = { push: input.isDown('ArrowUp'), brake: input.isDown('ArrowDown') }
  physicsClock.advance(dt, (step) => bike.step(step, controls, g))
  // Fell off the map or blew up: start again in the middle.
  const half = g.size / 2 + 20
  if (!Number.isFinite(bike.position.y) || Math.abs(bike.position.x) > half || Math.abs(bike.position.z) > half) {
    bike.drop(0, 0, 0, store.get('dropHeight'), g)
  }
  bikeView.update(bike, dt)
}

/** Drops the bike where the camera is looking (or the map centre), facing away from the camera. */
function dropBikeInView(): void {
  if (!ground) return
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  const at = new THREE.Vector3()
  let found = false
  const half = ground.size / 2
  for (let d = 2; d < 8000; d += 1) {
    at.copy(camera.position).addScaledVector(look, d)
    // The camera may start outside the map: only the part over the map counts.
    if (Math.abs(at.x) > half || Math.abs(at.z) > half) continue
    if (at.y <= ground.heightAt(at.x, at.z)) {
      found = true
      break
    }
  }
  if (!found) at.set(0, 0, 0)
  bike.drop(at.x, at.z, Math.atan2(look.x, -look.z), store.get('dropHeight'), ground)
}
const rows = menu.rows

/** Size and cell size the current ground was built with. */
let built = { mapSize: NaN, cellSize: NaN }
let ground: Ground | null = null
let hills: HillShape[] = []
/** The rules and seed the current hills were placed with. */
let hillsKey = ''
let noiseRules: NoiseRules = readNoiseRules()
let noise: NoiseField = makeNoiseField(noiseRules, seed())
/** The noise rules and seed the current ground was baked with. */
let noiseKey = ''
/** The hill the full debug drawing is on (nearest the camera). */
let inspected: HillShape | null = null

function seed(): number {
  return Math.round(store.get('seed'))
}

function readNoiseRules(): NoiseRules {
  return {
    height: store.get('noiseHeight'),
    width: store.get('noiseWidth'),
    detail: store.get('noiseDetail'),
    calm: store.get('noiseCalm'),
  }
}

function currentHillsKey(): string {
  return JSON.stringify([readHillRules(store), seed()])
}

function currentNoiseKey(): string {
  return JSON.stringify([readNoiseRules(), seed()])
}

function wholeMap(g: Ground): Area {
  const half = g.size / 2
  return { minX: -half, maxX: half, minZ: -half, maxZ: half }
}

/** Places the hills for the current settings (doesn't bake them). */
function placeAllHills(g: Ground): void {
  hills = placeHills(readHillRules(store), g.size, seed())
  hillsKey = currentHillsKey()
  rows.get('hillCount')?.setNote(`placed ${hills.length} of ${store.get('hillCount')}`)
}

/** Bakes noise and hills over the whole map. */
function bakeAll(g: Ground): void {
  noiseRules = readNoiseRules()
  noise = makeNoiseField(noiseRules, seed())
  noiseKey = currentNoiseKey()
  bakeArea(g, hills, noise, noiseRules, wholeMap(g))
  redrawHillDebug(g)
}

/** The hill lines follow the ground, so they're redrawn after every bake. */
function redrawHillDebug(g: Ground): void {
  hillField.update(hills, store.get('hillSpacing'), noiseRules.calm, g.heightAt)
  inspected = null
  hillDebug.clear() // redrawn on the nearest hill next frame, if any is left
}

/** Re-bakes the whole map if a noise setting or the seed changed. */
function rebakeNoiseIfChanged(): void {
  if (!ground || currentNoiseKey() === noiseKey) return
  if (currentHillsKey() !== hillsKey) placeAllHills(ground) // the seed moves the hills too
  bakeAll(ground)
  terrain.heightsChanged([wholeMap(ground)])
}

/**
 * Re-places the hills if any hill setting changed (at most once a frame).
 * Only the old and new calm areas are recalculated and redrawn.
 */
function rebakeHillsIfChanged(): void {
  if (!ground || currentHillsKey() === hillsKey) return
  const areas = hills.map((h) => calmBounds(h, noiseRules.calm))
  placeAllHills(ground)
  areas.push(...hills.map((h) => calmBounds(h, noiseRules.calm)))
  for (const area of areas) bakeArea(ground, hills, noise, noiseRules, area)
  redrawHillDebug(ground)
  terrain.heightsChanged(areas)
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
  if (nearest && ground) hillDebug.update(nearest, ground.heightAt)
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
  placeAllHills(ground)
  bakeAll(ground)
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
  ['runUp', ['runUpLength']],
  ['runDown', ['runDownLength']],
  ['runUpFoot', ['runUpFoot']],
  ['runUpShoulder', ['runUpShoulder']],
  ['runDownFoot', ['runDownFoot']],
  ['runDownShoulder', ['runDownShoulder']],
]

/** Applies everything that doesn't need a rebuild (debug views, detail). */
function applyViews(): void {
  outline.visible = store.debug('mapSize')
  terrain.setShowGrid(store.debug('cellSize'))
  terrain.setPattern(store.isOn('showGrid'), store.get('gridSpacing'))
  terrain.setDetailDistance(store.get('detailDistance'))
  terrain.setDebug(store.debug('detailDistance'))
  terrain.setWireframe(store.isOn('wireframe'))
  for (const [part, ids] of HILL_PARTS) hillDebug.setVisible(part, ids.some((id) => store.debug(id)))
  bikeView.setDebug({
    mass: store.debug('bikeMass'),
    springs: store.debug('travel'),
    grip: store.debug('grip'),
    speed: store.debug('pushForce'),
  })
  hillField.setVisible(store.debug('hillCount'), store.debug('hillSpacing'), store.debug('noiseCalm'))
}
store.onChange(applyViews)
applyViews()

// Camera and controls
const input = new Input(window, canvas)
const fly = new FlyCamera(camera)
fly.placeOverCorner(store.get('mapSize'))
connectMenuKey(menu.window, document)

// F: jump the camera just behind the bike. R: drop the bike where you look.
document.addEventListener('keydown', (e) => {
  if (e.repeat || isTypingTarget(e.target)) return
  if (e.code === 'KeyR') dropBikeInView()
  if (e.code !== 'KeyF') return
  const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.orientation).setY(0)
  if (nose.lengthSq() < 0.01) nose.set(0, 0, -1) // pointing straight up or down
  nose.normalize()
  const p = bike.position
  fly.lookFrom(
    new THREE.Vector3(p.x - nose.x * 7, p.y + 3, p.z - nose.z * 7),
    new THREE.Vector3(p.x + nose.x * 4, p.y + 0.5, p.z + nose.z * 4),
  )
})

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
  rebakeNoiseIfChanged()
  rebakeHillsIfChanged()
  fly.update(dt, input, input.isLooking)
  inspectNearestHill(camera.position)
  moveBike(dt)
  terrain.updateLod(camera.position)
  renderer.render(scene, camera)
  updateDetailNote(dt)
})
