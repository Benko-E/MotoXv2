import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three'

/** Label height as a share of the screen height, at any distance. */
const SCREEN_HEIGHT = 0.035
const FONT_PX = 48
const PAD_PX = 16

/** A text tag in the world that stays the same size on screen and draws on top. */
export function makeLabel(text: string): Sprite {
  const material = new SpriteMaterial({ sizeAttenuation: false, depthTest: false, transparent: true })
  const sprite = new Sprite(material)
  sprite.renderOrder = 10
  setLabelText(sprite, text)
  return sprite
}

export function setLabelText(sprite: Sprite, text: string): void {
  if (sprite.userData.text === text) return
  sprite.userData.text = text

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `600 ${FONT_PX}px system-ui, sans-serif`
  ctx.font = font
  canvas.width = Math.ceil(ctx.measureText(text).width) + PAD_PX * 2
  canvas.height = FONT_PX + PAD_PX * 2

  ctx.fillStyle = 'rgba(20, 22, 26, 0.75)'
  ctx.beginPath()
  ctx.roundRect(0, 0, canvas.width, canvas.height, 16)
  ctx.fill()
  ctx.font = font // resizing the canvas resets it
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, PAD_PX, canvas.height / 2)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const material = sprite.material
  material.map?.dispose()
  material.map = texture
  material.needsUpdate = true
  sprite.scale.set((SCREEN_HEIGHT * canvas.width) / canvas.height, SCREEN_HEIGHT, 1)
}
