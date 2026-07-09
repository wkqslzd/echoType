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
- Commit/PR anchor: 816ff3f (Phase 2); f43eda0 (CloudFront GET not-found fix)
- Plain summary (owner reads this): Deleting a course removes it from the database
  for good (annotations and typing sessions cascade). The list uses a browser
  confirm dialog; success returns HTTP 204. Sample/seed courses are deletable like
  any course — restore only via re-seed or deploy, not in-app undo. Visiting a
  deleted course's typing URL shows a friendly not-found panel and auto-redirects
  home after 5 seconds. On production, missing courses use **410 Gone** on
  `GET /courses/:id` so CloudFront does not rewrite the API error into SPA HTML.
- Context: Course management Phase 2 needed delete on mode-scoped list cards.
  Kickoff implies hard removal, not a recycle bin. Typing sessions and annotations
  are owned by the course; orphan rows would complicate stats and editor state.
  Users may bookmark `/courses/:id/type` or keep a tab open after delete.
  **Post-deploy (prod only):** CloudFront `custom_error_response` maps origin
  **404 → 200 + `/index.html`** for the whole distribution (`infra/cloudfront.tf`),
  including `/api/*`. A deleted course's `GET /api/courses/:id` therefore arrived at
  the browser as HTML, not JSON `{ error: 'not_found' }`, breaking the typing
  not-found panel (local dev via Vite proxy was unaffected).
- Decision:
  1. **Semantics**: `prisma.course.delete` — physical delete; `Annotation` and
     `TypingSession` removed via schema `onDelete: Cascade` (no soft-delete column).
  2. **API**: `DELETE /courses/:id` — owner check (`userId`), **204 No Content**
     on success; **404** when missing or not owned (unchanged).
  3. **UI confirm**: `window.confirm` (same pattern as typing "Start over"); no
     custom modal in Phase 2.
  4. **Seed / samples**: seed courses are normal rows for `demo-user`; deletable.
     Recovery is operational (re-run seed / deploy upsert), not user-facing undo.
  5. **Typing not-found**: `getCourse` failure → friendly panel + 5s countdown →
     `/` (Home mode picker), with immediate "Go now" link; no retry on not-found.
  6. **Client HTTP**: bodyless DELETE must not send `Content-Type: application/json`
     (Fastify 5 rejects empty JSON body → 500).
  7. **CloudFront / GET missing course** (`f43eda0`):
     - `GET /courses/:id` when missing → **410 Gone** + `{ error: 'not_found' }`
       (410 is not rewritten by the SPA 404→index.html rule; 404 was).
     - Client `isCourseNotFoundError` treats **404 or 410**; `request()` also maps
       a **200 HTML** success body (legacy/cached path) to not-found.
     - PUT/DELETE missing course stay **404** (no typing-page dependency; list UI
       already handles 404 on delete).
- Rejected alternatives:
  - Soft delete / recycle bin — deferred; adds list filters, restore UX, and
    typing-session ambiguity for "deleted but restorable" courses.
  - DELETE 200 with body — REST convention prefers 204 for success without entity.
  - 404 redirect to `/courses/short` — Home (`/`) is the canonical mode entry.
  - Custom confirm modal — unnecessary for Phase 2; matches existing Start over.
  - Terraform: separate CloudFront error responses per behavior — not done in MVP;
    410 + client HTML guard is sufficient without infra churn.
  - Rely on GET 404 only — broken on CloudFront production until infra changes.
- Consequences:
  - No undo API or "recently deleted" list until a future phase explicitly adds one.
  - List invalidate `['courses', mode]` + `removeQueries(['course', id])` on success.
  - Production delete + typing not-found fix require **both** API and web deploy.
  - Phase 3 search/sort operates on surviving courses only (no tombstones).
  - Any future API route that must surface real 404 JSON through CloudFront should
    avoid 404 or add a client guard — same SPA rewrite applies to all origins.
- Supersedes / superseded-by: none

---

## ADR-0011 — Optional course description (plain text, typing + card display)
- Status: Accepted (2026-06-23)
- Commit/PR anchor: 29216d9
- Plain summary (owner reads this): Each course may have an optional background
  description (up to 1000 characters). It is edited in Step 1 of the course editor,
  shown on the typing page (with URL linkify), and summarized on list cards in a
  fixed four-row layout. Storage is plain text only—no markdown renderer in Phase 3.
  Phase 5 album/category descriptions reuse the same max length and input component.
- Context: English-native audience needs context beyond the title (e.g. cultural
  background for Deer Enclosure). Search (Phase 4) will include description in OR
  filters; the field must exist first. Product copy and seed content stay in English.
- Decision:
  1. **Schema**: `Course.description String? @db.VarChar(1000)`; shared constant
     `DESCRIPTION_MAX = 1000` in `@echotype/shared` for future `Category.description`.
  2. **API**: optional on create/update; empty string → `null`; included in
     `CourseDTO`; not a sort key (Phase 4 search only).
  3. **Editor**: `OptionalDescriptionField` on Step 1 (optional textarea); not
     required for step1 validation.
  4. **Typing page**: show when non-empty; default **one line** (`line-clamp-1`);
     Show more/less only when `scrollHeight` overflows (not always-on); **URL
     linkify only** (`https?://…` → clickable `<a>`).
  5. **List card**: fixed four rows — title `line-clamp-1`, description
     `line-clamp-1` (placeholder `—` when empty), **blank spacer row**, `Content:`
     + content `line-clamp-1` (`toCardPreviewLine` collapses newlines); pinned
     action row (`mt-auto`); **plain text on card** (no linkify).
  6. **Seed**: Deer Enclosure sample gets an English description tying echo/repetition
     to EchoType; other seeds remain `null`.
- Rejected alternatives:
  - Full markdown rendering — deferred to Known debt; XSS/syntax scope too large
    for Phase 3.
  - Linkify on list cards — truncated URLs and distraction; typing page only.
  - Omit description row when empty — breaks equal card heights (chosen: A1 `—`).
  - Chinese product copy in description UI/seed — primary audience is English-native.
- Consequences:
  - Phase 4 search adds `description` to server OR filter alongside title/content/
    noteText.
  - `OptionalDescriptionField` is the reuse point for Phase 5 album description.
  - Deploy requires API migration + web; re-seed updates Deer Enclosure description.
- Supersedes / superseded-by: none

---

## ADR-0012 — Course list search + sort (server `q`/`sort`, IME-aware debounce)
- Status: Accepted (2026-06-23); stats sorts + sort preference (2026-06-25, `691e0a1`)
- Commit/PR anchor: eaced3e; `691e0a1` (Phase 5 stats sorts + localStorage preference)
- Plain summary (owner reads this): Mode-scoped course lists support server-side
  search and sort. Search matches title, content, description, or any annotation
  noteText (case-insensitive substring, including Chinese). Sort offers **seven**
  modes (newest/oldest/updated/title A–Z + most loops / most practice time /
  recently practiced). The list toolbar uses debounced search with IME composition
  gating; **`q` stays in component memory** (no URL); **last chosen `sort` persists
  in localStorage per mode**, with **separate keys for mode list vs collection
  detail**.
- Context: Kickoff mode screen requires search + sort on course cards (ADR-0009
  mode-scoped routes). Phase 3 added `description`, which must be searchable
  (ADR-0011). Chinese-speaking users may search with pinyin IME — intermediate
  composition must not hit the API. Stats-based sorts shipped in Course stats
  Phase 5 (`691e0a1`).
