# EchoType — Engineering State

> Current engineering state. Read this FIRST before starting work in a new chat.
> Maintenance: facts only, no history. Update = rewrite the relevant line.
> NEVER append paragraphs here.
> Conflict priority: code/git > this file > DECISIONS.md > local kickoff (if present).
> History / rationale -> DECISIONS.md. Private product notes -> docs/project-kickoff.md (local only, gitignored).

## Capability Roadmap (project-level; YOU ARE HERE)
- [x] Annotation feature
- [ ] Course management — mode-specific list pages
- [ ] Typing experience (typing page, text-vs-typed live diff)
- [ ] Course stats (per-session + cumulative)
- [ ] Auth (Cognito; replaces demo-user shim)
- [~] Cloud deploy (CloudFront cutover)   <-- YOU ARE HERE

> Each line is a capability, not a sub-step. Completed capabilities stay one line
> (internal history -> git/DECISIONS). Only the ACTIVE capability is expanded in
> the Phase Roadmap below.

## Phase Roadmap (active capability only)
Active capability: Cloud deploy
- [x] AWS Support ticket opened
- [~] AWS Support verification (in progress)
- [ ] Terraform apply -> deploy
- [ ] Post-deploy fixes surfaced during annotation work: create-mode review,
      illegal-character filter, click-to-view note popover, (maybe) doc wording
- [ ] Go live -> real EchoType usage
- [ ] Resume other feature development

> Legend: [x] done  [~] in progress  [ ] todo  (blocked) noted inline
> When the active capability changes, replace this entire Phase Roadmap with the
> new capability's phases and move YOU ARE HERE above.

## Now working on (describe ONLY the in-progress item)
- Goal (one line): Complete CloudFront production cutover so the deployed site is publicly reachable.
- Sub-steps done: AWS Support ticket opened; infra (EC2, RDS, S3, CloudFront, OIDC deploy workflows) exists in repo.
- Next step: Finish AWS Support verification; then Terraform apply and deploy.
- Related decisions: none yet

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
| Annotation | create-mode content edit skips review | Phase 4 scoped to edit flow only | post-deploy / feature resume | — |
| Course mgmt | CoursesPage not split into routes | Phase 3.0 debt | course management capability | — |
| Annotation | false-green (duplicate substring, no index shift) | MVP skips index shift | user reanchor | — |
| Editor | Step 1 no illegal-character filter | Never implemented; length/mode only | post-deploy fixes | — |
| Typing | Typing page: no click-to-view full note (hover title only) | Phase 2 scope | polish / post-deploy | — |
| Annotation | Overlay measurement = mirror offsetTop (lines) + per-glyph getBoundingClientRect (charEdges); NOT Range.getClientRects() | Phase 2 deliberate | do not revert without ADR | ADR-0002 |
