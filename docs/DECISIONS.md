# EchoType — Decision Log (ADR)

> Major technical/engineering decisions. Each entry is immutable: never edit or
> delete its reasoning. To overturn a decision, write a NEW entry and only flip
> the old entry's Status line to "Superseded by ADR-xx".
> The top "Plain summary" line is for the project owner to verify — it must be
> understandable without deep technical knowledge.
> Append new entries at the end; numbering increments. Always record the date
> and a commit/PR anchor.
> **Accepted date** = the calendar day the implementing commit lands on `main`
> (same day as the Commit/PR anchor), not the design-discussion day.
>
> Status values: Accepted | Superseded by ADR-xx (date) | Deprecated (no
> replacement) | Reverted-in-code (implementation rolled back; see note)
>
> Revert reconciliation: if a code revert crosses the implementation point of an
> Accepted ADR, do NOT silently leave the log stale. Either (a) write a new ADR
> explaining the rollback, or (b) flip the old entry's Status to
> "Reverted-in-code (date, reason)" and add a one-line note. The original
> reasoning stays untouched.

---

## ADR Template
- Status: Accepted (YYYY-MM-DD)  <!-- date = merge to main, matches anchor commit -->
- Commit/PR anchor: <sha or #PR>
- Plain summary (owner reads this): <one plain-language sentence>
- Context / what problem forced this:
- Decision (what was chosen):
- Rejected alternatives (why not B):
- Consequences (cost / constraints / limits on future work):
- Supersedes / superseded-by: none

---

## ADR-0001 — Anchor snapshot derived server-side; client never sends it
- Status: Accepted (2026-06-03)
- Commit/PR anchor: 021c62d
- Plain summary: The client only sends "from char N to char M + the note text";
  the server slices the original text itself, so the stored snapshot can't be
  forged.
- Context: Each note stores a snapshot of the text it was anchored to, used for
  later drift comparison. Trusting a client-uploaded snapshot would let it be
  tampered with.
- Decision: Client PUT excludes anchoredText; server deriveAnchoredText writes it.
- Rejected alternatives: Client uploads anchoredText directly — forgeable.
- Consequences: One extra server slice; security for negligible cost. All future
  edit flows must keep this; do not bypass.
- Supersedes / superseded-by: none

---

## ADR-0002 — Horizontal annotation positioning via per-glyph pixel measurement (charEdges)
- Status: Accepted (2026-06-09, Phase 4.2)
- Commit/PR anchor: 8204b7c
- Plain summary: When full-width and half-width punctuation are mixed, computing
  position as "Nth char x fixed char width" drifts cumulatively, so we measure
  each glyph's actual pixel edges instead.
- Context: Mixed full-width vs half-width punctuation made the highlight band
  drift out of alignment with the text.
- Decision: Measure per-glyph getBoundingClientRect on the mirror to get charEdges.
- Rejected alternatives: index x single charWidth — drifts under mixed widths.
- Consequences: More accurate; re-measured only on layout change
  (content/width/font), never per keystroke, to preserve typing performance.
- Supersedes / superseded-by: none

---

## ADR-0003 — Single CloudFront distribution serves SPA + /api (same-origin HTTPS)
- Status: Accepted (2026-06-11)
- Commit/PR anchor: cc9c378
- Plain summary: The public site is one HTTPS address on CloudFront — pages come
  from a private S3 bucket, API calls under /api go to EC2; the browser never
  talks to plain HTTP or a second domain, so no mixed-content or CORS headaches.
- Context: New AWS accounts cannot create CloudFront until Support verifies the
  account. Browsers block HTTPS pages calling HTTP APIs (mixed content). Hosting
  the SPA on CloudFront while the API stayed on EC2:80 would fail without
  end-to-end HTTPS or same-origin routing.
- Decision: One CloudFront distribution, two origins — default `/*` → S3 (OAC,
  private bucket); ordered `/api/*` → EC2 EIP over HTTP (server-to-server).
  Backend routes live under `/api` prefix; `WEB_ORIGIN` = CloudFront URL in SSM.
  EC2 port 80 locked to CloudFront origin-facing prefix list only.
