# EchoType

An annotated typing practice web app for English learners to repeatedly type
personally meaningful texts with self-written native-language notes.

> Current stage: **walking skeleton** — end-to-end create course → type → persist
> session, on top of a local Postgres + Fastify + React stack.

## Stack (walking skeleton)

- Web: React 18 + Vite + TypeScript + Tailwind, React Router v6, Zustand, TanStack Query
- API: Node 20+ / Fastify v5 + Prisma 5 + Zod (REST + manual `safeParse`)
- DB: PostgreSQL 15 (local docker compose)
- Shared: `@echotype/shared` exposes Zod schemas and inferred TS types to both apps
- Auth: deferred — every request is pinned to the seeded `demo-user` (replaced by
  AWS Cognito at the cloud stage)

## Repository layout

```
.
├── apps/
│   ├── api/        Fastify + Prisma backend
│   └── web/        Vite + React frontend
├── packages/
│   └── shared/     Zod schemas shared by web + api
├── docker-compose.yml
└── docs/project-kickoff.md
```

## Prerequisites

- Node.js 20+ (or 22). `.nvmrc` pins 20.
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop

## First-time setup

```bash
pnpm install
docker compose up -d                    # start Postgres
cp apps/api/.env.example apps/api/.env  # local env
pnpm --filter @echotype/api prisma:generate
pnpm --filter @echotype/api prisma:migrate   # creates `init` migration the first time
pnpm --filter @echotype/api seed             # seeds demo user + 2 sample courses
```

## Daily dev

```bash
docker compose up -d                                # ensure DB is up
pnpm --filter @echotype/api dev                     # Fastify on :3001
pnpm --filter @echotype/web dev                     # Vite on :5173
```

The web dev server proxies `/api/*` to `http://localhost:3001`, so the frontend
only ever talks to `/api/...`.

## Smoke test

```bash
curl http://localhost:3001/health
curl http://localhost:3001/courses | jq
```

Then open `http://localhost:5173`, go to **Courses**, create one, click **Type
this**, type a few characters, and hit **End session & save**.

To inspect the DB:

```bash
docker exec -it echotype_postgres psql -U echotype -d echotype
# or
pnpm --filter @echotype/api prisma:studio
```

## Reset DB

```bash
pnpm --filter @echotype/api prisma:reset
pnpm --filter @echotype/api seed
```

## API surface (walking skeleton)

- `GET  /health` — liveness
- `GET  /courses` — list current (demo) user's courses, newest first
- `GET  /courses/:id` — single course
- `POST /courses` — create course (`{title, content, mode: 'SHORT'|'ARTICLE', categoryId?}`)
- `POST /sessions` — persist a typing session
- `GET  /sessions?courseId=...` — recent sessions

All requests are implicitly attributed to `DEMO_USER_ID` (default `demo-user`).
This shim will be replaced by Cognito JWT verification in the cloud stage.

## What is intentionally NOT in walking skeleton

Annotations (schema is in place but no UI), loop / pause / reset-on-cycle, IME
detection, paste accounting, 30 s heartbeat backup, category UI, auth. See
`docs/project-kickoff.md` for the full vision.
