import {
  ARTICLE_MAX,
  ARTICLE_MIN,
  MAX_ANNOTATIONS,
  NOTE_TEXT_MAX,
  SHORT_MAX,
  SHORT_MIN,
  formatContentIssueMessage,
  normalizeLineEndings,
  validateContentCharacters,
  type AnnotationInput,
  type CourseMode,
} from './course.js';

// Parser for the .txt import marker syntax: {phrase}{note}. The note pair must
// IMMEDIATELY follow its phrase pair (no characters in between). Phrases are
// written into `content` verbatim at their scan position, so duplicate phrases
// get distinct, correct indices without any indexOf-style search. Output plugs
// straight into CreateCourseInput: endIndex is inclusive, indices are UTF-16
// code units (same convention as the annotation editor's buildPayload).
//
// v1 has no escape syntax: curly braces cannot appear in plain text at all.

export type ParseTxtSuccess = {
  ok: true;
  content: string;
  annotations: AnnotationInput[];
};

export type ParseTxtFailure = {
  ok: false;
  /** Human-readable message; syntax errors include the 1-based line number. */
  error: string;
};

export type ParseTxtResult = ParseTxtSuccess | ParseTxtFailure;

function fail(error: string): ParseTxtFailure {
  return { ok: false, error };
}

function missingNoteError(phrase: { text: string; line: number }): ParseTxtFailure {
  return fail(
    `Line ${phrase.line}: '{${phrase.text}}' is missing its note — expected '{phrase}{note}'`,
  );
}

export function parseAnnotatedTxt(raw: string, mode: CourseMode): ParseTxtResult {
  const text = normalizeLineEndings(raw);
  const annotations: AnnotationInput[] = [];
  let content = '';
  let line = 1;
  // Phrase token waiting for its note token; anything other than an immediate
  // second '{' orphans it.
  let pendingPhrase: { text: string; startIndex: number; line: number } | null = null;
  let i = 0;

  while (i < text.length) {
    const ch = text[i]!;

    if (ch !== '{') {
      if (pendingPhrase) return missingNoteError(pendingPhrase);
      if (ch === '}') return fail(`Line ${line}: Unexpected '}'`);
      if (ch === '\n') line++;
      content += ch;
      i++;
      continue;
    }

    // Scan one {token}.
    const openLine = line;
    i++; // consume '{'
    let token = '';
    let closed = false;
    while (i < text.length) {
      const c = text[i]!;
      if (c === '{') return fail(`Line ${line}: Nested '{' not supported`);
      if (c === '}') {
        closed = true;
        i++;
        break;
      }
      if (c === '\n') line++;
      token += c;
      i++;
    }
    if (!closed) return fail(`Line ${openLine}: Unclosed marker '{'`);

    if (pendingPhrase === null) {
      // Odd token: phrase — goes into content at the current position.
      if (token.length === 0) return fail(`Line ${openLine}: Empty phrase '{}' not allowed`);
      if (/^\s|\s$/.test(token)) {
        // Would violate the server's whitespace-anchor rule at save time.
        return fail(
          `Line ${openLine}: Phrase cannot start or end with a whitespace character`,
        );
      }
      pendingPhrase = { text: token, startIndex: content.length, line: openLine };
      content += token;
    } else {
      // Even token: note for the pending phrase.
      const note = token.trim();
      if (note.length === 0) return fail(`Line ${openLine}: Empty note '{}' not allowed`);
      if (note.length > NOTE_TEXT_MAX) {
        return fail(`Line ${openLine}: Note exceeds ${NOTE_TEXT_MAX} characters`);
      }
      if (annotations.length >= MAX_ANNOTATIONS) {
        return fail(`Line ${openLine}: Too many annotations — maximum is ${MAX_ANNOTATIONS}`);
      }
      annotations.push({
        startIndex: pendingPhrase.startIndex,
        endIndex: pendingPhrase.startIndex + pendingPhrase.text.length - 1,
        noteText: note,
      });
      pendingPhrase = null;
    }
  }

  if (pendingPhrase) return missingNoteError(pendingPhrase);

  const contentIssue = validateContentCharacters(content);
  if (contentIssue) {
    const issueLine = 1 + (content.slice(0, contentIssue.index).match(/\n/g)?.length ?? 0);
    return fail(`Line ${issueLine}: ${formatContentIssueMessage(contentIssue)}`);
  }

  const len = content.length;
  const [min, max] = mode === 'SHORT' ? [SHORT_MIN, SHORT_MAX] : [ARTICLE_MIN, ARTICLE_MAX];
  if (len < min || len > max) {
    return fail(`Content is ${len} characters — ${mode} mode requires ${min}–${max} characters`);
  }

  return { ok: true, content, annotations };
}
