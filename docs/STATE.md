# EchoType — Engineering State

> Current engineering state. Read this FIRST before starting work in a new chat.
> Maintenance: facts only, no history. Update = rewrite the relevant line.
> NEVER append paragraphs here.
> Conflict priority: code/git > this file > DECISIONS.md > local kickoff (if present).
> History / rationale -> DECISIONS.md. Private product notes -> docs/project-kickoff.md (local only, gitignored).

## Capability Roadmap (project-level; top-to-bottom = execution order; YOU ARE HERE)
- [x] Annotation feature
- [~] Cloud deploy (CloudFront cutover; default *.cloudfront.net URL)    <-- YOU ARE HERE
- [ ] Course management (short/article routes, card list, search/filter/sort)
- [ ] Typing experience (live diff exists; add IME handling, session flow)
- [ ] Course stats (per-session + cumulative; needs typing session data first)
- [ ] Auth (Cognito; replaces demo-user shim; required before sharing externally)
- [ ] Custom domain (purchase + ACM cert + CloudFront alias; deferred until self-testing settles)
- [ ] Ops & safety (Sentry, CloudWatch, rate limiting, disclaimer, error/empty states)


> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.
> Top-to-bottom = current execution order. Reorder if priorities change; never leave it unordered.

## Phase Roadmap (active capability only)
Active capability: Cloud deploy
- [x] AWS Support ticket opened
- [x] AWS Support verification (CloudFront account unblocked)
- [x] Terraform apply (35 resources; CF Deployed)
- [x] CI deploy + 4G verify (https://d3a9mgremswg7d.cloudfront.net — UI + /api)
- [x] Post-deploy: create-mode content-change review
- [x] Post-deploy: line-ending normalize + control-character filter (ADR-0004)
- [x] Post-deploy: click-to-view note popover (typing page)
- [ ] Go live -> real EchoType usage
- [ ] Resume other feature development

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Stabilize the live CloudFront deployment before moving to the next capability.
- Sub-steps done: Post-deploy fixes complete (review, content hygiene, note popover, emoji-anchor hotfix).
- Next step: Go live — real self-usage on CloudFront; then resume feature development.
- Related decisions: ADR-0003, ADR-0004, ADR-0005

## Contract pointers (don't memorize, go read the source)
- Types/validation: packages/shared/course.ts
- Annotation rendering: apps/web/src/components/AnnotatedText.tsx + apps/web/src/components/annotated-text/useTextMeasurement.ts
- Editor + review: apps/web/src/components/editor/useCourseEditor.ts, reviewUtils.ts, AnnotatedTextEditor.tsx
- Deploy: deploy/README.md, .github/workflows/deploy.yml, .github/workflows/deploy-web.yml

## Do NOT touch (unless explicitly opening a new phase)
- annotation measurement hook (charEdges per-glyph measurement) — ADR-0002
- Phase 4 review state machine / reviewPickGate
- server-side deriveAnchoredText (client never sends anchoredText) — ADR-0001

## Known debt / intentionally deferred
| Capability | Item | Reason | Picks it up | Related ADR |
|---|---|---|---|---|
| Course mgmt | CoursesPage not split into routes | Phase 3.0 debt | course management capability | — |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
