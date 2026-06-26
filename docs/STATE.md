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
- [ ] Course stats (per-session + cumulative; STATS.md contract; phases below)    <-- YOU ARE HERE
- [ ] Auth (Cognito; replaces demo-user shim; required before sharing externally)
- [ ] Custom domain (purchase + ACM cert + CloudFront alias; deferred until self-testing settles)
- [ ] Ops & safety (Sentry, CloudWatch, rate limiting, disclaimer, error/empty states)


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: Course stats
- [x] Phase 1 — `docs/STATS.md` metrics reference + stats bar completed-loops display fix
- [x] Phase 2 — Manual Save → `TypingSession` + course cumulative columns + Save copy + in-app leave guard (3-button)
- [x] Phase 3 — Collection rollup fields on categories API (`CategoryDTO.rollup`; read-time from members)
- [x] Phase 4 — Course/collection card stats UI + `lastPracticeHere` tags (`d58ed9b`)
- [x] Phase 5 — List sort modes 4/5/7 + per-mode sort preference in localStorage (`691e0a1`)
- [x] Phase 6 — Session timer strip (10min–2h) + countdown-end modal + segment Save rules (`0aa8ebb`)
- [ ] Phase 7 — Pause/resume (freezes active time + countdown; resume on keystroke)

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Course stats Phase 7 — pause/resume on typing page.
- Sub-steps done: Phase 6 shipped (`0aa8ebb`): session timer strip, countdown-end modal, segment Save semantics (STATS.md §2.2), hide/show preference, collection-aware Back
- Next step: Pause freezes active time + wall-clock countdown; resume on keystroke (ADR-0014 §11)
- Related decisions: ADR-0014 §11

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
- Session timer: apps/web/src/components/typing/SessionTimerStrip.tsx, TimerEndDialog.tsx, apps/web/src/lib/sessionTimer.ts
- Typing Back paths: apps/web/src/lib/collectionPaths.ts
- Mode list + collections UI: apps/web/src/pages/CourseListPage.tsx, CollectionDetailPage.tsx
- List sort options + localStorage: apps/web/src/lib/courseListSort.ts
- Card stats UI: apps/web/src/components/card/CardPracticeStats.tsx
- Annotation rendering: apps/web/src/components/AnnotatedText.tsx + apps/web/src/components/annotated-text/useTextMeasurement.ts
- Editor + review: apps/web/src/components/editor/useCourseEditor.ts, reviewUtils.ts, AnnotatedTextEditor.tsx
- Deploy: deploy/README.md, .github/workflows/deploy.yml, .github/workflows/deploy-web.yml

## Do NOT touch (unless explicitly opening a new phase)
- annotation measurement hook (charEdges per-glyph measurement) — ADR-0002
- Phase 4 review state machine / reviewPickGate (annotation editor — not course-mgmt Phase 4)
- server-side deriveAnchoredText (client never sends anchoredText) — ADR-0001

## Known debt / intentionally deferred
| Capability | Item | Reason | Picks it up | Related ADR |
|---|---|---|---|---|
| Course stats | Typing stats lost on browser close / crash without Save | MVP: manual Save only; no beforeunload | intentional (ADR-0014) | ADR-0014 |
| Course stats | Timer visit abandoned via external close before end modal | Same as above | intentional (Phase 6) | ADR-0014 |
| Course mgmt | Collection detail in-page search | MVP: sort only on detail; mode list has global search | future polish | ADR-0013 |
| Course mgmt | Full markdown in description (headings, `[text](url)` syntax) | Phase 3 plain text + URL linkify on typing/collection detail only; no markdown renderer | future polish if users paste rich notes | ADR-0011 |
| Typing | English course + accidental IME shows red diff only, no explicit "switch to English" guidance | Phase 3 chose IME-as-valid-input (ADR-0008) over kickoff #7 banner/pause; red diff implies the error | future polish / real-usage feedback | ADR-0008 |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
