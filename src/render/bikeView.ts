import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Scene,
  SphereGeometry,
  Quaternion,
  type Sprite,
  Vector3,
} from 'three'
import type { Bike } from '../physics/bike'
import { makeLabel, setLabelText } from './label'

const AXLE = new Vector3(1, 0, 0)
const STEER_AXIS = new Vector3(0, 1, 0)
const UP = new Vector3(0, 1, 0)
/** Where the rider box sits on the bike when sitting normally (centre of mass is the origin). */
const RIDER_SEAT = new Vector3(0, 0.75, 0.15)
/** Body points: green scrape, blue rider/bars (a crash), red while touching. */
const POINT_COLOURS = { scrape: '#33dd33', crash: '#4da3ff', touching: '#ff3030' }
/** The middle of the handlebar on the bike (centre of mass is the origin), and half its width. */
const BARS = { at: new Vector3(0, 0.45, -0.7), half: 0.42 }
/** Front wheel arrows: this long pointing straight, plus this much per radian turned, m. */
const ARROW_LENGTH = { straight: 0.8, perRadian: 3 }
/** Steering drawings: yellow where the front wheel points, cyan where A/D ask it to. */
const STEER_COLOURS = { actual: '#ffd21f', asked: '#29e0ff', fork: '#f2f2f2' }

/** Which debug drawings are on (the menu's checkboxes). */
export type BikeDebug = {
  /** Handlebar, fork and front wheel arrows (BIKE → Bar lock). */
  steering: boolean
  /** Where the rider's weight sits (RIDER → Rider reach). */
  reach: boolean
  /** Body contact points (RIDER → Crash lean). */
  body: boolean
}

/** Material for drawings that show through the bike: flat colour, always on top. */
function onTop(colour: string): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: colour, depthTest: false })
}

/** A thick bar between two points, drawn on top of everything. */
class Stick {
  readonly mesh: Mesh

  constructor(scene: Scene, colour: string, radius: number) {
    this.mesh = new Mesh(new CylinderGeometry(radius, radius, 1, 8), onTop(colour))
    this.mesh.renderOrder = 10
    this.mesh.frustumCulled = false // it moves every frame; its bounds don't follow
    scene.add(this.mesh)
  }

  set(from: Vector3, to: Vector3): void {
    const along = to.clone().sub(from)
    const length = along.length()
    this.mesh.position.copy(from).addScaledVector(along, 0.5)
    if (length > 1e-6) this.mesh.quaternion.setFromUnitVectors(UP, along.divideScalar(length))
    this.mesh.scale.set(1, Math.max(length, 1e-3), 1)
  }
}

/** A thick arrow (shaft and cone head), drawn on top of everything. */
class Arrow {
  readonly group = new Group()
  private readonly shaft: Mesh
  private readonly head: Mesh
  private readonly headLength: number

  constructor(scene: Scene, colour: string, radius: number, order: number) {
    const material = onTop(colour)
    this.headLength = radius * 7
    this.shaft = new Mesh(new CylinderGeometry(radius, radius, 1, 8).translate(0, 0.5, 0), material)
    this.head = new Mesh(new ConeGeometry(radius * 2.6, this.headLength, 12).translate(0, this.headLength / 2, 0), material)
    for (const part of [this.shaft, this.head]) {
      part.renderOrder = order
      part.frustumCulled = false
    }
    this.group.add(this.shaft, this.head)
    scene.add(this.group)
  }

  /** From `from` along `direction` (a unit vector), `length` metres long with its head. */
  set(from: Vector3, direction: Vector3, length: number): void {
    this.group.position.copy(from)
    this.group.quaternion.setFromUnitVectors(UP, direction)
    const shaft = Math.max(length - this.headLength, 1e-3)
    this.shaft.scale.set(1, shaft, 1)
    this.head.position.y = shaft
  }
}

/**
 * Draws the bike as plain boxes and two wheels, plus its debug view: the
 * steering (handlebar, fork, where the front wheel points and where A/D ask
 * it to), the rider's weight and the body's contact points.
 */
export class BikeView {
  private readonly body = new Group()
  private readonly wheels: Group[]
  private readonly riderBox: Mesh
  private readonly handlebar: Stick
  private readonly fork: Stick
  /** Where the front wheel points now. */
  private readonly actualArrow: Arrow
  /** Where A/D ask it to point (the bar lock, before the speed limit). */
  private readonly askedArrow: Arrow
  private readonly crashLabel: Sprite
  private crashText = ''
  private readonly weight: Mesh
  private readonly points: Mesh[]
  /** What the pick-up key is called, for the crash label. */
  pickUpKey = 'R'

