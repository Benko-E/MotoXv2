import { Group, type Object3D, type Scene, Vector3 } from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { type HillShape, hillReach } from '../world/hill'
import { hillRadius } from '../world/hills'
import { makeLabel } from './label'

/** Parts of the hill drawing; each setting's debug checkbox shows some of them. */
export type HillPart =
  | 'position'
  | 'facing'
  | 'height'
  | 'top'
  | 'runUp'
  | 'runDown'
  | 'runUpFoot'
  | 'runUpShoulder'
  | 'runDownFoot'
  | 'runDownShoulder'

const ALL_PARTS: HillPart[] = [
  'position',
  'facing',
  'height',
  'top',
  'runUp',
  'runDown',
  'runUpFoot',
  'runUpShoulder',
  'runDownFoot',
  'runDownShoulder',
]

const PROFILE = 0xe8322c // the red line from the user's drawing
const FRAME = 0x33dd33 // the green lines (base and pole)
const LIFT = 0.3 // metres above the surface, so lines don't flicker into it
const STEPS = 64
const MESH = 0xffe14d // the yellow slope mesh (foot and shoulder)
/** Slope mesh: lines down the slope across this many degrees either side of A or D. */
const MESH_HALF_ANGLE = 75
const MESH_DOWN_LINES = 9
/** Rings across the slope per half (foot half, shoulder half). */
const MESH_RINGS = 5

/**
 * Debug drawing of the hill, as in the user's picture: the green base line
 * A–B–D and pole B–C, the red profile curves, the footprint outline, the flat
 * top ring, a facing arrow and A/B/C/D labels.
 */
export class HillDebug {
  private readonly parts = new Map<HillPart, Group>()
  private readonly materials: LineMaterial[] = []

