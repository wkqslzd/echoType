// Shared layout math for AnnotatedText (read-only) and AnnotatedTextEditor.
// Measurement depends only on content + container width + font readiness.

export const RESIZE_DEBOUNCE_MS = 100;
export const NOTE_FONT_PX = 12;
export const NOTE_LINE_PX = 12;
export const NOTE_MAX_LINES = 2;
export const NOTE_SLOT_PX = NOTE_LINE_PX * NOTE_MAX_LINES + 2;

export type VisualLine = [start: number, end: number]; // inclusive char indices

export type CharEdgeMetrics = {
  /** Left edge of each char span, px relative to the mirror container. */
  left: number[];
  /** Right edge of each char span, px relative to the mirror container. */
  right: number[];
};

export type MeasuredLayout = {
  lines: VisualLine[];
  charWidth: number;
  charHeight: number;
  /** Per-char measured edges from the mirror; null before first measure. */
  charEdges: CharEdgeMetrics | null;
};

export function measureCharEdges(charEls: HTMLElement[], mirror: HTMLElement): CharEdgeMetrics {
  const origin = mirror.getBoundingClientRect().left;
  const left: number[] = [];
  const right: number[] = [];
  for (const el of charEls) {
    const r = el.getBoundingClientRect();
    left.push(r.left - origin);
    right.push(r.right - origin);
  }
  return { left, right };
}

type RangeFragment = { lineIdx: number; left: number; width: number; charCount: number };

function rangeFragments(
  lines: VisualLine[],
  startIndex: number,
  endIndex: number,
  charWidth: number,
  charEdges: CharEdgeMetrics | null | undefined,
): RangeFragment[] {
  const frags: RangeFragment[] = [];
  for (let li = 0; li < lines.length; li++) {
    const [ls, le] = lines[li]!;
    if (endIndex < ls || startIndex > le) continue;
    const cs = Math.max(startIndex, ls);
    const ce = Math.min(endIndex, le);
    const charCount = ce - cs + 1;
    const useEdges =
      charEdges &&
      charEdges.left.length > ce &&
      charEdges.right.length > ce &&
      charEdges.left.length > ls;
    const left = useEdges ? charEdges.left[cs]! - charEdges.left[ls]! : (cs - ls) * charWidth;
    const width = useEdges ? charEdges.right[ce]! - charEdges.left[cs]! : charCount * charWidth;
    frags.push({ lineIdx: li, left, width, charCount });
  }
  return frags;
}

export type LayoutAnnotation = {
  id: string;
  startIndex: number;
  endIndex: number; // inclusive
  noteText: string;
};

export type Band = { id: string; left: number; width: number; variant?: BandVariant };
export type Note = { id: string; left: number; width: number; text: string };
export type LineDatum = { start: number; end: number; bands: Band[]; notes: Note[] };

export type BandVariant = 'committed' | 'draft' | 'conflict' | 'match' | 'needsReview';

export function toChars(content: string): string[] {
  return content.split('');
}

export function measureVisualLines(charEls: HTMLElement[]): VisualLine[] {
  const first = charEls[0];
  if (!first) return [];
  const lines: VisualLine[] = [];
  let start = 0;
  let top = first.offsetTop;
  for (let i = 1; i < charEls.length; i++) {
    const t = charEls[i]!.offsetTop;
    if (t !== top) {
      lines.push([start, i - 1]);
      start = i;
      top = t;
    }
  }
  lines.push([start, charEls.length - 1]);
  return lines;
}

export function sameLines(a: VisualLine[], b: VisualLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai[0] !== bi[0] || ai[1] !== bi[1]) return false;
  }
  return true;
}

/** Host fragment for a range: default rects[0], widest if rects[0] < 50% of anchor. */
export function findNoteHost(
  lines: VisualLine[],
  startIndex: number,
  endIndex: number,
  charWidth: number,
  charEdges?: CharEdgeMetrics | null,
): { lineIdx: number; left: number; width: number } | null {
  const fullCount = endIndex - startIndex + 1;
  const frags = rangeFragments(lines, startIndex, endIndex, charWidth, charEdges);
  if (frags.length === 0) return null;
  let host = frags[0]!;
  if (host.charCount < 0.5 * fullCount) {
    host = frags.reduce((best, f) => (f.charCount > best.charCount ? f : best), frags[0]!);
  }
  return { lineIdx: host.lineIdx, left: host.left, width: host.width };
}

/** Visual gap carved out of a band whose phrase is index-adjacent to the next one. */
export const ADJACENT_BAND_GAP_PX = 3;

export function buildLineData(
  lines: VisualLine[],
  annotations: LayoutAnnotation[],
  charWidth: number,
  charHeight: number,
  bandVariants?: Record<string, BandVariant>,
  charEdges?: CharEdgeMetrics | null,
): LineDatum[] {
  void charHeight;
  const data: LineDatum[] = lines.map(([start, end]) => ({ start, end, bands: [], notes: [] }));

  // Phrases whose next phrase starts at endIndex + 1 (indices inclusive, no
  // chars in between). Their tail band fragment gets a 3px visual gap so two
  // touching highlights don't fuse into one block.
  const hasAdjacentNext = new Set<string>();
  for (const a of annotations) {
    if (annotations.some((b) => b !== a && b.startIndex === a.endIndex + 1)) {
      hasAdjacentNext.add(a.id);
    }
  }

  for (const a of annotations) {
    const fullCount = a.endIndex - a.startIndex + 1;
    const frags = rangeFragments(lines, a.startIndex, a.endIndex, charWidth, charEdges);
    if (frags.length === 0) continue;

    const variant = bandVariants?.[a.id] ?? 'committed';
    for (const f of frags) {
      // Shrink only the fragment holding the phrase tail, and only when the
      // adjacent next phrase begins on the same visual line (cross-line
      // adjacency never fuses, so it never shrinks). Bubble left/width are
      // untouched — the gap applies to highlight bands only.
      const lineEnd = lines[f.lineIdx]![1];
      const shrink = hasAdjacentNext.has(a.id) && a.endIndex + 1 <= lineEnd;
      const width = shrink ? Math.max(0, f.width - ADJACENT_BAND_GAP_PX) : f.width;
      data[f.lineIdx]!.bands.push({ id: a.id, left: f.left, width, variant });
    }

    let host = frags[0]!;
    if (host.charCount < 0.5 * fullCount) {
      host = frags.reduce((best, f) => (f.charCount > best.charCount ? f : best), frags[0]!);
    }
    if (a.noteText.trim()) {
      data[host.lineIdx]!.notes.push({ id: a.id, left: host.left, width: host.width, text: a.noteText });
    }
  }

  return data;
}
