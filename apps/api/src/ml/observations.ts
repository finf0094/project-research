import type { MarkerKind } from '@exam/contracts'

/** What the server saw in one second of a recorded fragment. */
export interface Observation {
  at: number
  faces: number
  object: boolean
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
}

const CONDITIONS: [MarkerKind, (o: Observation) => boolean][] = [
  ['multiple_faces', (o) => o.faces >= 2],
  ['face_missing', (o) => o.faces === 0],
  ['object_detected', (o) => o.object],
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
