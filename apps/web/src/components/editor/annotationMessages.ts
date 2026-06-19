// User-facing validation copy for the annotation editor.

import type { AnnotationIssue, AnnotationIssueCode, ModeIssue } from '@echotype/shared';
import type { DraftAnnotation } from './useCourseEditor';

export { formatContentIssueMessage } from '@echotype/shared';

export const STEP3_NO_ANNOTATION_MESSAGE =
  'You chose to add annotations but have not added any yet. If you do not need annotations, go back and choose "No".';

export const MSG_ANCHOR_START_WHITESPACE =
  'The start anchor cannot be a space or line break. Pick again.';
export const MSG_ANCHOR_END_WHITESPACE =
  'The end anchor cannot be a space or line break. Pick again.';
export const MSG_ORDER_INVALID = 'Invalid anchor order. Pick again.';
export const MSG_ILL_FORMED_RANGE =
  'Anchor range splits an emoji or combined character. Reselect the full character.';
export const MSG_BOUNDS_INVALID = 'Anchor range is outside the text. Reselect anchors.';
export const MSG_NOTE_EMPTY = 'Annotation text cannot be empty.';
export const MSG_SERIAL_BLOCK = 'Finish or cancel the current annotation first.';
export const MSG_ESC_DISCARD = 'Discard the current annotation text?';
export const MSG_ABANDON_PICK = 'You have an unfinished annotation. Discard it?';
export const MSG_DISCARD_ALL_CHANGES = 'Discard all changes?';

export const MSG_CONTENT_REVIEW_WARNING =
  'Changing content may invalidate annotation anchors. Notes that no longer match will need review on the next step.';

export function formatReviewBanner(count: number): string {
  const noun = count === 1 ? 'note' : 'notes';
  return `⚠ ${count} ${noun} need review — use Reselect or Delete below, or click a yellow highlight in the editor.`;
}

export const MSG_REVIEW_COMPLETE =
  'All notes match the updated text. You can continue to the preview step.';

export function formatReviewExpandToggle(hiddenCount: number, expanded: boolean): string {
  if (expanded) return 'Show less';
  const total = hiddenCount + 1;
  if (hiddenCount >= 9) return `Show all ${total} notes`;
  return hiddenCount === 1 ? 'and 1 more' : `and ${hiddenCount} more`;
}

export function formatPurgedAnnotationsMessage(count: number): string {
  const noun = count === 1 ? 'annotation' : 'annotations';
  return `${count} ${noun} no longer fit the shortened text and were removed.`;
}

export const MSG_REVIEW_BLOCK =
  'All notes must be reviewed before you can continue. Reselect or delete each yellow note.';

export const MSG_REVIEW_NEW_ANNOTATION =
  'Resolve yellow notes first before creating new annotations.';

export const STEP3_HELPER_REVIEW =
  'Yellow highlights need re-anchoring — click a yellow range or use Reselect in the banner. Amber = saved annotations.';

export const STEP3_HELPER_DEFAULT =
  'Click two characters to anchor an annotation. Amber = saved, indigo = in progress.';

export function truncateForDisplay(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

export const MSG_INVALID_REQUEST =
  'Invalid request. Check your input and try again.';
export const MSG_SERVER_ERROR = 'Server error. Please try again.';
export const MSG_NETWORK_ERROR = 'Network error. Check your connection and try again.';

export function formatNotePreview(noteText: string, fallbackIndex: number): string {
  const t = noteText.trim();
  if (!t) return `annotation #${fallbackIndex}`;
  return t.length > 20 ? `${t.slice(0, 20)}…` : t;
}

export function formatOverlapMessage(noteText: string, fallbackIndex: number): string {
  return `Overlaps existing annotation "${formatNotePreview(noteText, fallbackIndex)}". Pick different anchors.`;
}

export function mapModeIssueMessage(issue: ModeIssue): string {
  return issue.message;
}

export function mapAnnotationIssueMessage(
  issue: AnnotationIssue,
  staged: DraftAnnotation[],
  payloadAnnotations: { startIndex: number; endIndex: number; noteText: string }[],
): string {
  const code = issue.code as AnnotationIssueCode;
  const idx = issue.index;
  const ann = staged[idx];
  const label = ann ? formatNotePreview(ann.noteText, idx + 1) : `annotation #${idx + 1}`;

  switch (code) {
    case 'anchor_start_whitespace':
      return `Annotation "${label}": ${MSG_ANCHOR_START_WHITESPACE}`;
    case 'anchor_end_whitespace':
      return `Annotation "${label}": ${MSG_ANCHOR_END_WHITESPACE}`;
    case 'order':
      return `Annotation "${label}": ${MSG_ORDER_INVALID}`;
    case 'bounds':
      return `Annotation "${label}": ${MSG_BOUNDS_INVALID}`;
    case 'ill_formed_range':
      return `Annotation "${label}": ${MSG_ILL_FORMED_RANGE}`;
    case 'overlap': {
      const overlapMsg = issue.message.match(/annotation #(\d+)/);
      const otherIdx = overlapMsg ? Number(overlapMsg[1]) : -1;
      const otherNote =
        otherIdx >= 0 ? payloadAnnotations[otherIdx]?.noteText ?? staged[otherIdx]?.noteText : '';
      const otherLabel = formatNotePreview(otherNote ?? '', otherIdx + 1);
      return `Annotation "${label}": overlaps "${otherLabel}". Pick different anchors.`;
    }
    default:
      return `Annotation "${label}": ${MSG_ORDER_INVALID}`;
  }
}
