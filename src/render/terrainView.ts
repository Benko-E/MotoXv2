import { Box3, BufferGeometry, Color, Group, Mesh, type Scene, type ShaderMaterial, type Sprite, Vector3 } from 'three'
import type { Ground } from '../world/ground'
import { buildChunkGeometry } from './chunkGeometry'
import { ChunkBorders } from './chunkBorders'
import { makeGridMaterial, makeSharedGroundUniforms } from './gridMaterial'
import { makeLabel, setLabelText } from './label'
import { chunkRanges, lodLevel, MAX_LEVEL } from './lod'

/** LoD debug tint per level: green (full detail) through to dark red. */
const LEVEL_TINTS = ['#3fbf3f', '#d6d63a', '#f0a030', '#e8602c', '#c8342c', '#8e2420', '#5a1a18']
const TINT_STRENGTH = 0.55

type Chunk = {
  xr: { start: number; end: number }
  zr: { start: number; end: number }
  box: Box3
  mesh: Mesh
  level: number
}

/**
 * Draws the ground as chunks whose detail drops with distance from the
 * camera, plus the cell-grid label and the LoD debug view (tints, borders).
 */
export class TerrainView {
  private readonly group = new Group()
  private readonly shared = makeSharedGroundUniforms()
  private readonly materials: ShaderMaterial[]
  private readonly borders: ChunkBorders
  private readonly label: Sprite = makeLabel('')
  private chunks: Chunk[] = []
  private ground: Ground | null = null
  private detailDistance = 150

  constructor(scene: Scene) {
    this.materials = LEVEL_TINTS.map((c) => makeGridMaterial(this.shared, new Color(c)))
    this.borders = new ChunkBorders(scene)
    scene.add(this.group, this.label)
  }

  get chunkCount(): number {
    return this.chunks.length
  }

  /** Triangles in the ground at the current detail levels, skirts included. */
  get triangleCount(): number {
    let n = 0
    for (const chunk of this.chunks) n += (chunk.mesh.geometry.getIndex()?.count ?? 0) / 3
    return n
  }

  /** Replaces the ground; chunk shapes are built by the next updateLod. */
  update(ground: Ground): void {
    for (const chunk of this.chunks) chunk.mesh.geometry.dispose()
    this.group.clear()
    this.ground = ground
    this.shared.cellSize.value = ground.cellSize

    const ranges = chunkRanges(ground.cells)
    const half = ground.size / 2
    this.chunks = []
    for (const zr of ranges) {
      for (const xr of ranges) {
        const [low, high] = heightRange(ground, xr, zr)
        const box = new Box3(
          new Vector3(-half + xr.start * ground.cellSize, low, -half + zr.start * ground.cellSize),
          new Vector3(-half + xr.end * ground.cellSize, high, -half + zr.end * ground.cellSize),
        )
        const mesh = new Mesh(new BufferGeometry(), this.materials[0])
        this.group.add(mesh)
        this.chunks.push({ xr, zr, box, mesh, level: -1 })
      }
    }

    this.borders.update(ground)
    const cells = ground.cells.toLocaleString('en-US')
    setLabelText(this.label, `${round(ground.cellSize)} m cells · ${cells} × ${cells}`)
    this.label.position.set(0, ground.heightAt(0, ground.size * 0.4) + 2, ground.size * 0.4)
  }

  /** Picks each chunk's detail level from its distance to `eye`. */
  updateLod(eye: Vector3): void {
    if (!this.ground) return
    for (const chunk of this.chunks) {
      const level = lodLevel(chunk.box.distanceToPoint(eye), this.detailDistance)
      if (level === chunk.level) continue
      chunk.level = level
      chunk.mesh.geometry.dispose()
      chunk.mesh.geometry = buildChunkGeometry(this.ground, chunk.xr, chunk.zr, 2 ** level)
      chunk.mesh.material = this.materials[Math.min(level, MAX_LEVEL)]
    }
  }

  setDetailDistance(d: number): void {
    this.detailDistance = d
  }

  setShowGrid(on: boolean): void {
    this.shared.showGrid.value = on ? 1 : 0
    this.label.visible = on
  }

  /** LoD debug view: tints by level and chunk borders. */
  setDebug(on: boolean): void {
    this.shared.tintAmount.value = on ? TINT_STRENGTH : 0
    this.borders.visible = on
  }

  setWireframe(on: boolean): void {
    for (const m of this.materials) m.wireframe = on
  }
}

/** Lowest and highest stored height inside a chunk. */
function heightRange(
  ground: Ground,
  xr: { start: number; end: number },
  zr: { start: number; end: number },
): [number, number] {
  let low = Infinity
  let high = -Infinity
  for (let iz = zr.start; iz <= zr.end; iz++) {
    const row = iz * ground.samples
    for (let ix = xr.start; ix <= xr.end; ix++) {
      const h = ground.heights[row + ix]
      if (h < low) low = h
      if (h > high) high = h
    }
  }
  return [low, high]
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
