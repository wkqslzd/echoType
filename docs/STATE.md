# EchoType — Engineering State

> Current engineering state. Read this FIRST before starting work in a new chat.
> Maintenance: facts only, no history. Update = rewrite the relevant line.
> NEVER append paragraphs here.
> Conflict priority: code/git > this file > DECISIONS.md > local kickoff (if present).
> History / rationale -> DECISIONS.md. Private product notes -> docs/project-kickoff.md (local only, gitignored).

## Capability Roadmap (project-level; top-to-bottom = execution order; YOU ARE HERE)
- [x] Annotation feature
- [x] Cloud deploy (CloudFront cutover; live at *.cloudfront.net + post-deploy fixes)
- [x] Typing experience (auto-loop, newline skip, session flow, IME composition; ADR-0006/0007/0008)
- [x] Course management (mode routes, card list, DELETE, description, search/sort, collections; ADR-0009–0013)
- [x] Course stats (per-session + cumulative; STATS.md contract; ADR-0014 phases 1–7)
- [x] Auth (Cognito; replaces demo-user shim; required before sharing externally)
- [x] Custom domain (echotype.ink — ACM + CloudFront alias + Cognito URLs; unblocks Google sign-in → Auth follow-up; ADR-0022)
- [ ] Ops & safety (Sentry, CloudWatch, rate limiting, disclaimer, error/empty states)    <-- YOU ARE HERE
- [ ] Google sign-in (Cognito Google IdP + account linking; requires privacy policy page first)


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: Ops & safety
- [x] Phase 1 — Sentry (frontend + API error reporting)
- [ ] Phase 2 — Disclaimer + error/empty states polish    <-- YOU ARE HERE
  > CloudWatch and rate limiting deferred — revisit when user volume warrants

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Ops & safety Phase 2 — disclaimer + error/empty states polish
- Sub-steps done: Phase 1 Sentry complete (`f2fb0d5`); prod verified at https://echotype.ink (web `?sentry_test=1` → echotype-web; API debug probe → echotype-api; source maps on web release)
- Next step: Phase 2 design — disclaimer copy + error/empty state scope
- Related decisions: ADR-0023 (Sentry); CloudWatch/rate limiting deferred per Phase Roadmap note

## Contract pointers (don't memorize, go read the source)
- Stats metrics (definitions/formulas only): docs/STATS.md
- Course stats serialize: packages/shared/courseStats.ts, apps/api/src/courseStats.ts
- Card display helpers: packages/shared/practiceDisplay.ts
- Last-practice winner (read-time): apps/api/src/modeLastPractice.ts
- Collection rollup: packages/shared/categoryRollup.ts, apps/api/src/routes/categories.ts
- Session types/API: packages/shared/session.ts, apps/api/src/routes/sessions.ts
- Types/validation: packages/shared/course.ts, packages/shared/category.ts
- Course + collection routes: apps/api/src/routes/courses.ts, apps/api/src/routes/categories.ts
- Typing UI: apps/web/src/pages/TypingPage.tsx
- Session timer + pause: apps/web/src/components/typing/SessionTimerStrip.tsx, TimerEndDialog.tsx, apps/web/src/lib/sessionTimer.ts; probe `apps/web/scripts/phase7-pause-probe.mjs`
- Typing Back paths: apps/web/src/lib/collectionPaths.ts
- Mode list + collections UI: apps/web/src/pages/CourseListPage.tsx, CollectionDetailPage.tsx
- List sort options + localStorage: apps/web/src/lib/courseListSort.ts
- Card stats UI: apps/web/src/components/card/CardPracticeStats.tsx
- Annotation rendering: apps/web/src/components/AnnotatedText.tsx + apps/web/src/components/annotated-text/useTextMeasurement.ts
- Editor + review: apps/web/src/components/editor/useCourseEditor.ts, reviewUtils.ts, AnnotatedTextEditor.tsx
- Deploy: deploy/README.md, .github/workflows/deploy.yml, .github/workflows/deploy-web.yml
- Sentry (web): apps/web/src/lib/sentry.ts, vite.config.ts (`@sentry/vite-plugin`); probe `apps/web/scripts/ops-sentry-probe.mjs`; SSM `/echotype/SENTRY_DSN_WEB`
- Sentry (API): apps/api/src/sentry.ts, `apps/api/src/routes/debug.ts` (`SENTRY_DEBUG=1` only); probe `apps/api/scripts/ops-sentry-probe.mjs`; SSM `/echotype/SENTRY_DSN_API`
- Custom domain (Terraform): infra/acm.tf, infra/cloudfront.tf, `custom_domain` variable; outputs `site_url`, `acm_validation_records`
- API JWT auth: apps/api/src/auth/, probe `apps/api/scripts/auth-phase3-jwt-probe.mjs`
- Web auth (Cognito SPA): apps/web/src/auth/, apps/web/.env.example, probe `apps/web/scripts/auth-phase4-probe.mjs`, `auth-phase5-probe.mjs`, `auth-phase6-probe.mjs`
- Account API + page: packages/shared/src/account.ts, apps/api/src/routes/account.ts, apps/web/src/pages/AccountPage.tsx
- Guest course catalog (local): apps/web/src/guest/guestCoursesStore.ts, apps/web/src/guest/useCourseCatalog.ts
- Account vs guest writes: useCourseCatalog (data); collection !isGuest UI (CourseListPage, CollectionDetailPage); useRequireAuthAction (e.g. New collection); TypingPage disabled Save
- Onboarding catalog (shared): packages/shared/src/onboardingCatalog.ts (re-exported in apps/api/prisma/fixtures/courseCatalog.ts)
- Onboarding seed API: POST apps/api/src/routes/onboarding.ts (`/api/onboarding/seed`); hook apps/web/src/auth/useOnboardingSeed.ts
- Onboarding materialize: apps/api/prisma/fixtures/materializeCourse.ts (`materializeOnboardingForUser`)