- Decision:
  1. **API**: extend `GET /courses` with `q` (optional, trim, max 200) and `sort`
     (`CourseListSort` enum); default `createdAt_desc` when `sort` omitted.
  2. **Search**: Prisma `OR` — `title`, `content`, `description`, and
     `annotations.some.noteText`, all `contains` + `mode: 'insensitive'`; empty `q`
     = no text filter; **description is not a sort key**.
  3. **Sort (seven)**: metadata — `createdAt_desc` | `createdAt_asc` |
     `updatedAt_desc` | `title_asc` (PostgreSQL default byte order for title);
     stats — `loopCount_desc` | `totalDuration_desc` | `lastPracticed_desc`
     (see STATS.md §5; courses DB orderBy; categories rollup sort in memory).
     Tie-break on equal stats: **`title` / `name` A–Z**.
  4. **UI**: toolbar on `CourseListPage` and `CollectionDetailPage` — search input +
     sort `<select>`; English labels; **no URL query persistence** for `q` or `sort`;
     Short/Article routes keep independent sort memory.
  5. **Sort preference (localStorage)**: keys `echotype.courseListSort.list.v1` (mode
     list: collections + uncategorized) and `echotype.courseListSort.detail.v1`
     (collection detail courses only); JSON map `{ SHORT, ARTICLE } → sort`; invalid
     value → `createdAt_desc`; search `q` **not** persisted.
  6. **Debounce + IME**: `useImeAwareDebouncedSearch` (300ms); while composing, do
     not commit `q` to React Query; flush on `compositionend`.
  7. **Clear**: custom × clears draft + query; input `type="text"` + `role="searchbox"`
     (not `type="search"`) to avoid duplicate native clear control.
  8. **Empty states**: no courses vs `No courses match your search.` when `q` set.
- Rejected alternatives:
  - Client-side filter/sort only — duplicates server `mode=` pattern; poor fit once
    description search is server-side.
  - URL `?q=&sort=` — deferred; MVP keeps list state in component memory.
  - `title_asc` case-insensitive — extra SQL/`LOWER()`; PostgreSQL default chosen.
  - `type="search"` input — browser native clear duplicates custom ×.
  - Sort modes 4/5/7 — initially deferred to Course stats; **shipped** Phase 5
    (`691e0a1`).
  - Shared list/detail sort preference — rejected; separate localStorage keys (B).
  - CJK tokenization / full-text index — unnecessary; `contains` suffices for MVP.
- Consequences:
  - React Query key: `['courses', mode, q, sort]`; invalidate by `['courses', mode]`
    prefix on create/edit/delete.
  - Deploy requires **both** API and web.
  - Phase 5 categories build on the same list shell; category filter is a future
    `GET /courses` query extension, not Phase 4.
- Supersedes / superseded-by: none

---

## ADR-0013 — Collections (user-facing), assignment, bulk actions, title uniqueness
- Status: Accepted (2026-06-24)
- Commit/PR anchor: f26a6ed
- Plain summary (owner reads this): Mode-scoped **collections** group courses. Users
  create/edit collections (optional description reuses Phase 3 patterns), assign
  courses via overflow menus and bulk actions, and delete collections (cascade-deletes
  contained courses). Removing a course from a collection returns it to the main
  list; deleting a course is always permanent. Collection and course **names/titles**
  are unique per user+mode (case-sensitive); duplicates return **409** with explicit
  copy. Mode list search with `q` finds collections and **all** matching courses
  (including inside collections); without `q`, only uncategorized courses appear.
- Context: ADR-0009 scoped lists by mode; ADR-0011 reserved description field/component
  for collections; ADR-0012 added list search/sort. Product requires folder-like
  collections (not iPhone-album semantics): delete collection deletes courses;
  remove-from-collection on detail is unlink, batch delete is real delete. English UI
  label **Collection**; code/schema `Category`.
- Decision:
  1. **Schema**: `Category.description` VARCHAR(1000); `Course.categoryId` FK
     `onDelete: Cascade`; `@@unique([userId, mode, name])` on categories;
     `@@unique([userId, mode, title])` on courses.
  2. **API**: `GET/POST/PUT/DELETE /categories`; `GET /courses?categoryId=null|<id>`
     (omit = all); `PATCH /courses/category` batch assign/move/remove;
     `GET /courses/title-available` for editor Step 1; `CourseDTO.categoryName` for
     search hits; duplicate name/title → **409** (`duplicate_collection_name` /
     `duplicate_course_title`).
  3. **Main list UI**: full-width collection bars (scroll when **>3** visible);
     course cards below; **Bulk actions** + **Cancel** toggles checkboxes; collection
     bars not bulk-selectable.
  4. **Search**: empty `q` → collections + **uncategorized** courses only; with `q`
     → global course OR search + collection name/description; in-collection hits
     show `Inside collection: {name}` badge.
  5. **Collection detail**: `/courses/{short|article}/collections/:id`; description
     via `CourseDescriptionPanel` + `Description: ` prefix; sort only (no in-page
     search — Known debt); Edit/Delete collection in title row.
  6. **Assignment UX**: `⋯` menus — Delete (always real delete); Move/Add/Remove with
     confirms on remove; batch Move/Remove/Delete on detail and mode list.
  7. **Editor**: `OptionalDescriptionField` parameterized; course title duplicate
     checked on **Step 1 Next** (skip when edit title unchanged); Save still guards
     409 for races.
  8. **Delete semantics**: delete collection → cascade courses; remove from collection
     → `categoryId: null`; delete course → `DELETE /courses/:id` everywhere.
- Rejected alternatives:
  - iPhone-album unlink-on-delete — product chose folder-like cascade delete.
  - Album UI label — **Collection** avoids Photos muscle memory.
  - Main-list-only search (ADR-0012 draft) — superseded by global `q` search (5B).
  - Checkboxes always visible — bulk mode gated behind Bulk actions button.
  - Client-only duplicate detection — server 409 + Step 1 `title-available` API.
  - Case-insensitive unique names — PostgreSQL default case-sensitive (3A).
- Consequences:
  - Deploy requires API migrations + web together.
  - Phase 4 list `categoryId` filter extends ADR-0012 list contract.
  - Course stats capability closed ADR-0012 sort debt in Phase 5 (`691e0a1`).
- Supersedes / superseded-by: refines ADR-0012 consequence on category filter (implemented in Phase 5, not deferred)

---

## ADR-0014 — Course stats: persistence policy, phases, list UI, timer, pause
- Status: Accepted (2026-06-24)
- Commit/PR anchor: c9421bd (Phase 2 persistence); 2b0e443 (Phase 3 collection rollup); fd15f5d (Phase 1 STATS + loops display); d58ed9b (Phase 4 card stats UI + tags); `691e0a1` (Phase 5 stats sorts + leave-dialog fix); `0aa8ebb` (Phase 6 session timer strip + countdown-end modal); `17a450f` (Phase 7 pause/resume)
- Plain summary (owner reads this): Course and collection **statistics** are driven by
  explicit **Save session** (`POST /sessions`); formulas live in `docs/STATS.md`.
  Cumulative course fields update in the same transaction as each saved session.
  Course cards show explicit duration + loops and a hover/pinned stats popover (ⓘ).
  **Last practiced here** tags the mode-wide most recently practiced course (per
  SHORT/ARTICLE) and the collection that contains it. Optional session **timer** strip
  (10min–2h wall-clock countdown) shipped Phase 6; **pause/resume** shipped Phase 7.
