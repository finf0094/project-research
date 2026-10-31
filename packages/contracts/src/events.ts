import { z } from 'zod'
import { Hex64, Id, Sha256, ShortText, Timestamp, safeText } from './common.ts'

export const NetState = z.enum(['online', 'slow', 'offline'])
export type NetState = z.infer<typeof NetState>

export const RiskLevel = z.enum(['low', 'medium', 'high'])
export type RiskLevel = z.infer<typeof RiskLevel>

/** Proctoring signals detected on the client. */
export const SignalKind = z.enum([
  'face_missing',
  'multiple_faces',
  'too_dark',
  'noise',
  'tab_hidden',
  'camera_off',
  'paste',
])
export type SignalKind = z.infer<typeof SignalKind>

export const AnswerValue = z.union([safeText(20_000), z.array(ShortText).max(50)])
export type AnswerValue = z.infer<typeof AnswerValue>

export const FragmentReason = z.enum(['risk', 'control', 'full'])
export type FragmentReason = z.infer<typeof FragmentReason>

// Every schema here is strict: the server verifies hashes over exactly what the client sealed,
// so silently stripping unknown keys would make an untouched chain look tampered with.
const sealed = {
  seq: z.number().int().positive(),
  /** Client estimate of server time (server time at start + monotonic clock). */
  at: Timestamp,
  prevHash: Sha256,
  hash: Sha256,
  mac: Hex64,
}

function event<T extends string, D extends z.ZodType>(type: T, data: D) {
  return z.strictObject({ ...sealed, type: z.literal(type), data })
}

const Empty = z.strictObject({})

export const Event = z.discriminatedUnion('type', [
  event('session.started', Empty),
  event('session.resumed', Empty),
  event('session.submitted', Empty),
  event('answer', z.strictObject({ questionId: ShortText, value: AnswerValue })),
  event('network.changed', z.strictObject({ from: NetState, to: NetState })),
  event('proctor.signal', z.strictObject({ kind: SignalKind, active: z.boolean() })),
  event('risk.changed', z.strictObject({ from: RiskLevel, to: RiskLevel })),
  event('hint.shown', z.strictObject({ kind: SignalKind })),
  event(
    'evidence.fragment',
    z
      .strictObject({
        reason: FragmentReason,
        tStart: Timestamp,
        tEnd: Timestamp,
        chunks: z.array(Sha256).min(1).max(30),
      })
      .refine((d) => d.tStart <= d.tEnd, 'tStart must not be after tEnd'),
  ),
  event('command.received', z.strictObject({ commandId: Id })),
])
export type Event = z.infer<typeof Event>
export type EventType = Event['type']
export type EventData<T extends EventType> = Extract<Event, { type: T }>['data']
