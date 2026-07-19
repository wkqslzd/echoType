import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeCourseWhitespace, prepareCourseContent } from './course.js';
import { parseAnnotatedTxt } from './parseTxtImport.js';

describe('normalizeCourseWhitespace — interior blank lines', () => {
  it('keeps one blank line (2 \\n) between paragraphs', () => {
    assert.equal(normalizeCourseWhitespace('段落A\n\n段落B'), '段落A\n\n段落B');
  });

  it('keeps two blank lines (3 \\n) between paragraphs', () => {
    assert.equal(normalizeCourseWhitespace('段落A\n\n\n段落B'), '段落A\n\n\n段落B');
  });

  it('compresses three blank lines (4 \\n) down to two (3 \\n)', () => {
    assert.equal(normalizeCourseWhitespace('段落A\n\n\n\n段落B'), '段落A\n\n\n段落B');
  });

  it('compresses very long blank runs down to two blank lines', () => {
    assert.equal(normalizeCourseWhitespace(`段落A${'\n'.repeat(10)}段落B`), '段落A\n\n\n段落B');
  });
});

describe('normalizeCourseWhitespace — whitespace-only lines', () => {
  it('treats a spaces-only line as a blank line', () => {
    assert.equal(normalizeCourseWhitespace('段落A\n   \n段落B'), '段落A\n\n段落B');
  });

  it('blanks spaces-only lines before compressing runs', () => {
    // 3 whitespace-only lines -> 4 consecutive \n -> compressed to 3 \n.
    assert.equal(normalizeCourseWhitespace('段落A\n \n \n \n段落B'), '段落A\n\n\n段落B');
  });

  it('keeps trailing spaces on non-empty lines untouched', () => {
    assert.equal(normalizeCourseWhitespace('段落A  \n段落B'), '段落A  \n段落B');
  });
});

describe('normalizeCourseWhitespace — leading/trailing trim', () => {
  it('trims leading and trailing blank lines', () => {
    assert.equal(normalizeCourseWhitespace('\n\n段落A\n\n段落B\n\n\n'), '段落A\n\n段落B');
  });

  it('trims leading and trailing spaces', () => {
    assert.equal(normalizeCourseWhitespace('  段落A\n段落B  '), '段落A\n段落B');
  });

  it('trims whitespace-only lines at the edges entirely', () => {
    assert.equal(normalizeCourseWhitespace('  \n段落A\n  '), '段落A');
  });
});

describe('normalizeCourseWhitespace — general properties', () => {
  it('normalizes CRLF/CR to LF first', () => {
    assert.equal(normalizeCourseWhitespace('段落A\r\n\r\n段落B\r第三行'), '段落A\n\n段落B\n第三行');
  });

  it('is idempotent', () => {
    const messy = '  \n段落A\n \n \n \n \n段落B\r\n\r\n段落C\n\n ';
    const once = normalizeCourseWhitespace(messy);
    assert.equal(normalizeCourseWhitespace(once), once);
  });

  it('returns empty string for whitespace-only input', () => {
    assert.equal(normalizeCourseWhitespace(' \n \n '), '');
  });
});

describe('prepareCourseContent — applies whitespace normalization', () => {
  it('normalizes blank-line runs and trims before validation', () => {
    const { content, issue } = prepareCourseContent('\n段落A\n\n\n\n段落B \n');
    assert.equal(content, '段落A\n\n\n段落B');
    assert.equal(issue, null);
  });

  it('still reports control characters against the normalized content', () => {
    const { issue } = prepareCourseContent('ab\tc');
    assert.notEqual(issue, null);
    assert.equal(issue!.charCode, 0x09);
  });
});

describe('parseAnnotatedTxt — whitespace normalization before indexing', () => {
  it('keeps a blank line and anchors indices on the normalized content', () => {
    const r = parseAnnotatedTxt('{空山}{note}不见人\n\n{返景}{note2}入深林', 'SHORT');
    assert.equal(r.ok, true);
    if (!r.ok) throw new Error('unreachable');
    assert.equal(r.content, '空山不见人\n\n返景入深林');
    assert.deepEqual(r.annotations, [
      { startIndex: 0, endIndex: 1, noteText: 'note' },
      { startIndex: 7, endIndex: 8, noteText: 'note2' },
    ]);
  });

  it('compresses 4+ newlines and trims edges before computing indices', () => {
    const r = parseAnnotatedTxt('\n\n空山不见人\n\n\n\n{返景}{note}入深林\n\n', 'SHORT');
    assert.equal(r.ok, true);
    if (!r.ok) throw new Error('unreachable');
    assert.equal(r.content, '空山不见人\n\n\n返景入深林');
    const a = r.annotations[0]!;
    assert.equal(r.content.slice(a.startIndex, a.endIndex + 1), '返景');
  });

  it('blanks whitespace-only lines before computing indices', () => {
    const r = parseAnnotatedTxt('空山不见人\n   \n{返景}{note}入深林', 'SHORT');
    assert.equal(r.ok, true);
    if (!r.ok) throw new Error('unreachable');
    assert.equal(r.content, '空山不见人\n\n返景入深林');
    const a = r.annotations[0]!;
    assert.equal(r.content.slice(a.startIndex, a.endIndex + 1), '返景');
  });
});