- Context: ADR-0006/0007 define per-session counters; ADR-0012 deferred sort modes
  4/5/7 and card stats; ADR-0013 added collections needing rollup metrics. Kickoff
  requires cumulative stats on cards and practice-based sorts. Product sign-off
  (2026-06) split **metrics reference** (`STATS.md`) from **product rules** (this
  ADR + STATE Phase Roadmap).
- Decision:
  1. **Metrics doc**: `docs/STATS.md` — static field definitions and formulas only;
     no UX phases or persistence policy.
  2. **Persistence (MVP)**: only **Save session** writes `TypingSession` and updates
     course cumulative columns; UI copy states stats count only after Save.
  3. **Leave guard**: in-app navigation away from typing with unsaved progress →
     three-choice confirm: **Stay** / **Leave without saving** / **Save and leave**.
     Dialog portaled to `document.body` at `z-[100]` (above annotation note popovers)
     so action buttons remain clickable.
  4. **Browser close / crash / external kill**: no `beforeunload`; lost unsaved
     stats are intentional Known debt (user responsibility).
  5. **Course cumulative**: materialized on `Course` (`totalDurationSec`,
     `totalCompletedPasses`, `sessionCount`, `lastPracticedAt`, plus internal
     `totalCharCount` / `totalWpmCharSum` / `totalAccCharSum` for weighted
     averages); `POST /sessions` increments in one transaction; see STATS.md §3.
     **Phase 2 shipped** (`c9421bd`): `CourseDTO.stats`, leave guard via
     `createBrowserRouter` + `useBlocker`, Save helper copy.
  6. **Collection rollup**: sum duration/passes, max `lastPracticedAt` from members;
     collection-owned `createdAt`/`updatedAt`/`courseCount` unchanged (ADR-0013).
     **Phase 3 shipped** (`2b0e443`): `CategoryDTO.rollup` on `GET/POST/PUT /categories`;
     read-time aggregate via `categoryRollupFromMembers` (no Category table columns).
     Local smoke: `apps/api/scripts/phase3-rollup-probe.mjs`.
  7. **Course card UI**: explicit `formatCardDuration · N loops` on its own row;
     full stats + annotation count in ⓘ popover (desktop: hover preview without ✕;
     click pins with ✕ + click-outside dismiss; touch: click-only pinned). ⓘ on
     the same row as **Type this** / **Edit**. **Last practiced here** on the
     course title when this course is the mode-wide `lastPracticedAt` winner
     (tie-break smallest `courseId`). No **Recent** tag (removed — multiple
     courses would qualify; redundant with last-practice tag).
     **Phase 4 shipped** (`d58ed9b`): `CourseDTO.lastPracticeHere`,
     `packages/shared/practiceDisplay.ts`, `CardPracticeStats.tsx`; probes
     `phase4-display-probe.mjs`, `phase4-last-practice-tag-probe.mjs`.
  8. **Collection card UI**: list card shows `{courseCount} courses · duration · loops`
     on one line (no ⓘ, no extra row). **Last practiced here** on collection title
     when mode-wide winner’s `categoryId` equals this collection. Collection
     detail header: explicit rollup line + ⓘ popover (same hover/pinned rules as
     course card). **Phase 4 shipped** (`d58ed9b`): `CategoryDTO.lastPracticeHere`
     via `modeLastPractice.ts`.
  9. **Sort modes 4/5/7**: `loopCount_desc`, `totalDuration_desc`,
     `lastPracticed_desc` on `GET /courses` and `GET /categories` (rollup in memory
     for collections); UI labels Most loops / Most practice time / Recently practiced;
     sort preference localStorage per ADR-0012.
     **Phase 5 shipped** (`691e0a1`); probe `apps/api/scripts/phase5-sort-probe.mjs`.
  10. **Session timer**: default untimed practice; optional **Set session timer** strip
      above passage (presets 10min–2h + custom 10–120, Confirm locks duration, first
      keystroke after Confirm starts wall-clock countdown). At 0 → lock input → modal
      **Save session** / **Don't save** for **unsaved segment only** (STATS.md §2.2;
      one `TypingSession` row per Save, S1); modal portaled `z-[100]`; `timerEndOpen`
      blocks leave dialog and Back. After dismiss: stay on typing page, `beginFreshSession()`,
      strip hidden for visit (**T3-A**); **Start over** clears timer and restores strip.
      Mid-timer Save posts segment, resets counters, countdown continues. Hide/show strip
      via localStorage `echotype-session-timer-hidden`. Leave/timer modal mutual exclusion.
      **Phase 6 shipped** (`0aa8ebb`); probes `apps/web/scripts/phase6-timer-probe.mjs`,
      `phase6-session-timer-unit.mjs`.
  11. **Pause**: **Pause** control on Save row; while paused, `activeMs` and wall-clock
      countdown freeze; **Save session** allowed mid-pause. Resume on keystroke or paste
      (IME: `keydown` before `compositionstart`). Running timer strip shows `· Paused`;
      hint copy under Save row. **Phase 7 shipped** (`17a450f`); probe
      `apps/web/scripts/phase7-pause-probe.mjs`. Metrics: STATS.md §1.4.
  12. **Loops display**: stats bar shows completed `loopCount` only, not
      `loopCount + 1` (Phase 1 shipped).
- Rejected alternatives:
  - Auto-save on timer end or page leave — MVP keeps manual Save (sign-off S1).
  - `Practiced today` (24h) tag — rejected.
  - **Recent** (7d rolling) tag — initially retained, then removed in Phase 4
    (too many simultaneous tags; **Last practiced here** on course + collection
    is the sole practice tag).
  - Navigate to mode list after timer-end modal — stay on course typing page (T2).
  - Re-arm countdown after timer block (T3-B) — untimed continuation for rest of visit.
  - Collection tag when any member practiced recently (S6 B) — mode-wide winner only.
  - STATS.md as combined product + metrics doc — split per doc layering.
- Consequences:
  - Course stats capability complete (Phases 1–7); Phase 7 anchor `17a450f`.
  - ADR-0012 sort debt closed in Phase 5.
  - Timer/pause behavior does not change metric formulas in STATS.md; timed-block
    segment rules in STATS.md §2.2; pause timing in STATS.md §1.4.
- Supersedes / superseded-by: none (extends ADR-0012 deferred sorts; extends ADR-0013 with rollup UI)

---

## ADR-0015 — Auth: Cognito email/password, sub-as-PK, six phases
- Status: Accepted (2026-06-30)
- Commit/PR anchor: b2a226a (Phase 1 pool + SSM); `0018106` (EC2 AMI lifecycle ignore — ops, not auth); `43ae465` (Phase 2 user model + seed split); `962d2a4` (Phase 3 API JWT); `272f222` (Phase 5.3 delete account); `354c1b7` (Phase 6 onboarding seed)
- Plain summary (owner reads this): EchoType replaces the demo-user shim with **AWS Cognito**
  email+password auth. `users.id` stores Cognito **sub** (UUID). Register collects email,
  password, and **nickname in one form**; email must be verified before login. Access token
  1h / refresh 30d (MAU billing only — token lifetimes have no extra Cognito metered fee).
  All URLs (callbacks, logout, Phase 5 email links) derive from `WEB_ORIGIN`/env/SSM — never
  hardcode `*.cloudfront.net`. Google sign-in waits for Custom domain capability.
