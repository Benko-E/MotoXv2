import { EngineSynth, type EngineSound } from './engineSynth'

// The audio worklet's own globals (not in the DOM types).
declare const sampleRate: number
declare function registerProcessor(name: string, processor: unknown): void
declare class AudioWorkletProcessor {
  readonly port: MessagePort
}

/** Runs the engine synth on the audio thread; the game posts it what the engine is doing. */
class EngineProcessor extends AudioWorkletProcessor {
  private readonly synth = new EngineSynth(sampleRate)

  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent<EngineSound>) => this.synth.set(e.data)
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channels = outputs[0]
    this.synth.render(channels[0])
    for (let c = 1; c < channels.length; c++) channels[c].set(channels[0])
    return true
  }
}

registerProcessor('engine', EngineProcessor)
