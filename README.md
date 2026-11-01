# exam — online exams that keep working without internet

A web system for written and oral online exams with adaptive proctoring, built for unstable connections.
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
docs/           architecture document
```

Modules are imported only through their `index.ts` (enforced by ESLint).

| Web module   | Responsibility                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `offline`    | IndexedDB, event log with hash chain, server clock, connection state, sync loop, chunk upload      |
| `exam`       | student home, preflight, the written exam, finishing, results; packages for starting offline       |
| `proctoring` | on-device face/light/noise detection, hints, risk level, ring-buffer recording, evidence fragments |
| `oral`       | the live call (LiveKit): room state, own camera, the call stage and the ticket                     |
| `review`     | examiner: exam hub (overview, monitoring, review queue, results), attempt review, oral room        |
| `authoring`  | examiner: the exam editor (basics, questions with a student preview, participants)                 |
| `admin`      | users                                                                                              |
| `auth`       | sign-in, session, role routing                                                                     |

| API module          | Responsibility                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `auth`              | cookie sessions (Argon2id passwords, hashed tokens)                                            |
| `exams`, `attempts` | exam list, start/resume (per-attempt HMAC key), submit                                         |
| `sync`              | verifies and stores events append-only, projects answers, returns ack/status/deadline/commands |
| `blobs`             | upload of recorded chunks announced in the chain                                               |
| `review`            | examiner endpoints: exams, live stream (SSE), attempts, markers, decisions, publishing         |
| `results`           | a student's own result once decided and published                                              |
| `oral`              | LiveKit tokens, signed webhooks of the call (who joined and left), the answer's merged audio   |
| `preload`           | encrypted exam packages and the start code (offline start)                                     |
| `users`             | administrator: accounts                                                                        |
| `jobs`              | worker: close expired attempts, analysis into markers and a risk score, merge-audio, retention |

## Running locally

Requirements: Node.js ≥ 22.18, pnpm 10, PostgreSQL ≥ 16.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # set MASTER_KEY and DATABASE_URL (see the comments)
createdb exam                               # with -h/-p/-U matching DATABASE_URL
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

Two e2e scenarios need extra services and are switched on explicitly: `E2E_LIVEKIT=1` (a LiveKit server and the
API's `LIVEKIT_*` settings) and `E2E_OFFLINE_START=1` (`vite preview` of a fresh build on :4173, whose service
worker keeps the app and the models offline).

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
- Face, gaze and object detection run in a module Web Worker (`detector.worker.ts`) at 1–4 frames per second;
  frames are sent as transferable `ImageBitmap`s and only the microphone level is measured on the page. The
  device tier (full / lite / minimal) is measured at preflight and lowered automatically when analysis
  stays slow.
- Server-side analysis (section 17.3) uses ONNX models (UltraFace RFB-320 for faces, SSD MobileNet v1 for
  phones and books) on one frame per second of every uploaded chunk, run by the worker outside any row lock.
  A finding counts as a _discrepancy_ only inside a control fragment and only where the device's tier was
  measuring that kind; dark frames never produce "no face". Models are pinned by SHA-256 (`pnpm models`).
- Oral exams: LiveKit rooms (one per attempt) with tokens from the API; the ticket is drawn at random from the
  question pool when the attempt starts. The student's camera is recorded in full locally, as for written
  exams. LiveKit's webhooks (signed with the API secret, stored once per event id) record who joined and left the
  call; the review shows the student's time on the call with every drop. After analysis the worker's
  `merge-audio` job joins the sound of all recorded chunks, in recording order with gaps kept as silence, into
  one seekable Opus file (served with byte ranges), so the examiner can hear what was said while the call was
  down; the sound streams through a temporary file, so any exam length (up to 10 h) merges in bounded memory. Tested against LiveKit server 1.9.11 (`--dev`) with two browsers: `e2e/oral-call.spec.ts` checks that both
  sides receive live video and play live sound, that the call comes back after the student reloads, and that ending the
  exam closes it (run with `E2E_LIVEKIT=1` on a fresh seed while LiveKit and the API's `LIVEKIT_*` settings are up).
  Without `LIVEKIT_*` settings the API answers 503 and both sides see "video call unavailable".
- The recording ring (last ~3 minutes, 10 s chunks) and pending fragment requests live in IndexedDB, so a
  reload or crash loses neither.
- Languages: Russian (default), Kazakh and English through vue-i18n; each module owns its texts
  (`messages.ts`, or a `messages/` folder with one file per language) and the other languages must match the
  Russian keys at compile time.
  Kazakh dates are spelled by the app, since browsers often ship no Kazakh calendar data.
- API docs: OpenAPI generated from the Zod contracts (`@fastify/swagger`), browsable at `/api/docs`.
- Exam authoring: examiners create and edit their own exams (settings, questions with correct answers, the
  oral ticket size) and choose participants by email. Once a student has started, questions and settings are
  frozen (answers, tickets and sealed logs refer to them); participants can still change. The administrator's
  role is user management (no self sign-up); the seed has `admin@example.edu`.
- Offline start (stage 6), for sittings (a written exam whose window is at most its length plus 15 minutes): from a
  day before a sitting opens, the student's device downloads the exam sealed with AES-256-GCM under a key
  stretched (PBKDF2-SHA-256, 300 000 rounds) from the sitting's 10-character start code, together with the
  attempt id and chain key reserved for that student (kept as a non-extractable key). The examiner sees the code
  on the exam's overview once the sitting opens; with no network in the room, students type it and the attempt
  begins on the device. The first sync creates it on the server, marked "started offline": the device's start
  time is pulled into the window, and the deadline never passes the window's close, so decrypting early gains
  nothing. Editing an exam changes its code, and devices download the new package. Oral exams need the call.
- Students see their score and a question-by-question review once the examiner has decided and published;
  publishing waits until the exam and its offline window are over, since the review shows correct answers.
- Interface: two shells (a top bar for students, a sidebar for staff), design tokens with a dark theme, and a
  small motion system (page rise, staggered entrances, counters, a live pulse, list moves) that switches off for
  people who ask for reduced motion.
- Runtime: Node.js 22.18+ (type stripping) instead of 24; no reka-ui (native `<dialog>` and inputs suffice).

**Section 25 (directions for development), in a first version**

- 25.1 Classroom hub: `pnpm --filter @exam/api hub` on a room's mini-PC (`HUB_UPSTREAM`, `HUB_TOKEN`, the same
  token as the cloud's `HUB_TOKEN`; Caddy on the hub serves the SPA and sends `/api` to it). The hub passes every
  request to the cloud. When the building loses the internet it answers the devices' event syncs itself: the
  sealed events are kept on its disk (one file per attempt, replaced atomically) and acknowledged, and a
  forwarder delivers them as soon as the cloud answers. Only the session that last synced an attempt through the
  cloud may add to it, and the cloud verifies every relayed event with keys the hub never holds, so a hub cannot
  alter anything; the hub's receipt times are believed only between the event's own time and the cloud's now.
  Starting an exam needs the cloud (or a downloaded package, see offline start); uploads of recordings wait.
  The hub answers within 3 s and then treats the cloud as away for a while, since a stalling link is the usual
  case; it reports how far it holds the events (`relayedSeq`) while the cloud's acknowledgement stays the cloud's,
  so a device keeps its events until the cloud has them and can send them directly if it leaves the room.
  Attempts with relayed events are marked for the examiner, as the hub's receipt times are taken on trust (its
  `HUB_TOKEN` must be guarded like a server secret: with it and a student's own key, receipt times could be
  backdated). The hub keeps the cloud's clock, so a mini-PC running slow does not move deadlines. Devices
  must reach the hub under the exam's usual address (room DNS and a certificate for it): cookies and
  on-device data belong to that address. Update the hubs before the cloud: the cloud answers 410 for a removed attempt, which an older hub would keep retrying.
- 25.2 Attention budget: the live alerts feed shows at most two alerts a minute, the most important first;
  ordinary ones may take only one of them, so a high-risk alert always finds room. The rest of that minute
  folds into a single "and N more" line, and the student list still shows every change
  (`review/attention-budget.ts`).
- 25.3 Individual exceptions: in the participants tab an examiner can stop tracking chosen signals for one student
  (for example voice for a student who reads aloud). The student's proctor does not watch them, and analysis
  drops markers of those kinds; the list survives re-saving participants and travels in the offline package.
- 25.4 Calibration: the "Калибровка" page shows, per marker kind, how often the examiner confirmed or dismissed
  it. After five decisions a kind that is mostly dismissed weighs less in the review priority (down to ×0.25);
  a reliable kind is never raised, and nothing is decided automatically. A control sample shows how many
  reviewed attempts without markers still turned out to be violations — what the markers miss.
- 25.5 Scaling: the API is stateless (sessions and attempts live in Postgres), so several instances run behind
  a balancer; live monitoring goes between them through Postgres LISTEN/NOTIFY instead of Redis/NATS, and
  workers claim jobs with `FOR UPDATE SKIP LOCKED` and leases, so they scale by adding processes. Partitioning
  the events table and a MinIO cluster are deployment work not done here.