- Context: Walking-skeleton API pins every request to `DEMO_USER_ID`. Auth is required
  before external sharing. Future Google login needs account linking; Custom domain will
  change the public hostname — infra and callbacks must be config-driven from day one.
- Decision:
  1. **Six phases** (STATE Phase Roadmap): (1) Cognito pool + SSM; (2) User model + seed
     split; (3) API JWT; (4) Web auth core; (5) Account management; (6) Onboarding seed hook.
  2. **Sign-in scope (MVP)**: email + password only; no custom username login; no Google IdP
     until Custom domain capability (Known debt).
  3. **User identity**: Postgres `User.id` = Cognito `sub`; `email` unique, not primary key.
  4. **Nickname**: required on the **registration form** (no post-login “fill nickname” modal).
  5. **Email verification**: required before login; `CONFIRM_WITH_CODE`; pool
     `auto_verified_attributes = [email]`.
  6. **Tokens**: access 1 hour, refresh 30 days on the SPA app client.
  7. **URL config**: `WEB_ORIGIN` SSM (`/${project}/WEB_ORIGIN`) is the single public-origin
     source; Cognito `callback_urls` / `logout_urls` derived from it plus `dev_web_origin`
     (`http://localhost:5173`). Phase 5 forgot-password / email-change links must use the
     same env-derived URLs (Custom domain = update SSM + re-apply, no app hardcoding).
  8. **Callback path placeholder**: `/auth/callback` until Auth Phase 4; change Terraform
     + re-apply if routes differ (low cost).
  9. **Email sending**: `COGNITO_DEFAULT` for MVP. AWS caps at ~50 emails/day on the default
     account — sufficient at current volume; hitting the cap is the trigger to evaluate SES
     (may affect Phase 5 email-change cost gate).
  10. **Account management (Phase 5)**: forgot password, change password, delete account
      (email immediately re-registerable, no cooldown). Email change only if zero new
      cloud cost beyond existing Cognito verify path; else Known debt.
  11. **Seed (Phases 2 + 6)**: remove monolithic `prisma/seed.ts` demo content; prod deploy
      skips seed; local dev seed separate; onboarding hook on `courseCount === 0` with owner-
      supplied course/collection content before Phase 6 ships.
  12. **Phase 1 shipped** (`b2a226a`): `infra/cognito.tf` User Pool + public SPA client;
      SSM `/echotype/COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION`; app
      code still uses demo-user shim until Phase 3.
  13. **Phase 2 shipped** (`43ae465`): `User.id` no default (Cognito `sub`); `email`/`name`
      NOT NULL; migration deletes `demo-user` + cascade. `prisma/fixtures/courseCatalog.ts`
      (`ONBOARDING_COURSES`: Deer Enclosure → Samples; Stray Birds - 49 and What I Have
      Lived For standalone) + `materializeCoursesForUser` for Phase 6 reuse; `DEV_QA_COURSES`
      in `devQaCourses.ts`; `SEED_ENV=dev` local seed only; prod compose skips seed.
      Local dev user `00000000-0000-4000-8000-000000000001`. **First prod deploy** waits
      until Auth Phase 4 (bundle Phases 2–4 migration + JWT + Web login).
  14. **Phase 3 shipped** (`962d2a4`, Accepted 2026-07-01): `aws-jwt-verify` access-token
      middleware on all `/api/*` except `GET /api/health` and `OPTIONS`; demo-user shim
      removed. `ensureUser` upserts by `sub`; `403 profile_incomplete` on first create when
      email+name cannot be resolved; Cognito `GetUser(AccessToken)` enriches profile when the
      access token omits `name`. `deploy/remote-deploy.sh` injects Cognito SSM into API env.
      Probe `apps/api/scripts/auth-phase3-jwt-probe.mjs` (Part A 401 matrix + optional Part B
      with `TEST_ACCESS_TOKEN` or `PROBE_COGNITO_AUTH=1`).
  15. **Phase 4 shipped** (`7786f03`, Accepted 2026-07-01): Web Cognito SRP
      (`amazon-cognito-identity-js`); `AuthProvider` + `localStorage` session; register
      (email + password + nickname), verify-email gate, login/logout; Bearer on API
      calls with 401 refresh retry. **Guest browse** replaces pre-Phase-4 full-site
      `RequireAuth` (see §16). Routes under `AppLayout` are public. Account-only
      **collection** and **session** writes: guest UI hidden (`!isGuest`),
      `useRequireAuthAction` on explicit CTAs (e.g. New collection), Save disabled
      on typing. Header **Log in** is sign-in entry only (not a write guard). Deploy:
      `VITE_COGNITO_*` from SSM in `deploy-web.yml`; `vite.config.ts` `global:
      globalThis` for cognito SDK. Probe `apps/web/scripts/auth-phase4-probe.mjs`
      (Part C unit tests + Part A guest browse + optional Part B Cognito login).
      Catalog hooks defer until `auth status !== 'loading'`; API `401` hard-redirect
      to `/login` only when a stored session existed (fixes guest reload kick).
  16. **Guest browse semantics** (kickoff authentication §1; ADR-0015 §15):
      - **Storage**: `echotype-guest-courses` in `localStorage`; seeds onboarding from
        `packages/shared/onboardingCatalog.ts` (stable IDs namespace `8001`);
        **logout does not clear** guest store; clear site data resets it.
      - **Guest may**: browse onboarding Samples + standalone samples; create/edit/delete
        **temporary** courses (`source: 'guest'`, `categoryId: null` only); type with
        live stats.
      - **Guest may not**: save typing sessions; collection writes; edit/delete
        onboarding read-only courses/collections. Save UI is disabled
        **Saving requires sign-in** (main button + timer-end dialog); login entry is
        header **Log in** only.
      - **Leave UX**: guest typing has **no** leave confirmation on ← Back; authed
        users keep `useBlocker` leave dialog.
      - **Post-login `next`**: if `next` is `/courses/:id/type` and `id` is a guest
        **temp** course (`source === 'guest'` in guest store), redirect to
        `/courses/short` (+ optional flash toast) — temp IDs do not exist in API.
      - **Facade**: `useCourseCatalog` switches guest store vs API; pages stay unaware.
      - **Not in scope (permanent)**: restore guest in-progress typing after login.
  17. **Phase 5.1 shipped** (`cea3a62`, Accepted 2026-07-02): Forgot-password and
      login now surface explicit "account does not exist" UX. Cognito app-client
      `prevent_user_existence_errors` is set to **LEGACY** (Terraform-supported mode;
      equivalent to disabling existence masking, while `DISABLED` is not a valid enum)
      so `UserNotFoundException` is returned. Web behavior:
      - Forgot-password with unknown email: stay on page, show
        `No account found for this email.` (do not route to reset page).
      - Login with unknown email: show
        `No account found for this email. Sign up instead?` plus register link.
      - Product trade-off accepted: UX clarity over anti-enumeration hardening under
        EchoType's current threat model.
  18. **Phase 5.2 shipped** (`80ddb79`, Accepted 2026-07-02): `/account` page
      (`RequireAuth`) for signed-in users. Header display name links to `/account`.
      - **Nickname**: Cognito `updateAttributes({ name })` then best-effort session
        refresh, then `PUT /api/account` (`NICKNAME_MAX` 64 in shared). If refresh
        fails, still PUT and set header `displayName` from API response (Cognito+DB
        consistency over fresh JWT). Account page mount also syncs display name from
        `GET /api/account`.
      - **Change password**: Cognito `changePassword` (client-side); on success
        **logout** and redirect to `/login?reset=1` (sign in with new password).
      - **Delete account**: danger-zone UI placeholder only (disabled); Phase 5.3
        ships `DELETE /api/account` + Cognito `deleteUser` with password + type
        `DELETE` confirm.
      - Probe `auth-phase5-probe.mjs` Part A guest `/account` guard; Part D optional
        nickname save when `PROBE_COGNITO_AUTH=1`.
  19. **Phase 5.3 shipped** (`272f222`, Accepted 2026-07-02): Account deletion on
      `/account` danger zone (replaces §18 placeholder).
      - **Confirm UX**: current password + type `DELETE` (`DELETE_CONFIRMATION_TEXT` in
        shared); submit disabled until both valid.
      - **Order**: `signIn(email, password)` primarily to verify password; side effect
        refreshes Cognito session for `deleteUser`. Then `DELETE /api/account`
        (`deleteMany` by `req.userId`, **204 idempotent** if row already gone). Then
        Cognito `deleteUser` via access token. Then `logout()`.
      - **Success**: redirect `/` with flash
        `Account deleted. Browse or sign up anytime.`; HomePage shows flash + register
        link. Email immediately re-registerable (no cooldown).
      - **Cognito fail after DB delete**: `logout()` + `AccountDeleteCognitoError`;
        account page shows retry message; user may sign in and run delete again (API
        `deleteMany` still 204). Probe Part F simulates via
        `window.__echotypeSimulateCognitoDeleteFailOnce` (local smoke only).
      - Probe `auth-phase5-probe.mjs`: Part D delete UI guards; Part E full delete;
        Part F Cognito-fail retry (destructive; dedicated test user).
  20. **Phase 6 shipped** (`354c1b7`, Accepted 2026-07-05): Onboarding seed hook for
      new authed users with zero courses.
      - **Catalog**: `OnboardingCatalog` in `packages/shared/src/onboardingCatalog.ts`
        (versioned; collections with optional `description` + standalone courses;
        stable IDs namespace `8001`; `validateOnboardingCatalog` at import). Guest store
        reconciles against current catalog on load (`mergeOnboarding`).
      - **Schema**: `User.onboardingSeededAt DateTime?` — means the seed **hook resolved**
        (materialized OR waived), not strictly "rows were inserted". Comment on field +
        `decideOnboardingSeed` document the four-step order.
      - **POST `/api/onboarding/seed`** (JWT required): (1) `onboardingSeededAt !== null`
        → 204; (2) catalog empty → 204 no write; (3) `courseCount > 0` → set
        `onboardingSeededAt` (waive) → 204; (4) `courseCount === 0` + non-empty catalog
        → `materializeOnboardingForUser` + set `onboardingSeededAt` → 204. Transaction
        re-checks under lock for idempotency.
      - **Web**: `useOnboardingSeed` in `AppLayout` after `auth status === 'authenticated'`;
        calls `api.seedOnboarding()` once per session when hook not yet resolved.
        `GET /api/account` returns `onboardingSeededAt`.
      - **Owner content (6.2)**: Beyond English → Deer Enclosure; Great Speeches →
        Gettysburg Address; standalone Stray Birds 49, Sonnet 18, Russell, Gibran On Love.
      - Probe `auth-phase6-probe.mjs` (guest catalog reconcile + optional Cognito seed).
      - **Auth capability complete**; Custom domain capability next (STATE).
