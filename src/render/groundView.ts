import { Mesh, PlaneGeometry, type Scene, type Sprite } from 'three'
import type { Ground } from '../world/ground'
import { makeGridMaterial } from './gridMaterial'
import { makeLabel, setLabelText } from './label'

/** Draws the ground, with the cell grid (debug lines for cell size) on it. */
export class GroundView {
  private readonly material = makeGridMaterial()
  private readonly mesh = new Mesh(new PlaneGeometry(1, 1), this.material)
  private readonly label: Sprite = makeLabel('')

  constructor(scene: Scene) {
    this.mesh.rotation.x = -Math.PI / 2
    scene.add(this.mesh, this.label)
  }

  update(ground: Ground, showGrid: boolean): void {
    this.mesh.scale.set(ground.size, ground.size, 1)
    this.material.uniforms.cellSize.value = ground.cellSize
    this.material.uniforms.showGrid.value = showGrid ? 1 : 0

    const cells = ground.cells.toLocaleString('en-US')
    setLabelText(this.label, `${ground.cellSize} m cells · ${cells} × ${cells}`)
    this.label.position.set(0, 2, ground.size * 0.4) // inside the near edge
    this.label.visible = showGrid
  }
}