  constructor(scene: Scene) {
    const frame = new Mesh(new BoxGeometry(0.35, 0.45, 1.5), new MeshStandardMaterial({ color: '#f07a1a' }))
    frame.position.y = 0.1
    const rider = new Mesh(new BoxGeometry(0.45, 0.9, 0.5), new MeshStandardMaterial({ color: '#2a6fdb' }))
    rider.position.copy(RIDER_SEAT)
    this.riderBox = rider
    this.body.add(frame, rider)
    scene.add(this.body)

    const wheelMaterial = new MeshStandardMaterial({ color: '#222222' })
    const stripeMaterial = new MeshStandardMaterial({ color: '#f2f2f2' })
    this.wheels = [0.36, 0.34].map((r) => {
      const tyre = new Mesh(new CylinderGeometry(r, r, 0.12, 24), wheelMaterial)
      tyre.geometry.rotateZ(Math.PI / 2) // axle along the bike's side
      // A stripe across the wheel, so you can see it turn (and see wheelspin).
      const stripe = new Mesh(new BoxGeometry(0.13, 0.07, r * 1.9), stripeMaterial)
      const wheel = new Group().add(tyre, stripe)
      scene.add(wheel)
      return wheel
    })

    this.handlebar = new Stick(scene, STEER_COLOURS.actual, 0.03)
    this.fork = new Stick(scene, STEER_COLOURS.fork, 0.02)
    this.actualArrow = new Arrow(scene, STEER_COLOURS.actual, 0.04, 10)
    // Thinner and drawn after: when the wheel does what A/D ask, the cyan
    // runs down the middle of the yellow.
    this.askedArrow = new Arrow(scene, STEER_COLOURS.asked, 0.02, 11)
    this.crashLabel = makeLabel(' ')
    this.crashLabel.visible = false
    scene.add(this.crashLabel)
    this.weight = new Mesh(new SphereGeometry(0.1), new MeshStandardMaterial({ color: '#ff4dd2', depthTest: false }))
    this.weight.renderOrder = 10
    scene.add(this.weight)
    const pointGeometry = new SphereGeometry(0.05)
    this.points = Array.from({ length: 10 }, () => {
      const point = new Mesh(pointGeometry, new MeshStandardMaterial({ depthTest: false }))
      point.renderOrder = 10
      scene.add(point)
      return point
    })
    this.setDebug({ steering: false, reach: false, body: false })
  }

  setDebug(debug: BikeDebug): void {
    for (const part of [this.handlebar.mesh, this.fork.mesh, this.actualArrow.group, this.askedArrow.group]) {
      part.visible = debug.steering
    }
    this.weight.visible = debug.reach
    for (const p of this.points) p.visible = debug.body
  }

  update(bike: Bike): void {
    // The bike sits where the rider's weight puts it: opposite his shift.
    this.body.position.copy(bike.comShift).negate().applyQuaternion(bike.orientation).add(bike.position)
    this.body.quaternion.copy(bike.orientation)
    // The rider himself moves by his reach (the whole bike's centre moves by his share of it).
    const riderShare = bike.params.riderMass / bike.mass
    this.riderBox.position.copy(bike.comShift).divideScalar(riderShare).add(RIDER_SEAT)

    ;[bike.front, bike.rear].forEach((w, i) => {
      this.wheels[i].position.copy(w.center)
      // Rolling forward (nose is −z) turns the wheel backwards about its axle (+x).
      // The front also turns with the bars (+ = right = clockwise from above).
      const bars = new Quaternion().setFromAxisAngle(STEER_AXIS, i === 0 ? -bike.steer : 0)
      this.wheels[i].quaternion
        .copy(bike.orientation)
        .multiply(bars)
        .multiply(new Quaternion().setFromAxisAngle(AXLE, -w.angle))
    })

    // Steering: the handlebar turns with the bars, the fork runs down to the
    // front wheel, and the arrows grow the further they point off straight.
    this.body.updateMatrixWorld()
    const turned = (angle: number, local: Vector3) =>
      local.clone().applyAxisAngle(STEER_AXIS, -angle).applyQuaternion(bike.orientation)
    const barsMiddle = BARS.at.clone().applyMatrix4(this.body.matrixWorld)
    const barsSide = turned(bike.steer, AXLE).multiplyScalar(BARS.half)
    this.handlebar.set(barsMiddle.clone().sub(barsSide), barsMiddle.clone().add(barsSide))
    this.fork.set(barsMiddle, bike.front.center)
    const arrowLength = (angle: number) => ARROW_LENGTH.straight + ARROW_LENGTH.perRadian * Math.abs(angle)
    const nose = new Vector3(0, 0, -1)
    this.actualArrow.set(bike.front.center, turned(bike.steer, nose), arrowLength(bike.steer))
    this.askedArrow.set(bike.front.center, turned(bike.barsAsked, nose), arrowLength(bike.barsAsked))

    this.crashLabel.position.copy(bike.position).add(new Vector3(0, 1.8, 0))
    this.crashLabel.visible = bike.crashed
    const crash = `CRASHED · ${this.pickUpKey} to pick up`
    if (crash !== this.crashText) {
      setLabelText(this.crashLabel, crash, '#ff5050')
      this.crashText = crash
    }
    this.weight.position.copy(this.riderBox.position).applyMatrix4(this.body.matrixWorld)
    bike.body.forEach((b, i) => {
      this.points[i].position.copy(b.at)
      const colour = b.touching ? POINT_COLOURS.touching : b.crashes ? POINT_COLOURS.crash : POINT_COLOURS.scrape
      ;(this.points[i].material as MeshStandardMaterial).color.set(colour)
    })
  }
}
