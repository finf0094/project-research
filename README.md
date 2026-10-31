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
- Live monitoring: Server-Sent Events per exam (`GET /examiner/exams/:id/stream`), fed by PostgreSQL
  `LISTEN/NOTIFY` from a trigger on `attempts`, so changes made by the worker process arrive too and several
  API instances need no extra pub/sub. The page reloads the list on each event (at most twice a second) and every 15 s; the periodic reload also
  shows students who went silent as offline, since that changes no row.
- API paths: `/attempts/:id/sync`, `/attempts/:id/chunks/:hash`, `/examiner/*` instead of `/sync`, `/blobs/{sha}`,
  `/review/*`. Deadline extensions and termination reach the client as `deadline`/`status` in the sync response,
  not as separate commands (commands are `warn` and `capture`).
- Append-only event log: enforced by database triggers (UPDATE/DELETE/TRUNCATE), not by role grants.
- Final answers are projected during sync and rebuilt from the log during analysis (no separate job).
- Face, gaze and object detection run on the main thread at 1–4 frames per second instead of a Web Worker;
  the device tier (full / lite / minimal) is measured at preflight and lowered automatically when analysis
  stays slow.
- Server-side analysis (section 17.3) uses ONNX models (UltraFace RFB-320 for faces, SSD MobileNet v1 for
  phones and books) on one frame per second of every uploaded chunk, run by the worker outside any row lock.
  A finding counts as a _discrepancy_ only inside a control fragment and only where the device's tier was
  measuring that kind; dark frames never produce "no face". Models are pinned by SHA-256 (`pnpm models`).
- Oral exams: LiveKit rooms (one per attempt) with tokens from the API; the ticket is drawn at random from the
  question pool when the attempt starts. The student's camera is recorded in full locally, as for written
  exams. Tested against LiveKit server 1.9.11 (`--dev`) with two browsers: `e2e/oral-call.spec.ts` checks that both
  sides receive live video and play live sound, that the call comes back after the student reloads, and that ending the
  exam closes it (run with `E2E_LIVEKIT=1` on a fresh seed while LiveKit and the API's `LIVEKIT_*` settings are up).
  Without `LIVEKIT_*` settings the API answers 503 and both sides see "video call unavailable".
- The recording ring (last ~3 minutes, 10 s chunks) and pending fragment requests live in IndexedDB, so a
  reload or crash loses neither.
- Languages: Russian (default), Kazakh and English through vue-i18n; each module owns its texts
  (`modules/*/messages.ts`) and the other languages must match the Russian keys at compile time.
  Kazakh dates are spelled by the app, since browsers often ship no Kazakh calendar data.
- Runtime: Node.js 22.18+ (type stripping) instead of 24; no reka-ui (native `<dialog>` and inputs suffice).

**Not implemented yet**

- Exam authoring UI and an admin role (exams come from `pnpm seed` or SQL), Swagger docs, the room hub for
  classrooms.
