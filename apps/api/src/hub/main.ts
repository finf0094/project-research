import { z } from 'zod'
import { buildHub } from './app.ts'
import { forwardAll } from './forwarder.ts'
import { fileStore } from './store.ts'

// The classroom hub's process: `node --env-file=.env src/hub/main.ts` on the room's mini-PC.
const env = z
  .object({
    HUB_UPSTREAM: z.url(),
    HUB_TOKEN: z.string().min(32),
    HUB_DIR: z.string().default('./hub-data'),
    HUB_PORT: z.coerce.number().int().default(3100),
  })
  .parse(process.env)

const store = fileStore(env.HUB_DIR)
const upstream = { url: () => env.HUB_UPSTREAM.replace(/\/$/, ''), token: env.HUB_TOKEN }
const app = buildHub({ store, upstream })
await app.listen({ port: env.HUB_PORT, host: '0.0.0.0' })
console.log(`hub on :${env.HUB_PORT}, cloud ${env.HUB_UPSTREAM}`)

// What the room collected goes up as soon as the cloud answers again.
// A pass waits for the previous one: during a stalling outage they would pile up otherwise.
let forwarding = false
setInterval(() => {
  if (forwarding) return
  forwarding = true
  void forwardAll(store, upstream).finally(() => (forwarding = false))
}, 10_000)