- Rejected alternatives:
  - email as `users` PK — blocks future Google account linking.
  - Post-login nickname modal — extra “verified but incomplete profile” state complicates
    onboarding trigger and list UX.
  - Cognito Hosted UI as primary UX — SPA owns forms; pool client still env-configured.
  - Pinning or auto-replacing EC2 on every AL2023 AMI publish — accidental instance
    replacement during Phase 1 apply; addressed by `lifecycle { ignore_changes = [ami] }`
    (`0018106`); OS updates are deliberate maintainer actions.
- Consequences:
  - Auth capability active; Phase 5 next (account management). Web: open browse under
    AppLayout; account collection/session writes gated (!isGuest UI,
    useRequireAuthAction, disabled Save) — not full-site `RequireAuth`.
  - Phase 6 blocked on owner onboarding seed content (STATE reminder); catalog data in
    `prisma/fixtures/courseCatalog.ts`.
  - Do not deploy Phases 2–3 to prod without Phase 4 Web auth (401 wall for browser).
  - Unrelated `terraform apply` should use `-target` for Cognito-only changes until AMI
    lock is on all environments, or rely on `0018106` lifecycle on `aws_instance.app`.
  - Phase 4 shipped (`7786f03`): browser can browse without login; Phases 2–4 bundle
    ready for prod when owner chooses (STATE recommends after Phase 5 for complete auth
    UX). Phase 5 next. Phase 6 still blocked on owner seed content.
- Supersedes / superseded-by: none

---

## ADR-0016 — Typing-page note bubble width extension (post-layout, pixel caps)
- Status: Accepted (2026-07-06)
- Commit/PR anchor: b2b6ea3
- Plain summary: On the typing page, annotation note bubbles may widen to the
  right into free line space so more note text fits within two lines; extension
  runs after charEdges layout, never moves bubble `left`, and stays gated off
  elsewhere (editor preview unchanged).
- Context: Note bubbles default to the annotated phrase width from ADR-0002
  charEdges. Long note text is truncated by the existing two-line line-clamp
  even when empty pixels remain to the right on the same visual line. Mixed
  English/CJK note text needs word-aware wrap simulation, not character-count
  heuristics, to decide how wide a bubble must be.
- Decision:
  1. **Post-layout pass** — After `buildLineData`, invoke `extendNoteWidths` once
     per visual line on the notes already placed on that line. Input positions
     come from charEdges; this pass only adjusts `width`, never `left` or line
     assignment (cross-line host selection stays in `buildLineData`).
  2. **Trigger** — Extend only when the note text does not already fit within
     `NOTE_MAX_LINES` (2) at the current phrase width **and** either (a) there is
     no next bubble on the line, or (b) the gap to the next bubble exceeds
     **24px** (`extendThresholdPx`, overridable via opts). Adjacent annotated
     phrases (gap ≈ 0) therefore stay at phrase width with no forced spacing.
  3. **hardCap (priority caps)** — Maximum extension is the lesser of:
     container content width minus bubble `left` (line right edge = container
     width, not last glyph edge), and — when a next bubble exists — next bubble
     `left` minus **4px** (`minGapPx`). Priority is enforced by this cap, not by
     a separate desired-width formula: stay inside the line > keep 4px before
     the next bubble > show as much text as possible.
  4. **Width search** — Binary search integer widths in `[currentWidth, hardCap]`
     for the smallest width where a greedy wrap simulation fits within
     `NOTE_MAX_LINES`. English breaks at spaces; CJK breaks per character.
     Canvas `measureText` (note font from container `getComputedStyle`) supplies
     pixel widths without DOM reflow. Add **2px** slack (`wrapSlackPx`) to the
     found width, capped at `hardCap`. If text still does not fit at `hardCap`,
     extend to `hardCap` and rely on the renderer's native line-clamp ellipsis.
  5. **Scope gate** — `AnnotatedText` exposes `extendNotes` (default `false`);
     only `TypingPage` passes `true`. `CourseEditorModal` preview and
     `AnnotatedTextEditor` are unchanged.
  6. **Tests** — Pure-function unit tests in `noteExtension.test.ts`; npm script
     `test:layout`.