  constructor(scene: Scene) {
    for (const part of ALL_PARTS) {
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

  /** Redraws everything for `hill`, on ground whose height is `heightAt`. */
  update(hill: HillShape, heightAt: HeightAt): void {
    // The ground level the hill stands on, at its pole
    const base = heightAt(hill.x, hill.z) - hill.height
    const ground = (p: Vector3, lift = LIFT) => p.setY(heightAt(p.x, p.z) + lift)
    this.clear()

    const f = (hill.facing * Math.PI) / 180
    const toD = new Vector3(Math.sin(f), 0, -Math.cos(f))
    const pole = new Vector3(hill.x, base, hill.z)
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
      this.add(part, this.line([pole.clone().setY(base + LIFT), ground(foot.clone())], FRAME, 3))

      const curve = []
      for (let i = 0; i <= STEPS; i++) {
        const p = at(dir, (i / STEPS) * length)
        curve.push(ground(p))
      }
      this.add(part, this.line(curve, PROFILE, 4))

      // Half the footprint: the ground-level outline on this side of the pole
      const half = []
      const facingAngle = Math.atan2(dir.x, -dir.z)
      for (let i = 0; i <= STEPS; i++) {
        const a = facingAngle - Math.PI / 2 + (i / STEPS) * Math.PI
        const d = new Vector3(Math.sin(a), 0, -Math.cos(a))
        half.push(ground(at(d, footRadius(hill, d))))
      }
      this.add(part, this.line(half, PROFILE, 2))
      const text = `${letter} · ${metres(length)} · foot ${shape.foot.toFixed(1)} · shoulder ${shape.shoulder.toFixed(1)}`
      this.add(part, this.label(text, ground(foot.clone(), 3)))

      // Slope mesh: the foot is the lower half of the slope, the shoulder the
      // upper half, so each checkbox shows the part its number shapes.
      this.slopeMesh(hill, dir, heightAt, `${part}Foot` as HillPart, 0, 0.5)
      this.slopeMesh(hill, dir, heightAt, `${part}Shoulder` as HillPart, 0.5, 1)
    }

    if (this.size) this.setResolution(this.size.width, this.size.height)
  }

  private size: { width: number; height: number } | null = null

  /**
   * Yellow lines draped over one side between slope positions u0 and u1
   * (0 = foot, 1 = top edge): lines running down the slope, and rings at
   * even steps across it. Where the rings bunch up, the slope is steep.
   */
  private slopeMesh(hill: HillShape, dir: Vector3, heightAt: HeightAt, part: HillPart, u0: number, u1: number): void {
    const centre = Math.atan2(dir.x, -dir.z)
    const half = (MESH_HALF_ANGLE * Math.PI) / 180
    const at = (angle: number, u: number) => {
      const d = new Vector3(Math.sin(angle), 0, -Math.cos(angle))
      const r = hill.top + (1 - u) * (footRadius(hill, d) - hill.top)
      const x = hill.x + d.x * r
      const z = hill.z + d.z * r
      return new Vector3(x, heightAt(x, z) + LIFT, z)
    }
    for (let i = 0; i < MESH_DOWN_LINES; i++) {
      const angle = centre - half + (2 * half * i) / (MESH_DOWN_LINES - 1)
      const points = []
      for (let k = 0; k <= 16; k++) points.push(at(angle, u0 + ((u1 - u0) * k) / 16))
      this.add(part, this.line(points, MESH, 1.5))
    }
    for (let j = 0; j <= MESH_RINGS; j++) {
      const u = u0 + ((u1 - u0) * j) / MESH_RINGS
      if (u <= 0 || u >= 1) continue // the foot outline and top ring are drawn already
      const points = []
      for (let k = 0; k <= 32; k++) points.push(at(centre - half + (2 * half * k) / 32, u))
      this.add(part, this.line(points, MESH, 1.5))
    }
  }

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
  private readonly calmRings: LineSegments2
  private readonly materials: LineMaterial[]

  constructor(scene: Scene) {
    const poleMaterial = new LineMaterial({ color: PROFILE, linewidth: 2, depthTest: false, transparent: true })
    const ringMaterial = new LineMaterial({ color: 0xffffff, linewidth: 1.5, depthTest: false, transparent: true, opacity: 0.5 })
    const calmMaterial = new LineMaterial({ color: 0x4dc3ff, linewidth: 2, depthTest: false, transparent: true, opacity: 0.8 })
    this.materials = [poleMaterial, ringMaterial, calmMaterial]
    this.poles = new LineSegments2(new LineSegmentsGeometry(), poleMaterial)
    this.rings = new LineSegments2(new LineSegmentsGeometry(), ringMaterial)
    this.calmRings = new LineSegments2(new LineSegmentsGeometry(), calmMaterial)
    for (const l of [this.poles, this.rings, this.calmRings]) {
      l.renderOrder = 9
      l.frustumCulled = false
      scene.add(l)
    }
  }

  setResolution(width: number, height: number): void {
    for (const m of this.materials) m.resolution.set(width, height)
  }

  setVisible(poles: boolean, rings: boolean, calmRings: boolean): void {
    this.poles.visible = poles
    this.rings.visible = rings
    this.calmRings.visible = calmRings
  }

  /** `calm` > 0 also draws where the noise's calm zone ends (rings at the foot + calm). */
  update(hills: HillShape[], spacing: number, calm: number, heightAt: HeightAt): void {
    const poles: number[] = []
    const rings: number[] = []
    const calmRings: number[] = []
    const onGround = (x: number, z: number) => [x, heightAt(x, z) + LIFT, z]
    for (const hill of hills) {
      const top = heightAt(hill.x, hill.z)
      poles.push(hill.x, top - hill.height, hill.z, hill.x, top, hill.z)
      const r = hillRadius(hill) + spacing / 2
      for (let i = 0; i < STEPS; i++) {
        const a0 = (i / STEPS) * Math.PI * 2
        const a1 = ((i + 1) / STEPS) * Math.PI * 2
        const d0 = new Vector3(Math.sin(a0), 0, -Math.cos(a0))
        const d1 = new Vector3(Math.sin(a1), 0, -Math.cos(a1))
        // Footprint outline, where the hill meets the ground
        const f0 = footRadius(hill, d0)
        const f1 = footRadius(hill, d1)
        poles.push(...onGround(hill.x + d0.x * f0, hill.z + d0.z * f0), ...onGround(hill.x + d1.x * f1, hill.z + d1.z * f1))
        rings.push(...onGround(hill.x + d0.x * r, hill.z + d0.z * r), ...onGround(hill.x + d1.x * r, hill.z + d1.z * r))
        const c0 = f0 + calm
        const c1 = f1 + calm
        calmRings.push(...onGround(hill.x + d0.x * c0, hill.z + d0.z * c0), ...onGround(hill.x + d1.x * c1, hill.z + d1.z * c1))
      }
    }
    replaceSegments(this.poles, poles)
    replaceSegments(this.rings, rings)
    replaceSegments(this.calmRings, calmRings)
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
  return hillReach(hill, d.x, d.z)
}

/** Ground height at a spot on the map. */
export type HeightAt = (x: number, z: number) => number

function dispose(object: Object3D): void {
  const o = object as Object3D & { geometry?: { dispose(): void }; material?: { dispose(): void; map?: { dispose(): void } | null } }
  o.geometry?.dispose()
  o.material?.map?.dispose()
  o.material?.dispose() // label sprites each have their own material
}
