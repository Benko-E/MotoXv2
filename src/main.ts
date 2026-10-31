import * as THREE from 'three'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#9ec9e8')

const sun = new THREE.DirectionalLight('#ffffff', 2)
sun.position.set(300, 500, 200)
scene.add(sun, new THREE.HemisphereLight('#cfe6ff', '#5a6040', 1))

const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 20000)

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
})
