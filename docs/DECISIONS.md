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
- Commit/PR anchor: b2a226a (Phase 1 pool + SSM); `0018106` (EC2 AMI lifecycle ignore — ops, not auth); `43ae465` (Phase 2 user model + seed split)
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
- Rejected alternatives:
  - email as `users` PK — blocks future Google account linking.
  - Post-login nickname modal — extra “verified but incomplete profile” state complicates
    onboarding trigger and list UX.
  - Cognito Hosted UI as primary UX — SPA owns forms; pool client still env-configured.
  - Pinning or auto-replacing EC2 on every AL2023 AMI publish — accidental instance
    replacement during Phase 1 apply; addressed by `lifecycle { ignore_changes = [ami] }`
    (`0018106`); OS updates are deliberate maintainer actions.
- Consequences:
  - Auth capability active; Phase 3 next (API JWT; remove shim).
  - Phase 6 blocked on owner onboarding seed content (STATE reminder); catalog data in
    `prisma/fixtures/courseCatalog.ts`.
  - Do not deploy Phases 2–3 to prod without Phase 4 Web auth (401 wall for browser).
  - Unrelated `terraform apply` should use `-target` for Cognito-only changes until AMI
    lock is on all environments, or rely on `0018106` lifecycle on `aws_instance.app`.
- Supersedes / superseded-by: none
