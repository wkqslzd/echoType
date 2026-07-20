# EchoType

**Repeat, type, and remember meaningful English texts**

*Practice English typing with your own annotated texts.*

**Live:** [echotype.ink](https://echotype.ink)

EchoType is a typing tool where you load up any text (poems, speeches, quotes, essays) and just type through it on loop. Good for moments when your brain needs something to do without actual thinking.

You can add custom annotations to phrases beforehand; the notes stay visible as you type, so glosses stay in context instead of a separate glossary. Sign in to keep your texts and practice history; or browse and type the sample courses as a guest.

The name comes from echo — a voice returning. I built it because I wanted to revisit texts I actually care about through repetitive typing, until the words and rhythm sink in.

![EchoType in action](docs/product-screenshot.png)

Since I am a Chinese native speaker, I can also pin native-language annotations above unfamiliar English words to keep them visible while typing. But the heart is the loop: choose a text I want to remember, type it, return to it.

---

## Differentiators

- **Choose your own meaningful text** — Courses are passages and short articles you pick and keep (e.g. *Stray Birds*, favorite quotes). No random word lists; the text itself is the point.
- **Quiet repetition over WPM** — The session is for low-pressure review and muscle memory, not speed leaderboards. Auto-loop restarts the passage on completion; a session timer with pause supports timeboxed practice.
- **Low-pressure modes** — *Immersive mode* hides the input box so you type against the passage itself. *Forgiving mode* relaxes accuracy grading: spaces, punctuation, and Latin letter case are ignored, while letters and numbers still must match.
- **Native-language annotation overlay** — Optional notes in your own language float above anchored English characters while you type, so glosses stay in context instead of a separate glossary. On the typing page, long notes can widen into unused line space on the same row (without covering the next note).
- **Notes survive edits** — If you change the source text later, your notes are not silently wiped. The app shows you which notes still align and which need your attention before saving.
- **Your courses are portable plain text** — Import a `.txt` with inline `{phrase}{annotation}` markers to create a fully annotated course in one step (parse errors point at the offending line); export any course back to the same format for local backup. The parser and serializer are shared, round-trip-tested pure functions that run entirely in the browser — no upload, no extra cloud cost.
- **Honest practice stats** — Manual saves write per-session rows (WPM, accuracy, loops, active time); courses keep materialized cumulative stats and collections roll them up. Signed-in users also see a home summary of total practice time and completed passes across all courses — a JWT-backed read aggregate over those existing course columns, not a second set of user-level counters. One written contract (`docs/STATS.md`) defines every stored formula.
- **Try before sign-up** — Guests browse and type sample courses from a local catalog; sign in (email/password or Google) to persist courses, collections, and saved practice sessions in PostgreSQL. The same email maps to one EchoType account whether you register with password or continue with Google.

---

## Tech Stack

The stack is conventional React/Node/Postgres. The interesting choices are around correctness — most visibly annotation alignment (type contracts, measurement-driven layout, atomic replacement). The typing engine follows the same discipline: keystrokes are graded by aligned comparison rather than naive string equality (newline auto-skip, IME-aware composition, strict vs forgiving grading), and every stored stat — session rows, course cumulative, collection rollups — is defined by formula in `docs/STATS.md`. Course text is whitespace-normalized once when content is confirmed — never per keystroke — by a shared, unit-tested pure function that preserves intentional blank lines between passages (up to two) while trimming edges and collapsing longer runs.

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript end-to-end** | Shared contracts across web, API, and a common types package. Inclusive range-index off-by-one bugs are caught at compile time, not in misaligned overlays. |
| Contracts | **Zod in a shared package** | Same course and annotation payload parsing on client and server; mode-length rules live next to the types the editor imports. |
| API + DB | **Fastify 5 + Prisma + PostgreSQL** | Small REST surface; courses own annotations replaced atomically inside one database transaction on update. |
| Anchor snapshots | **Server-derived only** | Clients send character indices and note text; the API derives the anchored substring at save time so stored snapshots cannot be spoofed. |
| Overlay layout | **Mirror measurement + global indices** | A hidden mirror measures per-character `offsetTop` for visual-line breaks and per-glyph `getBoundingClientRect` for horizontal edges (charEdges); annotations are stored as global indices. Post-layout width rules widen note labels and separate touching highlight bands without re-measuring on each keystroke. |
| Frontend | **React 18 + Vite + Tailwind** | Component model fits a measurement-heavy overlay; utilities keep the typing surface simple without a heavy design system. |
| State | **Zustand + TanStack Query** | Local typing UI state vs server-backed course list and mutations. |
| Auth | **AWS Cognito (email/password SRP + Google IdP) + JWT in Fastify** | Email/password or Continue with Google (Hosted UI, `openid email profile`). Cognito `sub` is the user primary key; Postgres `users.email` is the account identity source of truth so Google and password sign-in link to one profile. A Google-only account can add a password later: since the pool authenticates by email and a federated username (`Google_<sub>`) is unreachable by email-based auth, the API rebuilds it as a native user (create → set password → migrate the Postgres `id` via `ON UPDATE CASCADE` → delete orphan → relink), create-first with compensating cleanup so any step can fail safely. Guests browse and type sample courses from `localStorage`; signed-in users persist data in PostgreSQL. New accounts with zero courses receive a one-time onboarding seed (`POST /api/onboarding/seed`). Public [privacy policy](https://echotype.ink/privacy) (includes Google OAuth disclosure). |
| Regression guard | **Playwright probes (local) + unit tests** | Stop-loss scripts after overlay/layout/auth changes; alignment and stats helpers unit-tested (`node:test`). |
| Observability | **Sentry (web + API)** | `@sentry/react` + Vite plugin (source maps uploaded in CI, not published to S3); `@sentry/node` on Fastify. DSNs in SSM; release = deploy git sha. |
| Cloud | **EC2 + RDS + S3 + CloudFront + SSM + GitHub Actions OIDC** | One CloudFront distribution serves the SPA (S3/OAC) and `/api/*` (EC2) on **https://echotype.ink** — same-origin HTTPS, no mixed content. ACM certificate (us-east-1) and DNS are Terraform-managed; CI deploys API via OIDC + SSM and frontend via `deploy-web.yml` (S3 sync + invalidation). |

---

## Core engineering challenge: keeping annotations aligned with text

The product loop is intentionally simple: pick a text, type it, repeat. The engineering depth is in making annotations stay aligned with that text — even as the user edits the source, even across line breaks and CJK/Latin glyph widths.

**Rendering:** I store annotations as global string indices, not row/column coordinates. At render time, a hidden mirror uses per-character `offsetTop` for visual-line breaks and per-glyph `getBoundingClientRect` for horizontal edges. Highlight bands and note labels are positioned from those measurements, including cross-line spans and mixed-width glyphs (CJK/Latin punctuation included — not `index × average width`).

**Post-measurement rendering passes:** charEdges answer *where* each anchor sits; separate passes adjust *how wide* labels and highlight bands draw. They never move anchor positions and never run inside the measurement hook, so typing stays performant.

- **Note width extension (typing page):** When a gloss is longer than its anchored phrase, the bubble may extend rightward into empty pixels on the same visual line. Extension uses pixel gaps and word-aware wrap simulation (English breaks at spaces; CJK per character), capped so it does not cross line boundaries or crowd the next note (minimum 4px). If space still is not enough, the native two-line clamp shows an ellipsis; truncated notes remain clickable for the full text.
- **Adjacent bands:** Touching phrases on the same visual line get a 3px gap in the leading highlight band so they do not fuse (note positions unchanged).

**Editing:** When the user changes the source text on an annotated course, blindly keeping old indices would point notes at the wrong words. Phase 4 replaced an earlier "content change clears all annotations" rule with a review flow:

1. Each annotation's saved text snapshot is compared to the substring at its current indices.
2. **Green** — slice still matches.
3. **Yellow** — mismatch or out-of-range; user **re-selects** a new anchor or **deletes** the note.
4. Step 3 blocks **Next** while yellow items remain; Step 4 blocks **Save**; the server rejects invalid state with structured validation errors.
5. On save, the API re-derives snapshots from the final text.

A subtle UX bug: yellow bands reused Phase 3's "click to edit note text" behavior, but users wanted re-anchoring. I split the click behavior by review state — in review mode, yellow clicks enter re-anchor flow, not note editing.

---

## Architecture

### Frontend

![Frontend architecture](docs/architecture.png)

One shared overlay component and one measurement hook (mirror spans → `offsetTop` line breaks → per-glyph `getBoundingClientRect` / charEdges) power both the typing page and the four-step course editor. Post-layout rules in `buildLineData` / `noteExtension.ts` handle note widening (typing page) and adjacent-band seams. The editor adds a staged state machine; Phase 4's review layer (green/yellow status, review panel, review-state click routing) sits on top without forking the renderer.

### Deployment

![Deployment architecture](docs/deployment.png)

**Terraform** provisions VPC, EC2, RDS, S3, CloudFront, and Cognito. Production runs at **https://echotype.ink**: a single CloudFront distribution terminates TLS (ACM, us-east-1), serves the Vite build from private S3 via OAC, and proxies `/api/*` to the Fastify container on EC2 (port 80 locked to CloudFront origin-facing ranges). `WEB_ORIGIN` and Cognito callback URLs are driven from Terraform (`custom_domain` → SSM), not hardcoded. **GitHub Actions** deploys the API (OIDC + SSM Run Command) and the SPA (`deploy-web.yml`: build, Sentry source-map upload when configured, S3 sync, CloudFront invalidation). Manual path: `deploy/README.md`.

---

## How to run locally

**Prerequisites:** Node.js 20+ (`.nvmrc`), pnpm 9, Docker for PostgreSQL.

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env   # Cognito pool/client IDs for sign-in
pnpm --filter @echotype/api prisma:generate
pnpm --filter @echotype/api prisma:migrate
SEED_ENV=dev pnpm --filter @echotype/api seed
pnpm dev          # API :3001, web :5173 (proxies /api)
```

Open `http://localhost:5173`. Guest mode lets you browse and type the sample catalog without an account; sign in (Cognito email/password, or Google when IdP env/infra is configured) to create courses, collections, and save sessions.

```bash
pnpm run typecheck
pnpm --filter @echotype/web test:typing    # alignment / forgiving-mode unit tests
pnpm --filter @echotype/web test:layout    # annotation overlay layout (extend + band gaps)
pnpm --filter @echotype/shared test        # shared contract unit tests
node apps/web/scripts/phase2-probe.mjs     # needs dev servers; expect SUMMARY PASS
```

Reset DB: `pnpm --filter @echotype/api prisma:reset` then `SEED_ENV=dev pnpm --filter @echotype/api seed`.

I ship in phases with manual gates (`docs/STATE.md`); after overlay changes I run the Playwright probe locally. Project rules in `.cursor/rules/` keep AI-assisted sessions inside phase scope.

---

## Implementation status

| Status | Capability |
|--------|------------|
| ✅ | **Annotation feature** — Shared Zod contracts, overlay rendering (charEdges + post-layout width rules), four-step editor, edit-time review (re-anchor / delete) |
| ✅ | **Cloud deploy** — Terraform-provisioned EC2/RDS/S3/CloudFront; OIDC + SSM deploys; live at https://echotype.ink |
| ✅ | **Typing experience** — Auto-loop, newline auto-skip, IME composition, session timer with pause, immersive & forgiving modes, .txt import/export |
| ✅ | **Course management** — Short/Article mode routes, search/sort, descriptions, collections with batch add and stats rollup |
| ✅ | **Course stats** — Per-session rows + materialized course cumulative; home cross-course summary via aggregate API; formulas contracted in `docs/STATS.md` |
| ✅ | **Auth** — Cognito email/password (SRP), JWT-verified API, guest sample catalog, account page (nickname, password change, delete), onboarding seed for new users |
| ✅ | **Custom domain** — echotype.ink via ACM + CloudFront alias; HTTPS enforced |
| ✅ | **Ops & safety** — Sentry (web + API), public privacy policy, unified loading/error/empty states |
| ✅ | **Google sign-in** — Cognito Google IdP, Hosted UI OAuth, email-based account linking, add-password for Google-only accounts via identity reconstruction, privacy Google disclosure |
| 🔧 | **Maintenance** — Ongoing polish and UX fixes |

---

## Further reading

- **`docs/STATE.md`** — Current engineering snapshot and roadmap.
- **`docs/DECISIONS.md`** — Decision log (32 ADRs: anchoring, measurement, stats, auth, Google federation + email identity + password reconstruction, layout, import/export, content whitespace normalization, forgiving mode, immersive refocus + caret under pinch-zoom, home practice summary, custom domain, Sentry, privacy).
- **`docs/STATS.md`** — Stats field definitions and formulas (the contract).
- **`deploy/README.md`** — Terraform, SSM access, cloud deploy.

Private portfolio project — contact me for access or demo.
