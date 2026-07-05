import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  NOTE_FONT_PX,
  NOTE_LINE_PX,
  NOTE_MAX_LINES,
  NOTE_SLOT_PX,
  buildLineData,
  type Band,
  type LineDatum,
  type Note,
} from './annotated-text/layoutUtils';
import { useTextMeasurement } from './annotated-text/useTextMeasurement';
import type { TargetCharStatus } from '../lib/typingAlign';
import { TYPING_SURFACE_CLASS } from '../lib/typingSurface';

// Read-only annotated text renderer (Phase 2.0).
//
// Architecture (Phase 2 design; measurement details in docs/DECISIONS.md ADR-0002):
//   - A hidden, full-width "mirror" holds the whole content in normal flow
//     (white-space: pre-wrap). It is the single source of truth for where the
//     browser wraps. We measure visual-line index ranges from it via each
//     char span's offsetTop (integer -> stable grouping).
//   - The visible layer renders ONE block per measured visual line with
//     white-space: pre (never re-wraps), so it reproduces the mirror's breaks
//     exactly. This is what lets a line with no annotation collapse its slot.
//   - Two decoupled update paths:
//       * lines/charWidth/charHeight (layout) -> only re-measured on
//         [content, width, fontReady]. NEVER on a keystroke.
//       * per-char typed status -> flows through memoized <Char> so a keystroke
//         only mutates the 1-2 chars that changed, never the line structure.

export type CharStatus = 'untyped' | 'correct' | 'wrong' | 'cursor';

export type { TargetCharStatus };

export interface AnnotationView {
  id: string;
  startIndex: number;
  endIndex: number; // inclusive, matches the API contract
  noteText: string;
}

interface AnnotatedTextProps {
  content: string;
  annotations: AnnotationView[];
  /** Legacy index-aligned diff when typingStatuses omitted. */
  typed?: string;
  /** Typing page: per-target-index statuses from sync alignment (direction R). */
  typingStatuses?: TargetCharStatus[];
  /** Typing page: click truncated notes to view full text in a popover. */
  clickableNotes?: boolean;
  className?: string;
}

function legacyCharClassName(ch: string, typedCh: string | undefined, isCursor: boolean): string {
  if (typedCh !== undefined) {
    return typedCh === ch ? 'text-emerald-600' : 'rounded-sm bg-red-200 text-red-800';
  }
  if (isCursor) return 'underline decoration-2 underline-offset-2 text-slate-700';
  return 'text-slate-400';
}

function typingStatusClassName(status: TargetCharStatus): string {
  switch (status) {
    case 'correct':
      return 'text-emerald-600';
    case 'wrong':
      return 'rounded-sm bg-red-200 text-red-800';
    case 'correct-newline':
      return 'text-emerald-600';
    case 'wrong-enter':
      return 'rounded-sm bg-red-200 text-red-800';
    case 'cursor':
      return 'underline decoration-2 underline-offset-2 text-slate-700';
    case 'skipped-newline':
    case 'untyped':
    default:
      return 'text-slate-400';
  }
}

function renderLegacyChar(ch: string, typedCh: string | undefined, isCursor: boolean) {
  return (
    <span className={`relative z-[1] ${legacyCharClassName(ch, typedCh, isCursor)}`}>
      {ch === '\n' ? '' : ch}
    </span>
  );
}

function renderTypingChar(ch: string, status: TargetCharStatus) {
  if (status === 'skipped-newline') {
    return <span className="relative z-[1]" aria-hidden />;
  }
  if (status === 'correct-newline' || status === 'wrong-enter') {
    return (
      <span className={`relative z-[1] ${typingStatusClassName(status)}`} aria-label="line break">
        ↵
      </span>
    );
  }
  if (ch === '\n' && status !== 'cursor') {
    return <span className="relative z-[1]" aria-hidden />;
  }
  return (
    <span
      className={`relative z-[1] ${typingStatusClassName(status)}`}
      data-typing-cursor={status === 'cursor' ? 'true' : undefined}
    >
      {ch === '\n' ? '' : ch}
    </span>
  );
}