- Rejected alternatives:
  - `fullTextPx / maxLines` as desired width — underestimates English because
    words cannot break mid-token; caused false truncation (e.g. Gibran On Love).
  - Extension inside charEdges / `useTextMeasurement` — would alter the ADR-0002
    measurement path re-measured on layout change.
  - Unconditional extension in `AnnotatedText` — would change editor preview
    without an explicit product decision.
- Consequences:
  - Typing-page overlays use more horizontal space; charEdges measurement and
    per-keystroke performance profile unchanged (extension runs in `lineData`
    memo, not in the measurement hook).
  - Thresholds and slack are opts on `extendNoteWidths` for tuning without
    algorithm changes.
  - Future editor parity requires an explicit opt-in (same prop or separate ADR).
- Supersedes / superseded-by: none

---

## ADR-0017 — Typing-page vertical layout: viewport-anchored passage max-height
- Status: Accepted (2026-07-06)
- Commit/PR anchor: 48bd5b3 (`7ad406c` introduced viewport-height shell; `48bd5b3` final auto-fit formula)
- Plain summary: The typing page sizes the passage scroll box from the viewport
  minus measured input and stats panels so short courses keep passage tight to the
  input while long courses scroll inside the box with stats/buttons visible on
  first paint—no sticky footer and no flex-grown empty gap between passage and input.
- Context: Long passages pushed the input and stats off-screen. An interim fix
  (`7ad406c`) locked the route to `h-dvh`, gave the passage container `flex-1`,
  and scrolled inside it—restoring input visibility for long text but leaving a
  large empty flex gap between a short passage and the input on tall displays.
  Guest browse and short poems made a sticky stats footer feel wrong; product
  accepted normal document flow for stats with first-screen visibility on long
  passages instead of a global “stats always pinned” rule.
- Decision:
  1. **Passage cap** — `usePassageMaxHeight` sets `max-height` on the passage
     scroll container (content-sized below the cap, `overflow-y-auto` at cap).
     Formula (viewport-anchored):
     `innerHeight − passageTop − inputPanelHeight − statsPanelHeight − 24px`
     where `24px` is inter-region spacing (`gap-2` + `gap-3`, rounded up)—not
     reserved Stats space; Stats height is measured separately.
  2. **ResizeObserver** — Observe `inputPanel`, `statsPanel`, and layout root;
     recompute on window resize and when description/timer/stats expand or
     collapse changes chrome height.
  3. **Stats placement** — Normal flow directly under the input workspace; not
     `position: sticky`. Short passages: stats follow input with only page
     `gap-3`; extra whitespace may sit below stats. Long passages: cap keeps
     stats/buttons in the viewport without page scroll on entry.
  4. **Route shell** — Typing route uses `min-h-dvh` and `main { overflow-y-auto }`
     instead of locking `html/body` overflow; page scroll remains available when
     content exceeds the viewport (e.g. `lastSaved` banner).
  5. **Passage cursor scroll** — Existing `scrollPassageToTypingCursor` unchanged;
     scrolls inside the capped passage box.
  6. **Info tooltips** — Shared `InfoTooltip` with `placement: 'top' | 'bottom'`;
     WPM help in the stats bar uses `top` (opens upward near viewport bottom);
     Immersive help keeps `bottom`.
- Rejected alternatives:
  - Passage `flex-1` fill — fixes long text but blows vertical gap on short text.
  - `flex-1` spacer between input and stats — pushes stats to viewport bottom on
    short courses; conflicts with “stats follow input”.
  - Sticky stats footer — rejected for guest/short-course UX.
  - `max-height` without stats reservation — long text hid stats below fold.
  - Portal/auto-flip tooltips for WPM — fixed `placement="top"` sufficient.
- Consequences:
  - Implementation: `apps/web/src/lib/usePassageMaxHeight.ts`, `TypingPage.tsx`,
    `AppLayout.tsx`, `InfoTooltip.tsx`.
  - `statsPanel` ref must wrap the full stats/buttons/`lastSaved` block so height
    changes trigger recalculation.
  - Very short viewports still clamp at `min 120px` passage height; edge layouts
    may need minor scroll.
- Supersedes / superseded-by: none (refines interim `7ad406c` layout approach in code only; no prior ADR flipped)

---

## ADR-0018 — Course editor: client-side .txt import with `{phrase}{annotation}` markers
- Status: Accepted (2026-07-06)
- Commit/PR anchor: aa65d7d
- Plain summary: Users can load course text from a local .txt file in the editor;
  plain text fills the content field only, while an optional `{phrase}{annotation}`
  marker format can pre-fill annotations in one step — all parsing stays in the
  browser with no file upload.
- Context: Authors preparing longer passages with many annotations need a faster
  path than picking each span in Step 3. Uploading files to the server would add
  API surface, storage, and cost for a create-time convenience that only needs
  the parsed `content` + `AnnotationInput[]` the editor already sends on save.
- Decision:
  1. **Pure client import** — Step 1 "Import from .txt" uses a hidden file input
     and `FileReader`; no new API route or cloud storage.
  2. **Shared parser** — `parseAnnotatedTxt(raw, mode)` lives in
     `packages/shared/src/parseTxtImport.ts` as a pure function (guest + authed,
     unit-tested via `pnpm --filter @echotype/shared test`).
  3. **Marker syntax (v1)** — Adjacent `{phrase}{annotation}` pairs only; phrase
     text is written into `content` at scan position; the second brace pair is
     the annotation text. No escape syntax; `{` / `}` cannot appear in plain text
     (stray `}` is an error). Output indices are UTF-16 code units with inclusive
     `endIndex`, matching `CreateCourseInput` / `buildPayload()` — no schema or
     API change.
  4. **Parse-time prechecks** — Syntax errors and shared business rules
     (`NOTE_TEXT_MAX`, `MAX_ANNOTATIONS`, mode length, control characters,
     whitespace anchors) fail at import with line-numbered messages, reusing
     shared constants and validators — not deferred to Step 4 save.
  5. **Editor integration** — `importParsed` replaces content + staged annotations,
     advances `contentBaseline` (import must not trigger Phase 4 review), sets
     `needAnnotation` when markers produced annotations; Step 2 hides the
     Yes/No choice when annotations are already staged; overwrite confirm when
     existing content/annotations would be replaced.
- Rejected alternatives:
  - Server upload + parse endpoint — unnecessary cost and API surface for a
    create-time convenience.
  - Parser only in `apps/web` — duplicates contract risk; guest catalog editor
    needs the same path.
  - Defer business-rule checks to save — errors lose line-number mapping to the
    source `.txt`.
  - v1 escape syntax for literal `{` in plain text — deferred; unclosed `{`
    covers pasted mistakes.
- Consequences:
  - Implementation: `parseTxtImport.ts`, `useCourseEditor.importParsed`,
     `CourseEditorModal` Step 1 UI + `InfoTooltip` `align="end"` for right-edge
     tooltips.
  - Future v2 (escape, multi-line markers, other formats) must extend or
     supersede this ADR; do not silently change marker pairing rules.
  - Plain-text import still runs mode-length validation; authors cannot import
    text that violates the locked course mode without fixing the file or mode.
- Supersedes / superseded-by: none

---

## ADR-0019 — Typing page: client-side Export .txt backup (inverse of ADR-0018)
- Status: Accepted (2026-07-06)
- Commit/PR anchor: a0cbf80
- Plain summary: On the typing page, users can download a local `.txt` backup of the
  current course; annotations appear as `{phrase}{annotation}` pairs in the file
  body, with title and description in a fixed two-line header — all in the
  browser, no upload.