- Rejected alternatives: SPA on CloudFront + API on `http://EIP` — mixed content;
  separate API subdomain without custom domain/ACM — extra cost/complexity for MVP.
- Consequences: Custom domain later needs ACM + DNS on this distribution. First
  deploy order: terraform apply → backend workflow → frontend workflow. Destroy
  rebuild gets a new CF domain — update SSM `WEB_ORIGIN` via apply, no hardcoded
  URLs in repo.
- Supersedes / superseded-by: none

---

## ADR-0004 — Course content: line-ending normalization + control-character filter
- Status: Accepted (2026-06-19)
- Commit/PR anchor: c29f9fc
- Plain summary (owner reads this): When users paste from Word or Windows, line
  breaks are automatically turned into normal `\n`; besides that, only regular
  visible characters are allowed — tabs and other invisible control characters
  are blocked, but Chinese, emoji, and punctuation are fine.
- Context: Step 1 never filtered illegal characters; pasted `\r\n` text could
  shift annotation indices relative to what users see, and control characters
  (tab, NUL, etc.) are data-hygiene problems, not user expression.
- Decision:
  1. **Line-ending normalization** before all validation and DB writes:
     `\r\n` → `\n`, lone `\r` → `\n` (same approach as Git `core.autocrlf`,
     Node `fs`, and most HTTP frameworks — absorb OS differences, do not punish
     the user).
  2. **Control-character filter** on normalized content: reject Unicode `\p{Cc}`
     except `\n`; do not restrict Chinese, emoji, or punctuation.
  3. **Shared validation** in `packages/shared`: `normalizeLineEndings`,
     `validateContentCharacters`, `prepareCourseContent`; client Step 1 and
     server API both use it; stored content is always LF-only.
  4. **Edit-load remap**: when opening a course whose DB content still contains
     legacy CRLF, remap annotation indices once on editor init (client only).
- Rejected alternatives:
  - Reject `\r` outright — punishes high-frequency Word/Windows paste.
  - Client-only validation — API bypassable.
  - Server-side annotation index remap on API payloads — hides malformed clients;
    422 after normalize is enough.
- Consequences:
  - New saves are LF-only; `\t` and other control chars blocked with plain-language errors.
  - Legacy courses with CRLF get silent index remap on first edit open (console log for debug).
  - Direct API callers must send indices relative to normalized content or get 422 bounds errors.
- Supersedes / superseded-by: none

---

## ADR-0005 — Annotation anchors: grapheme-boundary expansion + ill-formed range guard
- Status: Accepted (2026-06-19)
- Commit/PR anchor: 903dc90
- Plain summary (owner reads this): When you anchor a note on an emoji, the editor
  now selects the whole emoji automatically; if a range still cuts through the
  middle of a multi-unit character, save is blocked with a clear message instead
  of a server crash.
- Context: Annotation indices follow JavaScript UTF-16 code units (same as
  `content.length`). Emoji such as 🇯🇵 occupy multiple units; clicking only part
  of an emoji produced an ill-formed `anchoredText` string. PostgreSQL rejected
  it and the API returned 500 during course save.
- Decision:
  1. **On pick** (editor `tryRange`): expand the inclusive range to grapheme-cluster
     boundaries via `Intl.Segmenter` (`expandRangeToGraphemeBoundaries` in shared).
  2. **On save** (shared `validateAnnotations`): reject ranges whose slice is not
     well-formed UTF-16 (`ill_formed_range` → 422), as defense in depth.
  3. **Keep UTF-16 indices** — do not switch to grapheme-only indexing (would
     ripple through measurement, review, and stored DB rows; see ADR-0002).
- Rejected alternatives:
  - Grapheme-only index system — large cross-cutting refactor; deferred.
  - Server-only 422 without pick-time expansion — users would hit errors often when
    clicking emoji; expansion fixes the common case silently.
  - Catch Prisma error and return 500 message — masks root cause; validation belongs
    in shared rules with other annotation checks.
- Consequences:
  - Requires `Intl.Segmenter` (modern browsers; Node 20+ on API — already our floor).
  - Picking inside an emoji may slightly widen the highlighted anchor (intended).
  - Direct API clients sending split-surrogate ranges get 422, not 500.
