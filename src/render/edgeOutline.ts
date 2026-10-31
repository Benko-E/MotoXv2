import { Group, type Scene, type Sprite } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { makeLabel, setLabelText } from './label'

const LIFT = 0.05 // metres above the ground
const LABEL_LIFT = 2

/** Debug lines for map size: a bright outline round the edge, labelled per side. */
export class EdgeOutline {
  private readonly group = new Group()
  private readonly material = new LineMaterial({ color: 0xffcc33, linewidth: 3, depthTest: false })
  private readonly line: Line2
  private readonly labels: Sprite[] = []

  constructor(scene: Scene) {
    this.line = new Line2(new LineGeometry(), this.material)
    this.line.renderOrder = 9
    this.group.add(this.line)
    for (let i = 0; i < 4; i++) {
      const label = makeLabel('')
      this.labels.push(label)
      this.group.add(label)
    }
    scene.add(this.group)
  }

  get visible(): boolean {
    return this.group.visible
  }

  set visible(on: boolean) {
    this.group.visible = on
  }

  /** The fat-line material needs the screen size in pixels. */
  setResolution(width: number, height: number): void {
    this.material.resolution.set(width, height)
  }

  update(size: number): void {
    const h = size / 2
    const geometry = new LineGeometry()
    geometry.setPositions([-h, LIFT, -h, h, LIFT, -h, h, LIFT, h, -h, LIFT, h, -h, LIFT, -h])
    this.line.geometry.dispose()
    this.line.geometry = geometry
    this.line.computeLineDistances()

    const text = `${size.toLocaleString('en-US')} m`
    const sides = [
      [0, -h],
      [h, 0],
      [0, h],
      [-h, 0],
    ]
    sides.forEach(([x, z], i) => {
      this.labels[i].position.set(x, LABEL_LIFT, z)
      setLabelText(this.labels[i], text)
    })
  }
}