## Do NOT touch (unless explicitly opening a new phase)
- annotation measurement hook (charEdges per-glyph measurement) — ADR-0002
- Phase 4 review state machine / reviewPickGate (annotation editor — not course-mgmt Phase 4)
- server-side deriveAnchoredText (client never sends anchoredText) — ADR-0001

## Known debt / intentionally deferred
| Capability | Item | Reason | Picks it up | Related ADR |
|---|---|---|---|---|
| Course stats | Typing stats lost on browser close / crash without Save | MVP: manual Save only; no beforeunload | intentional (ADR-0014) | ADR-0014 |
| Course stats | Timer visit abandoned via external close before end modal | Same as above | intentional (Phase 6) | ADR-0014 |
| Course stats | WPM uses English 5-chars-per-word for all scripts; no Chinese (CPM) line | MVP single formula (STATS.md §2); Chinese-primary product not in scope | future if Chinese courses ship | ADR-0006 |
| Course mgmt | Collection detail in-page search | MVP: sort only on detail; mode list has global search | future polish | ADR-0013 |
| Course mgmt | Full markdown in description (headings, `[text](url)` syntax) | Phase 3 plain text + URL linkify on typing/collection detail only; no markdown renderer | future polish if users paste rich notes | ADR-0011 |
| Typing | English course + accidental IME shows red diff only, no explicit "switch to English" guidance | Phase 3 chose IME-as-valid-input (ADR-0008) over kickoff #7 banner/pause; red diff implies the error | future polish / real-usage feedback | ADR-0008 |
| Typing | Immersive mode: no keydown refocus after textarea blur — user must click passage | MVP: amber overlay + passage mousedown refocus (`3d0f3e9`); global keydown refocus deferred | future polish if self-testing reports friction | ADR-0021 |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
| Auth | Guest typing progress not restored after login | In-memory session only; sign in before starting a session you intend to save | intentional (ADR-0015 §16) | ADR-0015 |
| Auth | Google sign-in | Custom domain shipped; Cognito Hosted UI / Google IdP not wired yet | Google sign-in capability | ADR-0015, ADR-0022 |
| Auth | Email change | Deferred if implementation requires extra SES/Lambda cost beyond existing Cognito verify path | Auth Phase 5 cost check, or post-MVP | ADR-0015 |
| Custom domain | Wildcard `*.echotype.ink` CNAME still points to Porkbun parking | MVP canonical host is apex only (ADR-0022); ACM cert covers wildcard for future subdomains | future if www or subdomain needed | ADR-0022 |
