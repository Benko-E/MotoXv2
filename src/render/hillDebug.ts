import { Group, type Object3D, type Scene, Vector3 } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { type HillShape, hillHeight } from '../world/hill'
import { hillRadius } from '../world/hills'
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

  /** Removes the drawing (no hill to show). */
  clear(): void {
    for (const group of this.parts.values()) {
      for (const child of group.children) dispose(child)
      group.clear()
    }
    for (const m of this.materials) m.dispose()
    this.materials.length = 0
  }

  /** Redraws everything for `hill`, standing on flat ground at height `base`. */
  update(hill: HillShape, base = 0): void {
    this.clear()

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
    this.add('height', this.label(`C · ${metres(hill.height)}`, top.clone().setY(top.y + 3)))

    // The flat top
    if (hill.top > 0) {
      this.add('top', this.label(`top ${metres(hill.top)}`, top.clone().addScaledVector(toD.clone().negate(), hill.top).setY(top.y + 1)))
      const ring = []
      for (let i = 0; i <= STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2
        ring.push(new Vector3(hill.x + Math.cos(a) * hill.top, base + hill.height + LIFT, hill.z + Math.sin(a) * hill.top))
      }
      this.add('top', this.line(ring, 0xffffff, 2))
    }

    // Each side: base line, red profile, half the footprint, its label
    const sides: [HillPart, Vector3, HillShape['runUp'], string][] = [
      ['runUp', toD.clone().negate(), hill.runUp, 'A'],
      ['runDown', toD, hill.runDown, 'D'],
    ]
    for (const [part, dir, shape, letter] of sides) {
      const length = shape.length
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
      const text = `${letter} · ${metres(length)} · foot ${shape.foot.toFixed(1)} · shoulder ${shape.shoulder.toFixed(1)}`
      this.add(part, this.label(text, foot.clone().setY(base + 3)))
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

/** Whole metres for labels. */
function metres(m: number): string {
  return `${Math.round(m)} m`
}

/**
 * The light drawing on every hill at once: a pole and red footprint each
 * (Count's checkbox), and a spacing ring at footprint + half the spacing,
 * so two rings touch when hills sit at the minimum gap (Spacing's checkbox).
 */
export class HillFieldDebug {
  private readonly poles: LineSegments2
  private readonly rings: LineSegments2
  private readonly materials: LineMaterial[]

  constructor(scene: Scene) {
    const poleMaterial = new LineMaterial({ color: PROFILE, linewidth: 2, depthTest: false, transparent: true })
    const ringMaterial = new LineMaterial({ color: 0xffffff, linewidth: 1.5, depthTest: false, transparent: true, opacity: 0.5 })
    this.materials = [poleMaterial, ringMaterial]
    this.poles = new LineSegments2(new LineSegmentsGeometry(), poleMaterial)
    this.rings = new LineSegments2(new LineSegmentsGeometry(), ringMaterial)
    for (const l of [this.poles, this.rings]) {
      l.renderOrder = 9
      l.frustumCulled = false
      scene.add(l)
    }
  }

  setResolution(width: number, height: number): void {
    for (const m of this.materials) m.resolution.set(width, height)
  }

  setVisible(poles: boolean, rings: boolean): void {
    this.poles.visible = poles
    this.rings.visible = rings
  }

  update(hills: HillShape[], spacing: number, base = 0): void {
    const poles: number[] = []
    const rings: number[] = []
    for (const hill of hills) {
      poles.push(hill.x, base, hill.z, hill.x, base + hill.height, hill.z)
      // Footprint outline, where the hill meets the ground
      let previous: Vector3 | null = null
      for (let i = 0; i <= STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2
        const d = new Vector3(Math.sin(a), 0, -Math.cos(a))
        const p = new Vector3(hill.x, base + LIFT, hill.z).addScaledVector(d, footRadius(hill, d))
        if (previous) poles.push(previous.x, previous.y, previous.z, p.x, p.y, p.z)
        previous = p
      }
      const r = hillRadius(hill) + spacing / 2
      for (let i = 0; i < STEPS; i++) {
        const a0 = (i / STEPS) * Math.PI * 2
        const a1 = ((i + 1) / STEPS) * Math.PI * 2
        rings.push(
          hill.x + Math.sin(a0) * r, base + LIFT, hill.z - Math.cos(a0) * r,
          hill.x + Math.sin(a1) * r, base + LIFT, hill.z - Math.cos(a1) * r,
        )
      }
    }
    replaceSegments(this.poles, poles)
    replaceSegments(this.rings, rings)
  }
}

function replaceSegments(line: LineSegments2, positions: number[]): void {
  line.geometry.dispose()
  const geometry = new LineSegmentsGeometry()
  if (positions.length > 0) geometry.setPositions(positions)
  line.geometry = geometry
}

/** How far the hill reaches from the pole in direction `d` (where it meets the ground). */
function footRadius(hill: HillShape, d: Vector3): number {
  const f = (hill.facing * Math.PI) / 180
  const towardsD = d.x * Math.sin(f) - d.z * Math.cos(f)
  const w = (1 + towardsD) / 2
  return hill.runUp.length + (hill.runDown.length - hill.runUp.length) * w
}

function dispose(object: Object3D): void {
  const o = object as Object3D & { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } | null } }
  o.geometry?.dispose()
  o.material?.map?.dispose()
  o.material?.dispose() // label sprites each have their own material
}
