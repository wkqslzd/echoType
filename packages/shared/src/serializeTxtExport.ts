// Reverse of parseAnnotatedTxt: serialize a course back into the .txt import
// format so users can keep a local backup. Body is the exact inverse of the
// import syntax — annotated slices become adjacent {phrase}{annotation} pairs.
// A fixed two-line header (title / description) plus a blank separator line
// precedes the body; the importer does NOT understand this header (v1), so
// re-importing requires deleting the first three lines.

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

/**
 * Build the exported .txt text. Header is always exactly two lines
 * (`title:` and `description:`, the latter empty when the course has none);
 * newlines inside the description collapse to spaces to keep the header fixed.
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

  return header + body;
}

/** Replace characters that are illegal in common filesystems; keep Unicode letters. */
export function sanitizeTxtFilename(title: string): string {
  const cleaned = title
    // eslint-disable-next-line no-control-regex
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '_')
    .trim();
  return `${cleaned || 'course'}.txt`;
}