- Supersedes / superseded-by: none

---

## ADR-0006 — Session charCount is monotonic keystroke count (backspace does not reduce)
- Status: Accepted (2026-06-19)
- Commit/PR anchor: d51f4cc
- Plain summary (owner reads this): When you save a typing session, charCount
  counts every key you pressed that added a character — even if you backspaced
  later — so WPM reflects typing activity, not final draft length.
- Context: Auto-loop repeats the same passage; live UI resets errors each loop
  (quiet repetition) while the saved session needs cumulative stats for future
  course analytics. charCount feeds session WPM and accuracy denominator.
- Decision:
  1. **sessionCharCount** increments only when `typed` grows (delta > 0 after
     cap to target.length); backspace never decrements it.
  2. **Live UI** errors/accuracy derive from current `typed` only (reset each loop).
  3. **Saved session** `errorCount` / `accuracy` use cumulative session counters;
     `loopCount` increments on each length-complete pass.
- Rejected alternatives:
  - charCount tracks current `typed.length` (decreases on backspace) — understates
    typing activity and WPM in an echo/repetition product.
  - Live errors accumulate across loops — conflicts with quiet repetition UX.
- Consequences:
  - Typo + backspace + correct finish: final loop shows 0 live errors but charCount
    includes correction keystrokes; saved accuracy may look high — intentional
    (accuracy = correctness of final positions per loop at completion; charCount =
    activity volume).
  - Extreme backspace spam inflates charCount; acceptable for echo use case.
- Supersedes / superseded-by: none

---

## ADR-0007 — Newline skip sync: typed holds real keystrokes; target `\n` auto-skipped (direction R)
- Status: Accepted (2026-06-22)
- Commit/PR anchor: bceab65
- Plain summary (owner reads this): When the passage has line breaks, you can keep
  typing without pressing Enter — skipped breaks stay invisible; if you do press
  Enter on a break you get a green ↵, and a wrong Enter elsewhere shows red ↵.
- Context: Phase 1 aligned `typed[i]` to `target[i]` index-for-index. Courses with
  `\n` (paragraphs, speeches) broke: single-line `<input>` could not insert `\n`,
  and typing past a break without Enter caused red diff cascades and no auto-loop.
  Echo repetition should not force users to hunt line breaks; stats must still
  reflect real keystrokes (ADR-0006).
- Decision:
  1. **`typed` buffer** stores only user keystrokes (paste included); never
     auto-insert `\n` for skipped target newlines.
  2. **Sync alignment** (`syncTypedToTarget` in `typingAlign.ts`): dual-pointer
     walk; when `target[t] === '\n'` and `typed[u] !== '\n'`, skip `t` without
     consuming `u`. **Pass complete** when both pointers exhaust (`isPassComplete`).
  3. **Visual (direction R)**: skipped `\n` → no marker (passage natural wrap only);
     user Enter on target `\n` → emerald **↵**; Enter on non-`\n` → red **↵**.
     AnnotatedText typing page uses per-target `typingStatuses[]`; editor path
     unchanged.
  4. **Paste**: clipboard `\n` enters `typed` as-is; sync aligns (no strip in paste
     handler); `pasteRanges` length counts pasted chars including `\n`.
  5. **charCount / errors**: monotonic charCount (ADR-0006) counts real keys only —
     skipped `\n` does not add virtual keystrokes; aligned errors from sync path.
- Rejected alternatives:
  - Strict index match (Phase 1) — unusable on multiline courses without Enter.
  - Auto-insert `\n` into `typed` on skip — falsifies buffer and copy/paste UX.
  - Gray ↵ on every skipped break — noisy on long multiline passages; quiet echo UX.
  - `typed.length === target.length` as loop gate — wrong when `\n` skipped
    (`typed.length < target.length` at completion).
- Consequences:
  - `progress` and cursor use sync `targetCursor`, not `typed.length`.
  - No-`\n` courses degenerate to index-aligned behavior (Phase 1 regression guard).
  - Phase 3 IME must gate loop/stats on `compositionend`; sync logic reused as-is.
  - Implementation: `apps/web/src/lib/typingAlign.ts`, `TypingPage.tsx`,
    `AnnotatedText.tsx` (`typingStatuses` prop only — no charEdges change; ADR-0002).
