import { median } from './stats'

/** How often the microphone is sampled, and how many samples make up "now" (one second). */
const SAMPLE_MS = 50
const WINDOW = 20

/**
 * The microphone's level as the median of the last second's short samples. A voice, even a whisper,
 * keeps most samples up; a key click or a cough raises one or two and leaves the median where it was.
 */
export function createLoudnessMeter(analyser: AnalyserNode) {
  const samples = new Float32Array(analyser.fftSize)
  const recent: number[] = []
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const s of samples) sum += s * s
    recent.push(Math.sqrt(sum / samples.length))
    if (recent.length > WINDOW) recent.shift()
  }, SAMPLE_MS)
  return {
    level: () => median(recent),
    stop: () => clearInterval(timer),
  }
}

/** Gestures that may start sound. iOS Safari does not count `pointerdown`; it does count the touch's end. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const

/**
 * The microphone's level from a Web Audio analyser on the stream. Where Web Audio cannot run (missing,
 * or iOS refusing yet another AudioContext) the level stays 0, "quiet": the camera and the exam go on.
 * A context that is suspended (no gesture yet, e.g. after a reload) or, on iPhone, "interrupted" (a call,
 * Siri, the app in the background) does not come back on its own: it is resumed at the next touch or return.
 */
export function listenToMicrophone(stream: MediaStream): { level: () => number; stop: () => void } {
  let audio: AudioContext | undefined
  let meter: ReturnType<typeof createLoudnessMeter>
  try {
    audio = new AudioContext()
    const analyser = audio.createAnalyser()
    analyser.fftSize = 2048 // ~43 ms at 48 kHz: sampled every 50 ms, the samples cover most of the second
    audio.createMediaStreamSource(stream).connect(analyser)
    meter = createLoudnessMeter(analyser)
  } catch (error) {
    console.error('the microphone level cannot be measured in this browser', error)
    void audio?.close().catch(() => undefined)
    return { level: () => 0, stop: () => undefined }
  }
  const context = audio
  const resume = () => {
    const state = context.state as string
    if (state !== 'running' && state !== 'closed') void context.resume().catch(() => undefined)
  }
  for (const type of GESTURES) window.addEventListener(type, resume, true)
  document.addEventListener('visibilitychange', resume)
  resume()
  return {
    level: meter.level,
    stop() {
      for (const type of GESTURES) window.removeEventListener(type, resume, true)
      document.removeEventListener('visibilitychange', resume)
      meter.stop()
      void context.close().catch(() => undefined)
    },
  }
}
