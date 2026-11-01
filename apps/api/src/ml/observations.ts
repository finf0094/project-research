import type { MarkerKind } from '@exam/contracts'

/** What the server saw in one second of a recorded fragment. */
export interface Observation {
  at: number
  faces: number
  object: boolean
  /** Too dark to see anyone: a missing face then says nothing about the student. */
  dark: boolean
  /** Louder than a quiet room (media.ts LOUD_RMS) during this second. */
  loud: boolean
}

export interface Interval {
  kind: MarkerKind
  startAt: number
  endAt: number
}

/** Seconds a condition must hold before it counts; a single frame is never a finding. */
const MIN_SECONDS: Partial<Record<MarkerKind, number>> = {
  multiple_faces: 2,
  object_detected: 2,
  face_missing: 5,
  // As long as the device waits before it reports noise: a cough or a dropped pen is not a finding.
  noise: 3,
}

const CONDITIONS: [MarkerKind, (o: Observation) => boolean][] = [
  ['multiple_faces', (o) => o.faces >= 2],
  ['face_missing', (o) => o.faces === 0 && !o.dark],
  ['object_detected', (o) => o.object],
  ['noise', (o) => o.loud],
]

/** Turns per-second observations into intervals; a gap of more than 2 s between frames ends an interval. */
export function toIntervals(observations: Observation[]): Interval[] {
  const sorted = observations.toSorted((a, b) => a.at - b.at)
  const intervals: Interval[] = []
  for (const [kind, holds] of CONDITIONS) {
    let run: Observation[] = []
    const close = () => {
      if (run.length >= (MIN_SECONDS[kind] ?? 1))
        intervals.push({ kind, startAt: run[0]!.at, endAt: run.at(-1)!.at + 1000 })
      run = []
    }
    for (const o of sorted) {
      if (holds(o) && (!run.length || o.at - run.at(-1)!.at <= 2000)) run.push(o)
      else {
        close()
        if (holds(o)) run.push(o)
      }
    }
    close()
  }
  return intervals.sort((a, b) => a.startAt - b.startAt)
}