- Supersedes / superseded-by: none

---

## ADR-0008 — IME composition: dual buffer (draft / typed) + controlled-value invariant
- Status: Accepted (2026-06-22)
- Commit/PR anchor: 3a67a2f
- Plain summary (owner reads this): When you type with an input method (e.g.
  Chinese pinyin), the box shows your in-progress composition without disturbing
  the diff, error count, or auto-loop; only the confirmed text counts. Two pieces
  of state (`draft`, `typed`) are intentional, not redundant.
- Context: Phase 2 made typing a controlled `<textarea value={typed}>` plus an
  idle timer that re-renders every 100ms. During IME composition the browser
  writes preedit into the textarea and fires `input` events. If the change handler
  ran the diff/stats each time, preedit would pollute the passage diff, pinyin
  keys would inflate charCount, and a pass could complete mid-composition. More
  subtly, the idle timer's periodic re-render resets the controlled `value` back
  to stale `typed`, wiping the preedit and breaking the IME (classic controlled-
  input + IME bug, amplified by the Phase 2 timer).
- Decision:
  1. **Dual buffer**: `draft` mirrors the live textarea value (incl. preedit) and
     is bound as `value={draft}`; `typed` is the committed, sync-aligned buffer
     feeding diff/stats/loop (ADR-0007 logic reused unchanged).
  2. **Invariant**: `draft` always equals the textarea's current value, so any
     re-render writing `value={draft}` is a no-op (React skips DOM write when
     `node.value === nextValue`) → preedit is never clobbered.
  3. **Gating**: `onChange` always `setDraft`; while
     `nativeEvent.isComposing || composingRef.current` it does NOT touch
     `typed`/stats/loop. `compositionend` commits once; idempotent with any
     trailing `input(isComposing=false)` (delta 0 on re-commit).
  4. **charCount**: counts committed output characters (你好 = 2), not pinyin
     keystrokes — consistent with ADR-0006 "characters added".
  5. Typing engine is mode-agnostic (SHORT == ARTICLE); IME path identical.
- Rejected alternatives:
  - Single buffer, only skip setState while composing — broken by the idle-timer
    re-render that resets `value` and wipes preedit.
  - Lock/flag to pause rendering — more fragile and easier to miss a path than an
    invariant guarded by React's own value comparison.
  - Switch textarea to uncontrolled during composition — React forbids
    controlled↔uncontrolled swaps, and caret/selection handoff is error-prone.
- Consequences:
  - English / no-IME steady state has `draft === typed`; behavior == Phase 2 (zero
    regression).
  - **The invariant depends on React's controlled-input value comparison.** Any
    refactor of the textarea rendering that breaks "draft == DOM value" will make
    IME break again — this is the invariant to guard (core reason for this ADR).
  - Immersive mode (hidden textarea) may render the IME candidate window off-
    screen; surfaced via a constant helper line near the toggle (no extra logic).
  - Real IME is OS-level; automation can only synthesize composition events as a
    smoke probe — primary acceptance is manual QA with a real input method.
  - Implementation: `apps/web/src/pages/TypingPage.tsx` only (no charEdges change;
    ADR-0002). Sample course `Deer Enclosure 鹿柴` (Samples category) added to
    `apps/api/prisma/seed.ts` for IME + newline-skip manual QA.
- Supersedes / superseded-by: none

---

## ADR-0009 — Course mode locked by list route; editor Step 1 read-only
- Status: Accepted (2026-06-22)
- Commit/PR anchor: da5d54d
- Plain summary (owner reads this): Short vs Article is chosen on the mode list
  page (or Home), not inside the course editor. Once you open New/Edit, mode is
  fixed and shown read-only — you cannot switch a course between modes in the modal.
- Context: Walking skeleton used one `/courses` page mixing SHORT and ARTICLE,
  with a temporary mode radio in editor Step 1 (Phase 3.0 stopgap). Kickoff user
  flow requires separate short/article mode screens, create with preset mode, and
  read-only mode on edit (a course's mode is a product classification, not a
  mid-edit toggle). Overlap range (200–500 chars) means the same text could
  validate under either mode; the user's route choice must lock validation rules.
