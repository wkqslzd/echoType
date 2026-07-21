import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAnnotatedTxt } from './parseTxtImport.js';
import {
  sanitizeTxtFilename,
  serializeAnnotatedTxt,
  TXT_EXPORT_NOTES_BANNER,
  TXT_EXPORT_NOTES_FOOTER,
  type SerializeTxtInput,
} from './serializeTxtExport.js';

function makeInput(overrides: Partial<SerializeTxtInput>): SerializeTxtInput {
  return {
    title: 'Test course',
    description: null,
    content: '',
    annotations: [],
    ...overrides,
  };
}

/** Strip fixed header and export-notes footer, returning the body only. */
function bodyOf(exported: string): string {
  const lines = exported.split('\n');
  assert.match(lines[0]!, /^title: /);
  assert.match(lines[1]!, /^description: /);
  assert.equal(lines[2], '');

  const bannerIdx = lines.indexOf(TXT_EXPORT_NOTES_BANNER);
  assert.ok(bannerIdx >= 0, 'expected export-notes banner');
  // Two blank lines immediately before the banner.
  assert.equal(lines[bannerIdx - 1], '');
  assert.equal(lines[bannerIdx - 2], '');

  return lines.slice(3, bannerIdx - 2).join('\n');
}

describe('serializeAnnotatedTxt — header', () => {
  it('always emits exactly two header lines plus a blank separator before the body', () => {
    const out = serializeAnnotatedTxt(
      makeInput({ title: 'Deer Park', description: 'Wang Wei', content: '空山不见人' }),
    );
    assert.match(out, /^title: Deer Park\ndescription: Wang Wei\n\n空山不见人\n/);
  });

  it('emits an empty description line when the course has none', () => {
    const out = serializeAnnotatedTxt(makeInput({ title: 'Deer Park', content: '空山不见人' }));
    assert.match(out, /^title: Deer Park\ndescription: \n\n空山不见人\n/);
  });

  it('collapses newlines inside the description to keep the header fixed', () => {
    const out = serializeAnnotatedTxt(
      makeInput({ description: 'line one\nline two\n\nline three', content: 'abcde' }),
    );
    assert.equal(bodyOf(out), 'abcde');
    assert.match(out, /^title: Test course\ndescription: line one line two line three\n\n/);
  });
});

describe('serializeAnnotatedTxt — footer', () => {
  it('always appends the export-notes footer after two blank lines', () => {
    const out = serializeAnnotatedTxt(makeInput({ content: 'Hello world here' }));
    assert.ok(out.endsWith(TXT_EXPORT_NOTES_FOOTER));
    assert.ok(out.includes(`\n\n\n${TXT_EXPORT_NOTES_BANNER}\n`));
  });

  it('includes the footer even when the course has annotations', () => {
    const out = serializeAnnotatedTxt(
      makeInput({
        content: 'abcdef',
        annotations: [{ startIndex: 0, endIndex: 1, noteText: 'first' }],
      }),
    );
    assert.ok(out.includes(TXT_EXPORT_NOTES_BANNER));
    assert.ok(out.includes('{phrase}{annotation}'));
    assert.ok(out.includes('{bourn}{boundary; limit}'));
  });
});

describe('serializeAnnotatedTxt — body', () => {
  it('serializes plain content without annotations verbatim', () => {
    const out = serializeAnnotatedTxt(makeInput({ content: 'Hello world\nsecond line' }));
    assert.equal(bodyOf(out), 'Hello world\nsecond line');
  });

  it('wraps annotated slices as adjacent {phrase}{annotation} pairs', () => {
    const out = serializeAnnotatedTxt(
      makeInput({
        content: '空山不见人，但闻人语响。',
        annotations: [{ startIndex: 0, endIndex: 1, noteText: 'On the lonely mountain' }],
      }),
    );
    assert.equal(bodyOf(out), '{空山}{On the lonely mountain}不见人，但闻人语响。');
  });

  it('serializes multiple and adjacent annotations in index order regardless of array order', () => {
    const out = serializeAnnotatedTxt(
      makeInput({
        content: 'abcdef',
        annotations: [
          { startIndex: 2, endIndex: 3, noteText: 'second' },
          { startIndex: 0, endIndex: 1, noteText: 'first' },
        ],
      }),
    );
    assert.equal(bodyOf(out), '{ab}{first}{cd}{second}ef');
  });

  it('handles annotations at the first and last character', () => {
    const out = serializeAnnotatedTxt(
      makeInput({
        content: 'abc',
        annotations: [
          { startIndex: 0, endIndex: 0, noteText: 'start' },
          { startIndex: 2, endIndex: 2, noteText: 'end' },
        ],
      }),
    );
    assert.equal(bodyOf(out), '{a}{start}b{c}{end}');
  });
});

describe('serializeAnnotatedTxt — round-trip with parseAnnotatedTxt', () => {
  const cases: Array<{ name: string; content: string; annotations: SerializeTxtInput['annotations'] }> = [
    { name: 'plain text', content: 'Hello world here', annotations: [] },
    {
      name: 'kickoff example',
      content: '空山不见人，但闻人语响。\n返景入深林，复照青苔上',
      annotations: [
        { startIndex: 0, endIndex: 1, noteText: 'On the lonely mountain' },
        { startIndex: 13, endIndex: 14, noteText: 'the returning sun rays' },
        { startIndex: 19, endIndex: 23, noteText: 'Shining once more upon moss' },
      ],
    },
    {
      name: 'duplicate phrases',
      content: '空山与空山',
      annotations: [
        { startIndex: 0, endIndex: 1, noteText: 'first' },
        { startIndex: 3, endIndex: 4, noteText: 'second' },
      ],
    },
    {
      name: 'multi-line English with rare-word gloss',
      content: 'from whose bourn\nno traveller returns',
      annotations: [{ startIndex: 11, endIndex: 15, noteText: 'boundary; limit' }],
    },
  ];

  for (const c of cases) {
    it(`round-trips ${c.name}`, () => {
      const exported = serializeAnnotatedTxt(
        makeInput({ content: c.content, annotations: c.annotations }),
      );
      const parsed = parseAnnotatedTxt(bodyOf(exported), 'SHORT');
      assert.equal(parsed.ok, true, !parsed.ok ? parsed.error : '');
      if (!parsed.ok) throw new Error('unreachable');
      assert.equal(parsed.content, c.content);
      assert.deepEqual(parsed.annotations, c.annotations);
    });
  }
});

describe('sanitizeTxtFilename', () => {
  it('appends .txt and keeps Unicode titles', () => {
    assert.equal(sanitizeTxtFilename('鹿柴 - 王维'), '鹿柴 - 王维.txt');
  });

  it('replaces filesystem-illegal characters', () => {
    assert.equal(sanitizeTxtFilename('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j.txt');
  });

  it('falls back when the title cleans to empty', () => {
    assert.equal(sanitizeTxtFilename('***'), '___.txt');
    assert.equal(sanitizeTxtFilename('   '), 'course.txt');
  });
});
