import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, type Scene } from 'three'
import type { Ground } from '../world/ground'
import { CHUNK_CELLS } from './lod'

const LIFT = 0.1 // metres above the ground
/** Border lines follow the ground at most this many points per side. */
const MAX_POINTS_PER_LINE = 1024

/** LoD debug: lines along every chunk border, following the ground. */
export class ChunkBorders {
  private readonly lines = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false }),
  )

  constructor(scene: Scene) {
    this.lines.renderOrder = 8
    scene.add(this.lines)
  }

  get visible(): boolean {
    return this.lines.visible
  }

  set visible(on: boolean) {
    this.lines.visible = on
  }

  update(ground: Ground): void {
    const { cells, cellSize } = ground
    const half = ground.size / 2
    const stride = Math.max(1, Math.ceil(cells / MAX_POINTS_PER_LINE))
    const along: number[] = []
    for (let i = 0; i < cells; i += stride) along.push(i)
    along.push(cells)

    const borders: number[] = []
    for (let b = 0; b < cells; b += CHUNK_CELLS) borders.push(b)
    borders.push(cells)

    const points: number[] = []
    const add = (ix: number, iz: number) => {
      const x = -half + ix * cellSize
      const z = -half + iz * cellSize
      points.push(x, ground.heightAt(x, z) + LIFT, z)
    }
    for (const b of borders) {
      for (let k = 0; k < along.length - 1; k++) {
        add(along[k], b) // runs along x
        add(along[k + 1], b)
        add(b, along[k]) // runs along z
        add(b, along[k + 1])
      }
    }

    this.lines.geometry.dispose()
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3))
    this.lines.geometry = geometry
  }
}