const Char = memo(function Char({
  ch,
  typedCh,
  isCursor,
}: {
  ch: string;
  typedCh: string | undefined;
  isCursor: boolean;
}) {
  return renderLegacyChar(ch, typedCh, isCursor);
});

const TypingChar = memo(function TypingChar({
  ch,
  status,
}: {
  ch: string;
  status: TargetCharStatus;
}) {
  return renderTypingChar(ch, status);
});

const NoteBox = memo(function NoteBox({
  note,
  clickable,
  isOpen,
  onToggle,
}: {
  note: Note;
  clickable: boolean;
  isOpen: boolean;
  onToggle?: (el: HTMLElement) => void;
}) {
  return (
    <span
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-hidden={isOpen ? true : undefined}
      className={`absolute top-0 block overflow-hidden text-amber-700 ${clickable ? 'cursor-pointer' : ''}`}
      style={{
        left: note.left,
        width: note.width,
        fontSize: NOTE_FONT_PX,
        lineHeight: `${NOTE_LINE_PX}px`,
        display: '-webkit-box',
        WebkitLineClamp: NOTE_MAX_LINES,
        WebkitBoxOrient: 'vertical',
        visibility: isOpen ? 'hidden' : 'visible',
      }}
      title={note.text}
      onMouseDown={clickable ? (e) => e.preventDefault() : undefined}
      onClick={
        clickable
          ? (e) => {
              onToggle?.(e.currentTarget);
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle?.(e.currentTarget);
              }
            }
          : undefined
      }
    >
      {note.text}
    </span>
  );
});

const LineDecorations = memo(function LineDecorations({
  notes,
  clickableNotes,
  openNoteId,
  onNoteToggle,
}: {
  notes: Note[];
  clickableNotes: boolean;
  openNoteId: string | null;
  onNoteToggle: (noteId: string, el: HTMLElement) => void;
}) {
  if (notes.length === 0) return null;
  return (
    <div className="relative" style={{ height: NOTE_SLOT_PX }}>
      {notes.map((n) => (
        <NoteBox
          key={n.id}
          note={n}
          clickable={clickableNotes}
          isOpen={openNoteId === n.id}
          onToggle={(el) => onNoteToggle(n.id, el)}
        />
      ))}
    </div>
  );
});

const BandLayer = memo(function BandLayer({
  bands,
  charHeight,
}: {
  bands: Band[];
  charHeight: number;
}) {
  if (bands.length === 0) return null;
  return (
    <>
      {bands.map((b, i) => (
        <span
          key={`${b.id}-${i}`}
          aria-hidden
          className="absolute left-0 top-0 z-0 rounded-sm bg-amber-100"
          style={{ left: b.left, width: b.width, height: charHeight || '1.6em' }}
        />
      ))}
    </>
  );
});

const LineRow = memo(function LineRow({
  datum,
  chars,
  typed,
  typingStatuses,
  charHeight,
  clickableNotes,
  openNoteId,
  onNoteToggle,
}: {
  datum: LineDatum;
  chars: string[];
  typed: string;
  typingStatuses?: TargetCharStatus[];
  charHeight: number;
  clickableNotes: boolean;
  openNoteId: string | null;
  onNoteToggle: (noteId: string, el: HTMLElement) => void;
}) {
  const indices: number[] = [];
  for (let i = datum.start; i <= datum.end; i++) indices.push(i);
  const useTypingStatuses = typingStatuses !== undefined;
  return (
    <div className="mb-2.5 last:mb-0">
      <LineDecorations
        notes={datum.notes}
        clickableNotes={clickableNotes}
        openNoteId={openNoteId}
        onNoteToggle={onNoteToggle}
      />
      <div className="relative" style={{ whiteSpace: 'pre' }}>
        <BandLayer bands={datum.bands} charHeight={charHeight} />
        <span className="relative z-[1]">
          {indices.map((i) =>
            useTypingStatuses ? (
              <TypingChar key={i} ch={chars[i] ?? ''} status={typingStatuses[i] ?? 'untyped'} />
            ) : (
              <Char
                key={i}
                ch={chars[i] ?? ''}
                typedCh={i < typed.length ? typed[i] : undefined}
                isCursor={i === typed.length}
              />
            ),
          )}
        </span>
      </div>
    </div>
  );
});

