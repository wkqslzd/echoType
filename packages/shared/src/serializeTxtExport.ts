// Reverse of parseAnnotatedTxt: serialize a course back into the .txt import
// format so users can keep a local backup. Body is the exact inverse of the
// import syntax — annotated slices become adjacent {phrase}{annotation} pairs.
//
// Layout (v1):
//   1. Fixed two-line header (`title:` / `description:`) + blank separator
//   2. Body (content with optional markers)
//   3. Two blank lines + export-notes footer (always present)
//
// The importer has no special header/footer awareness: leftover title:/description:
// lines and the notes block are ingested as ordinary content (and `{…}{…}` inside
// the footer can become real annotations). Re-import requires deleting both the
// header lines and this entire notes section (ADR-0019 + follow-up).

export type SerializableAnnotation = {
  startIndex: number;
  /** Inclusive, same convention as AnnotationInput. */
  endIndex: number;
  noteText: string;
};

export type SerializeTxtInput = {
  title: string;
  description: string | null;
  content: string;
  annotations: SerializableAnnotation[];
};

/** Banner line that starts the export-notes footer (tests strip from here). */
export const TXT_EXPORT_NOTES_BANNER =
  '=== echoType export notes (delete before Import from .txt) ===';

export const TXT_EXPORT_NOTES_FOOTER = `${TXT_EXPORT_NOTES_BANNER}
Annotated phrases use adjacent {phrase}{annotation} markers in the body.
Example: from whose {bourn}{boundary; limit} no traveller returns.

To bring this file back into echoType: open New course, then use Import from .txt
beside the text content field.
Before importing, delete:
  • the title: and description: lines at the top (otherwise they become part of the course text)
  • this entire notes section (from the === line to the end of the file)`;

/**
 * Build the exported .txt text. Header is always exactly two lines
 * (`title:` and `description:`, the latter empty when the course has none);
 * newlines inside the description collapse to spaces to keep the header fixed.
 * A fixed export-notes footer is always appended (even when there are no annotations).
 */
export function serializeAnnotatedTxt(input: SerializeTxtInput): string {
  const description = (input.description ?? '').replace(/\s*\n\s*/g, ' ').trim();
  const header = `title: ${input.title}\ndescription: ${description}\n\n`;

  const ordered = [...input.annotations].sort((a, b) => a.startIndex - b.startIndex);
  let body = '';
  let pos = 0;
  for (const a of ordered) {
    body += input.content.slice(pos, a.startIndex);
    const phrase = input.content.slice(a.startIndex, a.endIndex + 1);
    body += `{${phrase}}{${a.noteText}}`;
    pos = a.endIndex + 1;
  }
  body += input.content.slice(pos);

  // Two blank lines between body and footer (normalize trailing newline on body).
  const gap = body.endsWith('\n') ? '\n\n' : '\n\n\n';
  return header + body + gap + TXT_EXPORT_NOTES_FOOTER;
}

/** Replace characters that are illegal in common filesystems; keep Unicode letters. */
export function sanitizeTxtFilename(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_')
    .trim();
  return `${cleaned || 'course'}.txt`;
}
