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
```

## Deliberate simplifications compared to the architecture document

- **Worker queue**: a polling loop over PostgreSQL (`SELECT … FOR UPDATE SKIP LOCKED`) instead of pg-boss.
- **Recordings storage**: a filesystem `BlobStorage` for development; production plugs in S3/MinIO behind the same interface.
- **Live monitoring**: the examiner page polls every 5 s instead of SSE.
- **Face detection** runs on the main thread at 1–4 frames per second instead of a Web Worker (a few ms per second).
- **Not implemented yet**: server-side re-analysis of fragments with ML models, the oral exam (LiveKit), exam authoring UI,
  KK/EN translations, room hub for classrooms.