- Context: Import (ADR-0018) lets authors load marked text into the editor; users
  also need the reverse path to back up courses they already saved. The typing
  page already holds `title`, `description`, `content`, and `annotations` from
  the existing course fetch — serializing locally avoids new API routes and AWS
  cost.
- Decision:
  1. **Pure client export** — Typing page "Export .txt" builds text in memory and
     triggers download via `Blob` + `URL.createObjectURL`; no server write.
  2. **Shared serializer** — `serializeAnnotatedTxt` in
     `packages/shared/src/serializeTxtExport.ts` is the inverse of
     `parseAnnotatedTxt`: sort annotations by `startIndex`, emit
     `{slice}{noteText}` for each range, then append trailing plain text.
     Round-trip property: body (after header) re-parses to identical
     `content` + `AnnotationInput[]` (unit-tested).
  3. **Fixed header (v1)** — Always exactly two lines plus a blank separator:
     `title: …`, `description: …` (empty value when none), then body. Newlines
     inside `description` collapse to spaces so the header stays two lines.
     Header is backup metadata only — the importer (ADR-0018) does not read it;
     re-import requires manually deleting the first two header lines (v1).
  4. **Filename** — `sanitizeTxtFilename(title)` → `{title}.txt`, replacing
     filesystem-illegal characters; fallback `course.txt` when title cleans empty.
  5. **UI** — Button on typing page header (opposite `← Back`), text-link style
     with underline; compact `InfoTooltip` (`size="sm"`) explains marker format
     and re-import steps.
- Rejected alternatives:
  - Server-side export endpoint or S3 — unnecessary for backup; same zero-cost
    rationale as ADR-0018 import.
  - Importer auto-strips `title:`/`description:` header — deferred; keeps import
    parser single-purpose and header format free to evolve.
  - Omit empty `description:` line — rejected; fixed two-line header is easier
    to scan and document.
- Consequences:
  - Implementation: `serializeTxtExport.ts`, `TypingPage` export handler,
     `InfoTooltip` `size` prop.
  - Courses whose plain `content` contains `{`/`}` export fine for backup but
    cannot round-trip through import (same v1 limit as ADR-0018).
  - Future header-aware import or escape syntax needs a new ADR; do not extend
    the serializer header format without one.
- Supersedes / superseded-by: none (complements ADR-0018; shared marker syntax)

---

## ADR-0020 — Typing page: forgiving mode (relaxed alignment grading)
- Status: Accepted (2026-07-06)
- Commit/PR anchor: 53d31c3 (`3ad0bbf` tooltip copy)
- Plain summary: Optional typing-page toggle relaxes accuracy grading — spaces,
  punctuation, and Latin letter case do not count as errors — while sync,
  progress, and char-based metrics stay the same as strict mode; preference is
  client-only (localStorage), not stored per session row.
- Context: Learners wanted lower-pressure practice without changing how they
  move through the passage or how WPM/charCount are defined. Product rejected
  auto-skipping spaces/punctuation (cursor must still visit every target index)
  and rejected persisting a per-session mode flag in the DB for MVP.
- Decision:
  1. **`AlignMode`** — `'strict'` (default) vs `'forgiving'`. Shared helpers in
     `apps/web/src/lib/typingAlign.ts` take optional `mode`.
  2. **Same sync walk** — `syncTypedToTarget`, `alignedProgress`, and
     `isPassComplete` use the strict index walk in both modes (ADR-0007 newline
     skip unchanged). Forgiving does **not** auto-advance past ignorable target
     characters.
  3. **Grading rules (forgiving only)** — `countAlignedErrors` and
     `buildTargetStatuses`:
     - **Ignorable target** — Unicode whitespace (`\p{Z}`, incl. space/tab/CR/LF)
       or punctuation (`\p{P}`): any typed character at that aligned index is
       correct.
     - **Core target** — letter (`\p{L}`) or number (`\p{N}`): must match;
       Latin↔Latin compares case-insensitively (`toLocaleLowerCase('en')`);
       other scripts exact.
     - Typed `\n` when target is not `\n` still counts as an error (same as
       strict `wrong-enter` display path).
  4. **Stats contract** — Live and persisted accuracy/error formulas unchanged
     (STATS.md §1.5, §2): denominators remain `typed.length` / `charCount`;
     numerators use forgiving `countAlignedErrors` when the toggle is on.
     Completed-loop `sessionErrorCount` uses mode at pass completion; Save uses
     mode at persist for the trailing partial buffer.
  5. **Mid-session toggle** — `alignMode` is reactive React state; switching
     re-grades the full current `typed` buffer immediately (not forward-only).
  6. **Persistence of preference** — `FORGIVING_MODE_STORAGE_KEY`
     (`echotype-forgiving-mode`); no `alignMode` column on `TypingSession`.
  7. **UI** — `TypingModeSwitch` beside Immersive; user-facing InfoTooltip
     explains lower-pressure grading (ignores spaces, punctuation, English case).
- Rejected alternatives:
  - Auto-skip ignorable target indices — hides punctuation/spacing from practice;
    rejected after UX review (cursor must type through each index).
  - Per-keystroke mode snapshot — deferred; reactive full-buffer re-grade is
    simpler for MVP.
  - Store forgiving flag on `TypingSession` — unnecessary for MVP analytics.
  - Course-locale-specific case rules — Latin case fold only; CJK/exact elsewhere.
- Consequences:
  - Implementation: `typingAlign.ts`, `typingAlign.test.ts`, `typingSurface.ts`,
    `TypingPage.tsx`, `AnnotatedText.tsx` (`skipped-ignorable` style reserved).
  - Saved sessions saved under forgiving mode are not labeled forgiving in the DB;
    historical rows remain strict-graded.
  - Toggling before Save can change displayed live accuracy without new keystrokes.
- Supersedes / superseded-by: none (extends ADR-0006/0007 grading only; sync unchanged)

---

## ADR-0021 — Immersive mode: passage refocus and amber unfocused hint
- Status: Accepted (2026-07-07)
- Commit/PR anchor: 3d0f3e9
- Plain summary: When immersive mode hides the typing box, a light amber overlay
  on the passage shows that the hidden textarea lost focus; clicking the passage
  refocuses input. Passage drag-select/copy is intentionally disabled in
  immersive; viewing or copying typed input requires turning immersive off.
- Context: The hidden textarea (`opacity-0`, `pointer-events-none`) gives no
  visible caret. Clicks on stats, timer, or mode switches blur the textarea and
  keystrokes no longer register, with no recovery affordance besides disabling
  immersive. ADR-0008 already notes IME candidates may render off-screen.
- Decision:
  1. **Focus tracking** — Textarea `onFocus` / `onBlur` drive UI state; initial
     `typingInputFocused = true` to avoid a first-paint hint flash.
  2. **Unfocused hint** — When immersive and textarea is not focused, render a
     `pointer-events-none` overlay on the passage (`bg-amber-50/70`, `inset-0`,
     `rounded-md`). Amber matches annotation palette; avoids error-red typing
     colors and hard-to-see gray rings (outer rings clip under passage
     `overflow-y-auto`).
  3. **Refocus** — Passage `mousedown` (immersive only): skip targets inside
     `[role="button"]` (annotation notes); `preventDefault()` then
     `textarea.focus({ preventScroll: true })`.
  4. **Helper copy** — "click the passage to type"; do not promise "start typing"
     when unfocused (keys do not reach the textarea without focus).
  5. **Passage selection** — `preventDefault` on mousedown blocks drag-select and
     copy of passage text in immersive; product accepts this tradeoff.
  6. **Immersive off** — No overlay, no passage handler, helper hidden; unchanged
     from pre-ADR behavior.
  7. **Deferred** — Global keydown refocus without clicking the passage.
