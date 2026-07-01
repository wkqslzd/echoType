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
- [ ] Auth (Cognito; replaces demo-user shim; required before sharing externally)    <-- YOU ARE HERE
- [ ] Custom domain (purchase + ACM cert + CloudFront alias; deferred until self-testing settles)
- [ ] Ops & safety (Sentry, CloudWatch, rate limiting, disclaimer, error/empty states)


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: Auth
- [x] Phase 1 — Cognito pool + SSM (email/password pool; email verification required; access 1h / refresh 30d; callback/logout URLs from WEB_ORIGIN / env — no hardcoded cloudfront.net)
- [x] Phase 2 — User model + seed split (users.id = Cognito sub UUID; nickname required; purge demo-user from prod; clear monolithic seed.ts; local-only dev seed, prod deploy skips seed)
- [x] Phase 3 — API JWT auth (replace demo-user shim; verify tokens; upsert User by sub; 401 without valid session)
- [ ] Phase 4 — Web auth core (register form: email + password + nickname all required; email verification gate before login; login/logout/refresh; route guards; Cognito config from env)
- [ ] Phase 5 — Account management (forgot password; change password; delete account — email re-registerable; email change only if zero new cloud cost, else Known debt; all Cognito email links/callbacks from WEB_ORIGIN / env — no hardcoded domain)
- [ ] Phase 6 — Onboarding seed hook (courseCount===0 triggers seed call; framework + empty stub — **owner must supply course/collection seed content before this phase ships**)

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Auth Phase 4 — Web auth core (register/login/refresh; route guards; Cognito from env).
- Sub-steps done: Phase 3 API JWT (`962d2a4`; probe + manual curl 验收); Phase 2 (`43ae465`); Phase 1 (`b2a226a`); admin password auth on app client (`f215575`)
- Next step: Phase 4 design / web login + Bearer on API calls
- Related decisions: ADR-0015
- Deploy gate: first prod deploy after Auth Phase 4 (Phases 2–4 bundle)

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
- API JWT auth: apps/api/src/auth/, probe `apps/api/scripts/auth-phase3-jwt-probe.mjs`
- Onboarding course catalog (fixtures): apps/api/prisma/fixtures/courseCatalog.ts, materializeCourse.ts

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
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
| Auth | Local web UI 401 until Phase 4 ships Bearer tokens | API JWT active; browser has no login yet | Auth Phase 4 | ADR-0015 |
| Auth | Google sign-in | Needs custom domain capability first; account linking prep via sub-as-PK | Custom domain capability, then Auth follow-up | ADR-0015 |
| Auth | Email change | Deferred if implementation requires extra SES/Lambda cost beyond existing Cognito verify path | Auth Phase 5 cost check, or post-MVP | ADR-0015 |
