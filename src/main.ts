import * as THREE from 'three'
import { FlyCamera } from './camera/flyCamera'
import { Input } from './camera/input'
import { connectMenuKey } from './camera/menuKey'
import { EdgeOutline } from './render/edgeOutline'
import { GroundView } from './render/groundView'
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
const groundView = new GroundView(scene)
const outline = new EdgeOutline(scene)

function rebuildMap(): void {
  const ground = makeGround(store.get('mapSize'), store.get('cellSize'))
  groundView.update(ground, store.debug('cellSize'))
  outline.update(ground.size)
  outline.visible = store.debug('mapSize')

  const note = `real size ${ground.size.toLocaleString('en-US')} m · ${ground.cells.toLocaleString('en-US')} cells`
  menu.rows.get('mapSize')?.setNote(note)
  menu.rows.get('cellSize')?.setNote(note)
}
store.onChange(rebuildMap)
rebuildMap()

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

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1) // no huge jump after a stall
  fly.update(dt, input, input.isLooking)
  renderer.render(scene, camera)
})
