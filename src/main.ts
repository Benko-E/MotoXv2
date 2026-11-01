import * as THREE from 'three'
import { FlyCamera, type FlyKeys } from './camera/flyCamera'
import { FollowCamera } from './camera/followCamera'
import { Input, isTypingTarget } from './camera/input'
import { connectMenuKey } from './camera/menuKey'
import { EdgeOutline } from './render/edgeOutline'
import { HillDebug, HillFieldDebug, type HillPart } from './render/hillDebug'
import { BikeView } from './render/bikeView'
import { Bike } from './physics/bike'
import { readBikeParams } from './physics/bikeSettings'
import { ramp, rampTo } from './physics/controls'
import { EngineAudio } from './audio/engineAudio'
import { FixedClock } from './physics/clock'
import { TerrainView } from './render/terrainView'
import { SETTINGS, TABS } from './settings/list'
import { SettingsStore } from './settings/store'
import { buildMenu } from './ui/buildMenu'
import { cellSizeUsed, type Ground, makeGround } from './world/ground'
import type { Area, HillShape } from './world/hill'
import { placeHills } from './world/hills'
import { keyLabel } from './settings/keys'
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
const engineAudio = new EngineAudio()
// Browsers only allow sound after the player presses something.
window.addEventListener('keydown', () => engineAudio.start())
window.addEventListener('pointerdown', () => engineAudio.start())
/** What the rider is doing with the controls, eased in and out from the keys. */
const controls = { throttle: 0, brake: 0, rearBrake: 0, steer: 0, riderShift: 0 }
/** Follow: the keys ride the bike and the camera trails it. Free: the keys fly the camera. */
let cameraMode: 'follow' | 'free' = 'follow'
/** The map the bike was dropped on; a new map drops it again. */
let bikeGround: Ground | null = null
/** How high above the ground the bike is dropped (R in free-roam, a new map), m. */
const DROP_HEIGHT = 3
/** Speed, bottom left: what to go by when telling how the bike feels. */
const speedometer = document.createElement('div')
speedometer.className = 'speedometer'
ui.append(speedometer)

/** Runs the bike's physics for this frame's time, then draws it. */
function moveBike(dt: number): void {
  if (!ground) return
  const g = ground
  if (bikeGround !== g) {
    bike.drop(0, 0, 0, DROP_HEIGHT, g)
    bikeGround = g
  }
  bike.params = readBikeParams(store)
  // A twist grip, levers, bars and a body take a moment to move; they don't snap.
  // Flying the camera: hands off the bike.
  const riding = cameraMode === 'follow'
  const held = (id: string) => riding && input.isDown(store.key(id))
  const axis = (plus: string, minus: string) => (held(plus) ? 1 : 0) - (held(minus) ? 1 : 0)
  controls.throttle = ramp(controls.throttle, held('keyThrottle'), dt, 0.25, 0.15)
  controls.brake = ramp(controls.brake, held('keyBrake'), dt, 0.1, 0.1)
  controls.rearBrake = ramp(controls.rearBrake, held('keyRearBrake'), dt, 0.05, 0.1)
  controls.steer = rampTo(controls.steer, axis('keyRight', 'keyLeft'), dt, 0.12)
  controls.riderShift = rampTo(controls.riderShift, axis('keyRiderForward', 'keyRiderBack'), dt, 0.3)
  physicsClock.advance(dt, (step) => bike.step(step, controls, g))
  // Fell off the map or blew up: start again in the middle.
  const half = g.size / 2 + 20
  if (!Number.isFinite(bike.position.y) || Math.abs(bike.position.x) > half || Math.abs(bike.position.z) > half) {
    bike.drop(0, 0, 0, DROP_HEIGHT, g)
  } else if (bike.position.y < g.heightAt(bike.position.x, bike.position.z) - 3) {
    // Sank through the ground anyway (a very hard hit): drop it again where it is.
    const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(bike.orientation)
    bike.drop(bike.position.x, bike.position.z, Math.atan2(nose.x, -nose.z), DROP_HEIGHT, g)
  }
  bikeView.update(bike)
  speedometer.textContent = `${Math.round(bike.speed * 3.6)} km/h`
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
  bike.drop(at.x, at.z, Math.atan2(look.x, -look.z), DROP_HEIGHT, ground)
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
    steering: store.debug('barLock'),
    reach: store.debug('riderReach'),
    body: store.debug('crashLean'),
  })
  bikeView.pickUpKey = keyLabel(store.key('keyPickUp'))
  hillField.setVisible(store.debug('hillCount'), store.debug('hillSpacing'), store.debug('noiseCalm'))
}
store.onChange(applyViews)
applyViews()

// Camera and controls
const input = new Input(window, canvas)
const fly = new FlyCamera(camera)
fly.placeOverCorner(store.get('mapSize'))
const follow = new FollowCamera(camera)

function flyKeys(): FlyKeys {
  return {
    forward: store.key('keyFlyForward'),
    back: store.key('keyFlyBack'),
    left: store.key('keyFlyLeft'),
    right: store.key('keyFlyRight'),
    up: store.key('keyFlyUp'),
    down: store.key('keyFlyDown'),
    fast: store.key('keyFlyFast'),
  }
}

function bikeNose(): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(bike.orientation)
}
connectMenuKey(menu.window, document)

// C: switch camera. R: pick the bike up (following it) or drop it where you
// look (free-roam). F: free-roam camera just behind the bike.
document.addEventListener('keydown', (e) => {
  if (e.repeat || isTypingTarget(e.target)) return
  if (e.code === store.key('keyCamera')) {
    if (cameraMode === 'follow') {
      cameraMode = 'free'
      fly.lookFrom(camera.position.clone(), bike.position.clone()) // carry on from here
    } else {
      cameraMode = 'follow'
      follow.snap(bike.position, bikeNose())
    }
  }
  if (e.code === store.key('keyPickUp')) {
    if (cameraMode === 'follow' && ground) bike.pickUp(ground)
    else dropBikeInView()
  }
  if (e.code !== store.key('keyBehind') || cameraMode !== 'free') return
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
  if (cameraMode === 'free') fly.update(dt, input, input.isLooking, flyKeys())
  else input.takeMouse() // looking around waits for free-roam
  inspectNearestHill(camera.position)
  moveBike(dt)
  if (cameraMode === 'follow') follow.update(dt, bike.position, bikeNose())
  engineAudio.update({
    rpm: bike.rpm,
    load: bike.throttle,
    cut: bike.drivetrain.ignitionCut,
    revLimit: bike.params.revLimit,
    volume: store.isOn('soundOn') ? store.get('soundVolume') / 100 : 0,
  })
  terrain.updateLod(camera.position)
  renderer.render(scene, camera)
  updateDetailNote(dt)
})
