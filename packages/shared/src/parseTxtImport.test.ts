import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_ANNOTATIONS, NOTE_TEXT_MAX } from './course.js';
import { parseAnnotatedTxt } from './parseTxtImport.js';

function expectOk(raw: string, mode: 'SHORT' | 'ARTICLE' = 'SHORT') {
  const result = parseAnnotatedTxt(raw, mode);
  assert.equal(result.ok, true, `expected ok, got: ${!result.ok ? result.error : ''}`);
  if (!result.ok) throw new Error('unreachable');
  return result;
}

function expectError(raw: string, expected: string, mode: 'SHORT' | 'ARTICLE' = 'SHORT') {
  const result = parseAnnotatedTxt(raw, mode);
  assert.equal(result.ok, false, 'expected an error');
  if (result.ok) throw new Error('unreachable');
  assert.equal(result.error, expected);
}

describe('parseAnnotatedTxt — basic parsing', () => {
  it('parses a single marker pair with surrounding plain text', () => {
    const r = expectOk('A {quick}{fast-moving} fox');
    assert.equal(r.content, 'A quick fox');
    assert.deepEqual(r.annotations, [{ startIndex: 2, endIndex: 6, noteText: 'fast-moving' }]);
  });

  it('parses multiple pairs across lines, mixed Chinese/English (kickoff example)', () => {
    const raw =
      '{空山}{On the lonely mountain}不见人，但闻人语响。\n' +
      '{返景}{the returning sun rays}入深林，{复照青苔上}{Shining once more upon moss}';
    const r = expectOk(raw);
    assert.equal(r.content, '空山不见人，但闻人语响。\n返景入深林，复照青苔上');
    assert.deepEqual(r.annotations, [
      { startIndex: 0, endIndex: 1, noteText: 'On the lonely mountain' },
      { startIndex: 13, endIndex: 14, noteText: 'the returning sun rays' },
      { startIndex: 19, endIndex: 23, noteText: 'Shining once more upon moss' },
    ]);
    for (const a of r.annotations) {
      assert.equal(
        r.content.slice(a.startIndex, a.endIndex + 1).includes('{'),
        false,
      );
    }
  });

  it('anchors each annotation at the exact slice of content', () => {
    const r = expectOk('{空山}{note one}不见人。{青苔}{note two}之上。');
    assert.equal(r.content.slice(0, 2), '空山');
    const second = r.annotations[1]!;
    assert.equal(r.content.slice(second.startIndex, second.endIndex + 1), '青苔');
  });

  it('supports duplicate phrases with distinct startIndex', () => {
    const r = expectOk('{空山}{first}与{空山}{second}');
    assert.deepEqual(r.annotations, [
      { startIndex: 0, endIndex: 1, noteText: 'first' },
      { startIndex: 3, endIndex: 4, noteText: 'second' },
    ]);
  });

  it('parses pure text without markers into empty annotations', () => {
    const r = expectOk('Hello world');
    assert.equal(r.content, 'Hello world');
    assert.deepEqual(r.annotations, []);
  });

  it('normalizes CRLF line endings before indexing', () => {
    const r = expectOk('{空山}{note}\r\n第二行文本');
    assert.equal(r.content, '空山\n第二行文本');
    assert.deepEqual(r.annotations, [{ startIndex: 0, endIndex: 1, noteText: 'note' }]);
  });

  it('trims surrounding whitespace inside the note', () => {
    const r = expectOk('{空山}{  padded note  }不见人');
    assert.equal(r.annotations[0]!.noteText, 'padded note');
  });
});

describe('parseAnnotatedTxt — syntax errors', () => {
  it('reports an unclosed marker with its opening line number', () => {
    expectError(
      'first line is fine\n{ok}{note} more\n{broken',
      "Line 3: Unclosed marker '{'",
    );
  });

  it('reports an orphan phrase followed by plain text', () => {
    expectError(
      '{空山}后面没有note',
      "Line 1: '{空山}' is missing its note — expected '{phrase}{note}'",
    );
  });

  it('reports an orphan phrase at end of input', () => {
    expectError(
      '前面的文本{空山}',
      "Line 1: '{空山}' is missing its note — expected '{phrase}{note}'",
    );
  });

  it('rejects a space between phrase and note (pairs must be adjacent)', () => {
    expectError(
      '{空山} {note}',
      "Line 1: '{空山}' is missing its note — expected '{phrase}{note}'",
    );
  });

  it('reports nested braces', () => {
    expectError('{空{山}}{note}', "Line 1: Nested '{' not supported");
  });

  it('reports a stray closing brace in plain text', () => {
    expectError('空山}不见人', "Line 1: Unexpected '}'");
  });

  it('rejects an empty phrase', () => {
    expectError('文本{}{note}', "Line 1: Empty phrase '{}' not allowed");
  });

  it('rejects an empty note', () => {
    expectError('{空山}{}', "Line 1: Empty note '{}' not allowed");
  });

  it('rejects a whitespace-only note', () => {
    expectError('{空山}{   }', "Line 1: Empty note '{}' not allowed");
  });

  it('rejects a phrase with leading or trailing whitespace', () => {
    expectError(
      '{ 空山}{note}',
      'Line 1: Phrase cannot start or end with a whitespace character',
    );
  });

  it('reports the correct line for errors in multi-line files', () => {
    expectError(
      'line one\nline two\nline three\n{空山}没有note跟随',
      "Line 4: '{空山}' is missing its note — expected '{phrase}{note}'",
    );
  });
});

describe('parseAnnotatedTxt — business-rule prechecks (shared constants)', () => {
  it('rejects a note longer than NOTE_TEXT_MAX', () => {
    const longNote = 'a'.repeat(NOTE_TEXT_MAX + 1);
    expectError(`{空山}{${longNote}}`, `Line 1: Note exceeds ${NOTE_TEXT_MAX} characters`);
  });

  it('rejects more than MAX_ANNOTATIONS pairs', () => {
    const raw = '{a}{n}'.repeat(MAX_ANNOTATIONS + 1);
    expectError(raw, `Line 1: Too many annotations — maximum is ${MAX_ANNOTATIONS}`);
  });

  it('rejects tab characters with a line number', () => {
    expectError(
      '第一行没问题\nab\tc 第二行有tab',
      'Line 2: Text cannot contain tab characters. Please remove them and try again.',
    );
  });

  it('rejects content longer than the SHORT mode range', () => {
    expectError(
      'x'.repeat(501),
      'Content is 501 characters — SHORT mode requires 5–500 characters',
    );
  });

  it('rejects content shorter than the ARTICLE mode range', () => {
    expectError(
      '{空山}{note}',
      'Content is 2 characters — ARTICLE mode requires 200–5000 characters',
      'ARTICLE',
    );
  });

  it('accepts content at the SHORT minimum boundary', () => {
    const r = expectOk('{abcde}{note}');
    assert.equal(r.content, 'abcde');
  });
});
