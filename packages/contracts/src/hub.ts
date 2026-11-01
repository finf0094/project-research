import { z } from 'zod'
import { Timestamp } from './common.ts'
import { Event } from './events.ts'

/**
 * Events a classroom hub collected while the building had no internet, with the time the hub received each.
 * The hub forwards them as sealed by the device: the cloud verifies the chain with the attempt's key.
 */
export const HubBatch = z.object({
  events: z.array(z.object({ event: Event, receivedAt: Timestamp })).max(100),
})
export type HubBatch = z.infer<typeof HubBatch>