function NotePopover({
  text,
  anchorEl,
  popoverRef,
  onClose,
}: {
  text: string;
  anchorEl: HTMLElement;
  popoverRef: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, minWidth: 0, maxWidth: 240 });

  useLayoutEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    setPos({
      top: rect.top,
      left: rect.left,
      minWidth: rect.width,
      maxWidth: Math.max(rect.width, 240),
    });
  }, [anchorEl, text]);

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Annotation note"
      data-testid="note-popover"
      className="fixed z-50 cursor-pointer rounded-md border border-amber-200 bg-white px-2 py-1 text-amber-800 shadow-md"
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.minWidth,
        maxWidth: pos.maxWidth,
        fontSize: NOTE_FONT_PX,
        lineHeight: `${NOTE_LINE_PX}px`,
        whiteSpace: 'pre-wrap',
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClose}
    >
      {text}
    </div>,
    document.body,
  );
}

export function AnnotatedText({
  content,
  annotations,
  typed = '',
  typingStatuses,
  clickableNotes = false,
  className,
}: AnnotatedTextProps) {
  const { refs, layout, chars } = useTextMeasurement(content);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [openNoteAnchorEl, setOpenNoteAnchorEl] = useState<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const lineData = useMemo(
    () =>
      buildLineData(
        layout.lines,
        annotations.map((a) => ({
          id: a.id,
          startIndex: a.startIndex,
          endIndex: a.endIndex,
          noteText: a.noteText,
        })),
        layout.charWidth,
        layout.charHeight,
        undefined,
        layout.charEdges,
      ),
    [layout, annotations],
  );

  const openNoteText = useMemo(() => {
    if (!openNoteId) return null;
    for (const datum of lineData) {
      const note = datum.notes.find((n) => n.id === openNoteId);
      if (note) return note.text;
    }
    return null;
  }, [openNoteId, lineData]);

  const closePopover = useCallback(() => {
    setOpenNoteId(null);
    setOpenNoteAnchorEl(null);
  }, []);

  const handleNoteToggle = useCallback(
    (noteId: string, el: HTMLElement) => {
      if (openNoteId === noteId) {
        closePopover();
        return;
      }
      setOpenNoteId(noteId);
      setOpenNoteAnchorEl(el);
    },
    [openNoteId, closePopover],
  );

  useEffect(() => {
    if (!clickableNotes) return;
    if (!openNoteId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (openNoteAnchorEl?.contains(target)) return;
      closePopover();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [clickableNotes, openNoteId, openNoteAnchorEl, closePopover]);

  useEffect(() => {
    if (!clickableNotes) return;
    if (!openNoteId) return;

    window.addEventListener('resize', closePopover);
    const onScroll = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
      closePopover();
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', closePopover);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [clickableNotes, openNoteId, closePopover]);

  useEffect(() => {
    if (!clickableNotes && openNoteId) closePopover();
  }, [clickableNotes, openNoteId, closePopover]);

  return (
    <div
      className={`${TYPING_SURFACE_CLASS} ${className ?? ''}`}
      data-testid="annotated-text"
    >
      <div ref={refs.boxRef as Ref<HTMLDivElement>} style={{ position: 'relative' }}>
        <div
          ref={refs.mirrorRef as Ref<HTMLDivElement>}
          aria-hidden
          data-testid="annotated-mirror"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {chars.map((ch, i) => (
            <span key={i} data-idx={i}>
              {ch}
            </span>
          ))}
        </div>

        <div data-testid="annotated-visible">
          {lineData.map((datum) => (
            <LineRow
              key={`${datum.start}-${datum.end}`}
              datum={datum}
              chars={chars}
              typed={typed}
              typingStatuses={typingStatuses}
              charHeight={layout.charHeight}
              clickableNotes={clickableNotes}
              openNoteId={openNoteId}
              onNoteToggle={handleNoteToggle}
            />
          ))}
        </div>
      </div>

      {clickableNotes && openNoteId && openNoteAnchorEl && openNoteText && (
        <NotePopover
          text={openNoteText}
          anchorEl={openNoteAnchorEl}
          popoverRef={popoverRef}
          onClose={closePopover}
        />
      )}
    </div>
  );
}
