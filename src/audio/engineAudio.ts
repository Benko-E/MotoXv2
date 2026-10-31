import type { EngineSound } from './engineSynth'
import workletUrl from './engineWorklet.ts?worker&url'

/** Plays the engine. Browsers only allow sound after a key press or click, so `start()` waits for one. */
export class EngineAudio {
  private node: AudioWorkletNode | null = null
  private context: AudioContext | null = null

  /** Call on every key press and click: the first starts it, later ones wake it if the browser held it back. */
  start(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }
    const context = new AudioContext()
    this.context = context
    context.audioWorklet
      .addModule(workletUrl)
      .then(() => {
        this.node = new AudioWorkletNode(context, 'engine', { outputChannelCount: [2] })
        this.node.connect(context.destination)
      })
      .catch((error) => console.warn('Engine sound could not start:', error))
  }

  update(sound: EngineSound): void {
    this.node?.port.postMessage(sound)
  }
}
