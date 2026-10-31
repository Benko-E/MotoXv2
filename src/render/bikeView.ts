import {
  ArrowHelper,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  type Scene,
  SphereGeometry,
  type Sprite,
  Vector3,
} from 'three'
import type { Bike, WheelState } from '../physics/bike'
import { makeLabel, setLabelText } from './label'

/** Debug arrows: metres of arrow per newton. */
const ARROW_SCALE = 1 / 1000
/** Labels are redrawn this often (their text is a picture, so not every frame). */
const LABEL_INTERVAL = 0.1

/** Which debug drawings are on (the BIKE tab's checkboxes). */
export type BikeDebug = { mass: boolean; springs: boolean; grip: boolean; speed: boolean }

/**
 * Draws the bike as plain boxes and two wheels, plus its debug view:
 * centre of mass, suspension bars, ground force arrows and labels.
 */
export class BikeView {
  private readonly body = new Group()
  private readonly wheels: Mesh[]
  private readonly com: Mesh
  private readonly bars: Line[]
  private readonly arrows: ArrowHelper[]
  private readonly massLabel: Sprite
  private readonly springLabels: Sprite[]
  private readonly speedLabel: Sprite
  private sinceLabels = Infinity
  private debug: BikeDebug = { mass: false, springs: false, grip: false, speed: false }

  constructor(scene: Scene) {
    const frame = new Mesh(new BoxGeometry(0.35, 0.45, 1.5), new MeshStandardMaterial({ color: '#f07a1a' }))
    frame.position.y = 0.1
    const rider = new Mesh(new BoxGeometry(0.45, 0.9, 0.5), new MeshStandardMaterial({ color: '#2a6fdb' }))
    rider.position.set(0, 0.75, 0.15)
    this.body.add(frame, rider)
    scene.add(this.body)

    const wheelMaterial = new MeshStandardMaterial({ color: '#222222' })
    this.wheels = [0.36, 0.34].map((r) => {
      const wheel = new Mesh(new CylinderGeometry(r, r, 0.12, 24), wheelMaterial)
      wheel.geometry.rotateZ(Math.PI / 2) // axle along the bike's side
      scene.add(wheel)
      return wheel
    })

    this.com = new Mesh(new SphereGeometry(0.08), new MeshStandardMaterial({ color: '#ffffff', depthTest: false }))
    this.com.renderOrder = 10
    scene.add(this.com)

    this.bars = [0, 1].map(() => {
      const line = new Line(
        new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]),
        new LineBasicMaterial({ color: '#33dd33', depthTest: false }),
      )
      line.renderOrder = 10
      scene.add(line)
      return line
    })
    this.arrows = [0, 1].map(() => {
      const arrow = new ArrowHelper(new Vector3(0, 1, 0), new Vector3(), 1, 0xffe14d)
      arrow.traverse((o) => ((o as Mesh).renderOrder = 10))
      scene.add(arrow)
      return arrow
    })
    this.massLabel = this.addLabel(scene)
    this.springLabels = [this.addLabel(scene), this.addLabel(scene)]
    this.speedLabel = this.addLabel(scene)
  }

  setDebug(debug: BikeDebug): void {
    this.debug = debug
    this.com.visible = debug.mass
    this.massLabel.visible = debug.mass
    for (const b of this.bars) b.visible = debug.springs
    for (const l of this.springLabels) l.visible = debug.springs
    this.speedLabel.visible = debug.speed
  }

  update(bike: Bike, dt: number): void {
    this.body.position.copy(bike.position)
    this.body.quaternion.copy(bike.orientation)
    const up = new Vector3(0, 1, 0).applyQuaternion(bike.orientation)
    const wheels = [bike.front, bike.rear]

    wheels.forEach((w, i) => {
      this.wheels[i].position.copy(w.center)
      this.wheels[i].quaternion.copy(bike.orientation)

      // Suspension bar from the mount down to the wheel, green → red at the stop.
      const mount = w.center.clone().addScaledVector(up, bike.params.travel - Math.min(w.compression, bike.params.travel))
      this.bars[i].geometry.setFromPoints([mount, w.center])
      const used = Math.min(w.compression / bike.params.travel, 1)
      ;(this.bars[i].material as LineBasicMaterial).color.copy(new Color('#33dd33').lerp(new Color('#ff3030'), used))

      const arrow = this.arrows[i]
      arrow.visible = this.debug.grip && w.contact
      if (arrow.visible) {
        const length = w.groundForce.length() * ARROW_SCALE
        arrow.position.copy(w.contactPoint)
        arrow.setDirection(w.groundForce.clone().normalize())
        arrow.setLength(Math.max(length, 0.05), Math.min(0.25, length * 0.3), 0.12)
      }
      this.springLabels[i].position.copy(mount).addScaledVector(up, 0.5)
    })

    this.com.position.copy(bike.position)
    this.massLabel.position.copy(bike.position).add(new Vector3(0, 2.2, 0))
    this.speedLabel.position.copy(bike.position).add(new Vector3(0, 2.7, 0))

    this.sinceLabels += dt
    if (this.sinceLabels < LABEL_INTERVAL) return
    this.sinceLabels = 0
    setLabelText(this.massLabel, `${Math.round(bike.mass)} kg`)
    wheels.forEach((w: WheelState, i) => {
      const where = i === 0 ? 'front' : 'rear'
      const text = w.contact ? `${where} ${Math.round(w.compression * 100)} cm · ${Math.round(w.force)} N` : `${where} in the air`
      setLabelText(this.springLabels[i], text)
    })
    setLabelText(this.speedLabel, `${(bike.speed * 3.6).toFixed(1)} km/h`)
  }

  private addLabel(scene: Scene): Sprite {
    const label = makeLabel(' ')
    label.visible = false
    scene.add(label)
    return label
  }
}
