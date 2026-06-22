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
- [ ] Course management (mode routes, card list, DELETE, search/sort, categories)    <-- YOU ARE HERE
- [ ] Course stats (per-session + cumulative; needs typing session data first)
- [ ] Auth (Cognito; replaces demo-user shim; required before sharing externally)
- [ ] Custom domain (purchase + ACM cert + CloudFront alias; deferred until self-testing settles)
- [ ] Ops & safety (Sentry, CloudWatch, rate limiting, disclaimer, error/empty states)


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: Course management
- [x] Phase 1 — Mode shell (`/courses/short` + `/courses/article`, shared `CourseListPage`; Home cards; `/courses` → `/`; create preset mode; edit mode read-only)
- [x] Phase 2 — DELETE (`DELETE /courses/:id` 204, physical + Prisma cascade, `window.confirm`, typing 404 → `/`; ADR-0010)
- [ ] Phase 3 — Search + sort (search title/content/noteText; sort: createdAt asc/desc, updatedAt desc, title A–Z only)
- [ ] Phase 4 — Categories (album model: create category with name + description; move course into/out of category)

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Course management Phase 3 — search + sort on mode-scoped lists.
- Sub-steps done: Phase 2 DELETE shipped (816ff3f; owner验收 pass)
- Next step: Phase 3 design review, then implement
- Related decisions: ADR-0009 (mode-scoped lists); ADR-0010 (delete semantics)

## Contract pointers (don't memorize, go read the source)
- Types/validation: packages/shared/course.ts
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
| Course mgmt | Sort modes 4/5/7 (loop count, cumulative session time, last practice) + card cumulative stats on list cards | Need aggregated course stats from TypingSession; Phase 3 sort limited to createdAt/updatedAt/title | **return after Course stats capability** — wire sorts + card fields then | — |
| Typing | English course + accidental IME shows red diff only, no explicit "switch to English" guidance | Phase 3 chose IME-as-valid-input (ADR-0008) over kickoff #7 banner/pause; red diff implies the error | future polish / real-usage feedback | ADR-0008 |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
