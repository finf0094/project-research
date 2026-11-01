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

export function median(values: readonly number[]): number {
  if (!values.length) return 0
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!
}
