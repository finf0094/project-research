# exam — online exams that keep working without internet

A web system for written online exams with adaptive proctoring, built for unstable connections.
Everything a student does is sealed into a tamper-evident event log on the device first; a sync loop
delivers it whenever the network allows. The architecture is described in
[`docs/system_architecture.docx`](docs/system_architecture.docx).

## Repository

```
apps/
  api/          Fastify API + background worker (Node.js, PostgreSQL, Drizzle)
  web/          Vue 3 SPA (native CSS, IndexedDB, MediaPipe)
packages/
  contracts/    Zod schemas shared by client and server
  integrity/    canonical JSON, SHA-256 hash chain, HMAC — the same code on both sides
docs/           literature review and architecture document
```

Modules are imported only through their `index.ts` (enforced by ESLint).

| Web module   | Responsibility                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `offline`    | IndexedDB, event log with hash chain, server clock, connection state, sync loop, chunk upload      |
| `exam`       | preflight, the exam itself, finishing and submission                                               |
| `proctoring` | on-device face/light/noise detection, hints, risk level, ring-buffer recording, evidence fragments |
| `review`     | examiner: exams, live monitoring, attempt review with markers and fragments, decisions             |
| `auth`       | sign-in, session, role routing                                                                     |

| API module          | Responsibility                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `auth`              | cookie sessions (Argon2id passwords, hashed tokens)                                            |
| `exams`, `attempts` | exam list, start/resume (per-attempt HMAC key), submit                                         |
| `sync`              | verifies and stores events append-only, projects answers, returns ack/status/deadline/commands |
| `blobs`             | upload of recorded chunks announced in the chain                                               |
| `review`            | examiner endpoints                                                                             |
| `jobs`              | worker: close expired attempts, analyze into markers and a risk score, retention               |

## Running locally

Requirements: Node.js ≥ 22.18, pnpm 10, PostgreSQL ≥ 16.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # set MASTER_KEY (see the comment in the file)
createdb exam
pnpm --filter @exam/api db:migrate
pnpm --filter @exam/api seed               # teacher@example.edu / student1@example.edu, password "password"

pnpm --filter @exam/api dev                # API on :3000
pnpm --filter @exam/api worker             # background jobs
pnpm --filter @exam/web dev                # app on :5173 (proxies /api)
```

## Checks

```bash
pnpm lint          # ESLint, including module boundaries
pnpm typecheck
pnpm test          # unit tests; API tests need a database exam_test (TEST_DATABASE_URL)
pnpm --filter @exam/web e2e   # Playwright, against the running stack with a fresh seed
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit and API tests and the web build.

## Production-like stack

```bash
MASTER_KEY=$(node -e "console.log(crypto.randomBytes(32).toString('base64'))") \
  docker compose -f infra/docker-compose.yml up --build
docker compose -f infra/docker-compose.yml run --rm api node src/db/migrate.ts
```

Caddy serves the built SPA (with its service worker) and proxies `/api`; API and worker share one image.

## Differences from the architecture document

Deliberate simplifications (KISS) and things not built yet — stated here so the code and the document never disagree silently.

**Simplified**

- Worker queue: a polling loop over PostgreSQL (`SELECT … FOR UPDATE SKIP LOCKED`) instead of pg-boss.
- Recordings: filesystem `BlobStorage` behind an interface (S3/MinIO plugs in there); the examiner gets chunks
  through the API, not presigned links.
- Live monitoring: the examiner page polls every 5 s instead of SSE.
- API paths: `/attempts/:id/sync`, `/attempts/:id/chunks/:hash`, `/examiner/*` instead of `/sync`, `/blobs/{sha}`,
  `/review/*`. Deadline extensions and termination reach the client as `deadline`/`status` in the sync response,
  not as separate commands (commands are `warn` and `capture`).
- Append-only event log: enforced by database triggers (UPDATE/DELETE/TRUNCATE), not by role grants.
- Final answers are projected during sync and rebuilt from the log during analysis (no separate job).
- Face detection runs on the main thread at 1–4 frames per second instead of a Web Worker.
- The recording ring buffer (last ~3 minutes) lives in memory: a reload loses it and any fragment still waiting
  for future chunks. Pinned fragments are in IndexedDB and survive.
- Runtime: Node.js 22.18+ (type stripping) instead of 24; no reka-ui (native `<dialog>` and inputs suffice).

**Not implemented yet**

- Server-side re-analysis of fragments with ML models (section 17.3); the server does reconcile control
  fragments it asked for but never received.
- Head pose / gaze and object detection on the client; device performance tiers with automatic downgrade;
  Wake Lock.
- Oral exam (LiveKit), exam authoring UI, admin role, KK/EN translations (vue-i18n), Swagger docs,
  room hub for classrooms.
