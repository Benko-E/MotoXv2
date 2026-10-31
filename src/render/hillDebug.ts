import { Group, type Object3D, type Scene, Vector3 } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { type HillShape, hillHeight } from '../world/hill'
import { makeLabel } from './label'

/** Parts of the hill drawing; each setting's debug checkbox shows some of them. */
export type HillPart = 'position' | 'facing' | 'height' | 'top' | 'runUp' | 'runDown'

const PROFILE = 0xe8322c // the red line from the user's drawing
const FRAME = 0x33dd33 // the green lines (base and pole)
const LIFT = 0.3 // metres above the surface, so lines don't flicker into it
const STEPS = 64

/**
 * Debug drawing of the hill, as in the user's picture: the green base line
 * A–B–D and pole B–C, the red profile curves, the footprint outline, the flat
 * top ring, a facing arrow and A/B/C/D labels.
 */
export class HillDebug {
  private readonly parts = new Map<HillPart, Group>()
  private readonly materials: LineMaterial[] = []

  constructor(scene: Scene) {
    for (const part of ['position', 'facing', 'height', 'top', 'runUp', 'runDown'] as HillPart[]) {
      const group = new Group()
      this.parts.set(part, group)
      scene.add(group)
    }
  }

  /** The fat-line materials need the screen size in pixels. */
  setResolution(width: number, height: number): void {
    for (const m of this.materials) m.resolution.set(width, height)
    this.size = { width, height }
  }

  setVisible(part: HillPart, on: boolean): void {
    this.parts.get(part)!.visible = on
  }

  /** Redraws everything for `hill`, standing on flat ground at height `base`. */
  update(hill: HillShape, base = 0): void {
    for (const group of this.parts.values()) {
      for (const child of group.children) dispose(child)
      group.clear()
    }
    for (const m of this.materials) m.dispose()
    this.materials.length = 0

    const f = (hill.facing * Math.PI) / 180
    const toD = new Vector3(Math.sin(f), 0, -Math.cos(f))
    const pole = new Vector3(hill.x, base, hill.z)
    const surface = (x: number, z: number) => base + hillHeight(hill, x, z) + LIFT
    const at = (dir: Vector3, r: number) => pole.clone().addScaledVector(dir, r)

    // B: where the pole stands
    this.add('position', this.label('B', pole.clone().setY(base + 1)))

    // Facing: an arrow over the top, pointing towards D
    const tip = at(toD, Math.max(hill.top, 6) + 4).setY(base + hill.height + 2)
    const tail = at(toD, -Math.max(hill.top, 6)).setY(base + hill.height + 2)
    const side = new Vector3(-toD.z, 0, toD.x).multiplyScalar(2.5)
    const back = tip.clone().addScaledVector(toD, -4)
    this.add('facing', this.line([tail, tip], 0xffffff, 3))
    this.add('facing', this.line([back.clone().add(side), tip, back.clone().sub(side)], 0xffffff, 3))

    // B–C: the pole
    const top = pole.clone().setY(base + hill.height)
    this.add('height', this.line([pole, top], FRAME, 3))
    this.add('height', this.label(`C · ${hill.height} m`, top.clone().setY(top.y + 3)))

    // The flat top
    if (hill.top > 0) {
      const ring = []
      for (let i = 0; i <= STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2
        ring.push(new Vector3(hill.x + Math.cos(a) * hill.top, base + hill.height + LIFT, hill.z + Math.sin(a) * hill.top))
      }
      this.add('top', this.line(ring, 0xffffff, 2))
    }

    // Each side: base line, red profile, half the footprint, its label
    const sides: [HillPart, Vector3, number, string][] = [
      ['runUp', toD.clone().negate(), hill.runUp.length, 'A'],
      ['runDown', toD, hill.runDown.length, 'D'],
    ]
    for (const [part, dir, length, letter] of sides) {
      const foot = at(dir, length)
      this.add(part, this.line([pole.clone().setY(base + LIFT), foot.clone().setY(base + LIFT)], FRAME, 3))

      const curve = []
      for (let i = 0; i <= STEPS; i++) {
        const p = at(dir, (i / STEPS) * length)
        curve.push(p.setY(surface(p.x, p.z)))
      }
      this.add(part, this.line(curve, PROFILE, 4))

      // Half the footprint: the ground-level outline on this side of the pole
      const half = []
      const facingAngle = Math.atan2(dir.x, -dir.z)
      for (let i = 0; i <= STEPS; i++) {
        const a = facingAngle - Math.PI / 2 + (i / STEPS) * Math.PI
        const d = new Vector3(Math.sin(a), 0, -Math.cos(a))
        half.push(at(d, footRadius(hill, d)).setY(base + LIFT))
      }
      this.add(part, this.line(half, PROFILE, 2))
      this.add(part, this.label(`${letter} · ${length} m`, foot.clone().setY(base + 3)))
    }

    if (this.size) this.setResolution(this.size.width, this.size.height)
  }

  private size: { width: number; height: number } | null = null

  private add(part: HillPart, object: Object3D): void {
    this.parts.get(part)!.add(object)
  }

  private line(points: Vector3[], color: number, width: number): Line2 {
    const material = new LineMaterial({ color, linewidth: width, depthTest: false, transparent: true })
    if (this.size) material.resolution.set(this.size.width, this.size.height)
    this.materials.push(material)
    const geometry = new LineGeometry()
    geometry.setPositions(points.flatMap((p) => [p.x, p.y, p.z]))
    const line = new Line2(geometry, material)
    line.renderOrder = 9
    return line
  }

  private label(text: string, position: Vector3): Object3D {
    const label = makeLabel(text)
    label.position.copy(position)
    return label
  }
}

/** How far the hill reaches from the pole in direction `d` (where it meets the ground). */
function footRadius(hill: HillShape, d: Vector3): number {
  const f = (hill.facing * Math.PI) / 180
  const towardsD = d.x * Math.sin(f) - d.z * Math.cos(f)
  const w = (1 + towardsD) / 2
  return hill.runUp.length + (hill.runDown.length - hill.runUp.length) * w
}

function dispose(object: Object3D): void {
  const o = object as Object3D & { geometry?: { dispose(): void }; material?: { map?: { dispose(): void } | null } }
  o.geometry?.dispose()
  o.material?.map?.dispose()
}