- Rejected alternatives:
  - Gray `ring` on passage border — too faint on white; outward ring clipped by
    scroll container overflow.
  - Red ring — conflates with wrong-character color; feels punitive for a
    low-pressure mode.
  - Remove `preventDefault` to restore passage drag-select — rejected after
    acceptance; refocus reliability and immersive-as-typing-only scope.
  - Global keydown refocus — first keystroke often lost on focus swap; deferred.
- Consequences:
  - Implementation: `TypingPage.tsx` only; overlay uses
    `data-testid="immersive-passage-unfocused"` when visible.
  - Users who need passage copy or visible typed draft must turn immersive off
    (helper states the latter).
- Supersedes / superseded-by: none (refines immersive UX noted in ADR-0008; no ADR flip)

---

## ADR-0022 — Custom domain: echotype.ink via ACM (us-east-1) and CloudFront alias
- Status: Accepted (2026-07-08)
- Commit/PR anchor: 8cca01c
- Plain summary (owner reads this): Production is served at **https://echotype.ink**.
  An ACM certificate in us-east-1 covers the apex and wildcard; Porkbun hosts DNS
  (validation CNAME + apex ALIAS to CloudFront). Terraform sets CloudFront alternate
  domain name, SSM `WEB_ORIGIN`, and Cognito callback/logout URLs from `custom_domain`.
- Context: Auth (ADR-0015) required config-driven public URLs; Google sign-in was
  blocked until a stable hostname. Cloud deploy (ADR-0003) used `*.cloudfront.net`.
  Owner purchased **echotype.ink** at Porkbun (Cloudflare-powered DNS, no nameserver
  migration).
- Decision:
  1. **Canonical hostname** — apex `https://echotype.ink` only; no `www` CloudFront
     alias in Phase 1.
  2. **ACM** — `aws_acm_certificate` in **us-east-1** (CloudFront requirement);
     `echotype.ink` + `*.echotype.ink`; DNS validation CNAME added manually in
     Porkbun (not Route53).
  3. **Terraform apply order** — two-step: (a) `terraform apply
     -target=aws_acm_certificate.web`, add validation CNAME, wait until `ISSUED`;
     (b) full apply for `aws_acm_certificate_validation`, CloudFront alias + ACM
     viewer certificate, SSM `WEB_ORIGIN`, Cognito app-client URLs.
  4. **Traffic DNS** — edit existing Porkbun apex **ALIAS** (parking
     `pixie.porkbun.com` → `d3a9mgremswg7d.cloudfront.net`); add traffic DNS only
     after CloudFront status `Deployed`. Run `deploy.yml` after DNS cutover (health
     check uses SSM `WEB_ORIGIN`).
  5. **Config** — `variable custom_domain` (default `echotype.ink`);
     `local.web_origin = "https://${var.custom_domain}"` feeds SSM and Cognito;
     `dev_web_origin` (`http://localhost:5173`) unchanged.
  6. **Phase 1 shipped** (`8cca01c`): prod verified — site load, `/api/health`,
     login, logout on https://echotype.ink.
- Rejected alternatives:
  - `www` as canonical with apex redirect — deferred; apex only for MVP.
  - ACM in ap-southeast-2 — invalid for CloudFront custom certificates.
  - Route53 hosted zone — unnecessary while DNS stays at Porkbun.
  - Single terraform apply before cert validation completes — two-step apply reduces
    plan risk and matches manual Porkbun CNAME workflow.
  - Keeping `*.cloudfront.net` in Cognito callbacks after cutover — removed; old
     CloudFront URL may still serve the app but is not an authorized callback URL.
- Consequences:
  - Custom domain capability Phase 1 complete; Google sign-in unblocked for Auth
    follow-up (STATE Known debt).
  - Porkbun `*.echotype.ink` CNAME may still point to parking; only apex is in prod.
  - Outputs: `site_url` (canonical), `cloudfront_url` (default domain, debug/transition).
  - Infra: `infra/acm.tf`, provider alias `aws.us_east_1` in `infra/versions.tf`.
- Supersedes / superseded-by: none (extends ADR-0003 hostname; fulfills ADR-0015 §7
  prod URL path)

---

## ADR-0023 — Ops Phase 1: Sentry error reporting (web + API)
- Status: Accepted (2026-07-09)
- Commit/PR anchor: f2fb0d5
- Plain summary: Production errors from the React SPA and Fastify API are reported to
  Sentry (`echotype-web` + `echotype-api`). DSNs live in SSM; CI uploads web source maps
  via GitHub Secret `SENTRY_AUTH_TOKEN`. CloudWatch and API rate limiting stay deferred.
- Context: Ops & safety capability (STATE); custom domain at https://echotype.ink
  (ADR-0022). Owner needed client/server visibility before external sharing and
  disclaimer work (Phase 2).
- Decision:
  1. **Projects** — two Sentry projects: `echotype-web`, `echotype-api` (org `echotype`).
  2. **SDKs** — `@sentry/react` (Vite build + router error boundary) and `@sentry/node`
     (Fastify `setErrorHandler`; Zod validation 400 not reported).
  3. **Secrets** — `SENTRY_DSN_WEB` (SSM String, CI → `VITE_SENTRY_DSN`);
     `SENTRY_DSN_API` (SSM SecureString, EC2 `deploy/.env` → `SENTRY_DSN`);
     `SENTRY_AUTH_TOKEN` (GitHub Secret only, source-map upload).
  4. **Releases** — `SENTRY_RELEASE` = deploy git sha (`github.sha` web;
     `git rev-parse HEAD` on EC2 for API).
  5. **Sampling** — `tracesSampleRate: 0` (errors only in Phase 1).
  6. **Web source maps** — `@sentry/vite-plugin` when `SENTRY_AUTH_TOKEN` set;
     `filesToDeleteAfterUpload` + `s3 sync --exclude "*.map"`; no maps published.
  7. **API runtime** — keep `tsx src/server.ts` in cloud compose; no API source-map
     upload in Phase 1.
  8. **Acceptance probes** — web: `?sentry_test=1` (prod + DSN); API:
     `GET /api/debug/sentry` only when `SENTRY_DEBUG=1` on the instance (removed after
     probe); `ops-sentry-probe.mjs` scripts for local/CI smoke.
  9. **Scrubbing** — `beforeSend` strips `Authorization` / `Cookie` headers.
  10. **Deferred** — CloudWatch structured logging/alarms and API rate limiting
      (STATE Phase 2 note; revisit when user volume warrants).
- Rejected alternatives:
  - Single combined Sentry project — split for alert/release clarity.
  - Browser tracing in Phase 1 — errors-only MVP.
  - API `node dist/` + source maps in Phase 1 — scope; tsx stacks sufficient.
  - Permanent public debug route — env-gated only.
- Consequences:
  - Terraform: `infra/ssm.tf` DSN parameters; `github_deploy` IAM reads
    `SENTRY_DSN_WEB`.
  - Prod verified: web and API probe issues in Sentry; web release artifacts include
    source files.
- Supersedes / superseded-by: none
