import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, type Scene, type Sprite, Vector3 } from 'three'
import type { HeightAt } from './hillDebug'
import { makeLabel, setLabelText } from './label'

/** A motocross bike, roughly: length, seat-high box, width (metres). */
const BIKE = { length: 2.1, height: 1.0, width: 0.8 }
/** The rider, sitting/standing on it. */
const RIDER = { length: 0.6, height: 0.9, width: 0.45 }

/**
 * Two boxes the size of a bike and rider, for a sense of scale. Sits on the
 * ground and tilts with the slope under it.
 */
export class ScaleDummy {
  private readonly group = new Group()
  private readonly label: Sprite

  constructor(scene: Scene) {
    const bike = new Mesh(
      new BoxGeometry(BIKE.width, BIKE.height, BIKE.length),
      new MeshStandardMaterial({ color: '#f07a1a' }),
    )
    bike.position.y = BIKE.height / 2
    const rider = new Mesh(
      new BoxGeometry(RIDER.width, RIDER.height, RIDER.length),
      new MeshStandardMaterial({ color: '#2a6fdb' }),
    )
    rider.position.set(0, BIKE.height + RIDER.height / 2, 0.15)
    this.label = makeLabel('')
    this.label.position.y = BIKE.height + RIDER.height + 1.2
    this.group.add(bike, rider, this.label)
    scene.add(this.group)
  }

  set visible(on: boolean) {
    this.group.visible = on
  }

  setLabel(text: string): void {
    this.label.visible = text !== ''
    if (text) setLabelText(this.label, text)
  }

  /** Puts it at (x, z) facing `heading` (0 = north, clockwise), on the ground. */
  place(x: number, z: number, heading: number, heightAt: HeightAt): void {
    const fx = Math.sin(heading)
    const fz = -Math.cos(heading)
    // Slope from the ground under the wheels and either side
    const half = BIKE.length / 2
    const front = new Vector3(x + fx * half, heightAt(x + fx * half, z + fz * half), z + fz * half)
    const back = new Vector3(x - fx * half, heightAt(x - fx * half, z - fz * half), z - fz * half)
    const right = new Vector3(x - fz * 0.5, heightAt(x - fz * 0.5, z + fx * 0.5), z + fx * 0.5)
    const left = new Vector3(x + fz * 0.5, heightAt(x + fz * 0.5, z - fx * 0.5), z - fx * 0.5)
    const forward = front.clone().sub(back).normalize()
    const side = right.clone().sub(left).normalize()
    const up = new Vector3().crossVectors(side, forward).normalize()
    const across = new Vector3().crossVectors(forward, up).normalize()
    // Boxes are built along z, so the bike's nose is local −z.
    this.group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across, up, forward.clone().negate()))
    this.group.position.set(x, (front.y + back.y) / 2, z)
  }
}