- Decision:
  1. **Routes**: `/courses/short` and `/courses/article` share `CourseListPage`
     with `courseMode` prop; `GET /courses?mode=` filters server-side.
  2. **Home**: two mode entry cards; legacy `/courses` redirects to `/` (mode
     picker), not silently to Short.
  3. **Create**: `presetCourseMode` from the active list route; `useCourseEditor`
     receives `lockedCourseMode` with no UI to change it.
  4. **Edit**: mode = `course.mode`, read-only in Step 1; PUT still sends the
     same mode (no cross-mode migration).
  5. **Nav**: Short | Article links bypass `/courses`.
- Rejected alternatives:
  - Mode radio in editor Step 1 (Phase 3.0) — hides the mode decision until late;
    allows creating an Article-length course while thinking "short list".
  - Single mixed list with per-card mode badge — contradicts kickoff separate mode
    screens; redundant pills on a already mode-scoped page.
  - `/courses` → `/courses/short` default — silently picks Short; rejected for
    kickoff alignment; `/courses` → `/` instead.
  - Allow mode change on edit — would require re-validating content length against
    a new range and blur user mental model ("this course is a short piece").
- Consequences:
  - Editor `setCourseMode` removed from public hook surface; mode length errors
    always refer to the locked mode.
  - Typing page Back links to `/courses/short` or `/courses/article` by
    `course.mode`.
  - Phase 2+ course management builds on mode-scoped lists (search/sort per route;
    categories scoped by mode in schema).
- Supersedes / superseded-by: none

---

## ADR-0010 — Course DELETE: physical row removal, 204, no undo
- Status: Accepted (2026-06-22)
- Commit/PR anchor: 816ff3f
- Plain summary (owner reads this): Deleting a course removes it from the database
  for good (annotations and typing sessions cascade). The list uses a browser
  confirm dialog; success returns HTTP 204. Sample/seed courses are deletable like
  any course — restore only via re-seed or deploy, not in-app undo. Visiting a
  deleted course's typing URL shows a friendly 404 and auto-redirects home after
  5 seconds.
- Context: Course management Phase 2 needed delete on mode-scoped list cards.
  Kickoff implies hard removal, not a recycle bin. Typing sessions and annotations
  are owned by the course; orphan rows would complicate stats and editor state.
  Users may bookmark `/type/:id` or keep a tab open after delete.
- Decision:
  1. **Semantics**: `prisma.course.delete` — physical delete; `Annotation` and
     `TypingSession` removed via schema `onDelete: Cascade` (no soft-delete column).
  2. **API**: `DELETE /courses/:id` — owner check (`userId`), **204 No Content**
     on success; 404 when missing or not owned.
  3. **UI confirm**: `window.confirm` (same pattern as typing "Start over"); no
     custom modal in Phase 2.
  4. **Seed / samples**: seed courses are normal rows for `demo-user`; deletable.
     Recovery is operational (re-run seed / deploy upsert), not user-facing undo.
  5. **Typing 404**: `getCourse` 404 → friendly panel + 5s countdown → `/` (Home
     mode picker), with immediate "Go now" link; no retry on 404.
  6. **Client HTTP**: bodyless DELETE must not send `Content-Type: application/json`
     (Fastify 5 rejects empty JSON body → 500).
- Rejected alternatives:
  - Soft delete / recycle bin — deferred; adds list filters, restore UX, and
    typing-session ambiguity for "deleted but restorable" courses.
  - DELETE 200 with body — REST convention prefers 204 for success without entity.
  - 404 redirect to `/courses/short` — Home (`/`) is the canonical mode entry.
  - Custom confirm modal — unnecessary for Phase 2; matches existing Start over.
- Consequences:
  - No undo API or "recently deleted" list until a future phase explicitly adds one.
  - List invalidate `['courses', mode]` + `removeQueries(['course', id])` on success.
  - Production delete requires API deploy (not web-only).
  - Phase 3 search/sort operates on surviving courses only (no tombstones).
- Supersedes / superseded-by: none
