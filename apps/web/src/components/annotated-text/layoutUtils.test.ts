import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLineData, type LayoutAnnotation, type VisualLine } from './layoutUtils.js';

// charWidth fallback path (no charEdges): band width = charCount * 10.
const CHAR_WIDTH = 10;

const ann = (id: string, startIndex: number, endIndex: number): LayoutAnnotation => ({
  id,
  startIndex,
  endIndex,
  noteText: `note ${id}`,
});

function bandsOf(data: ReturnType<typeof buildLineData>, lineIdx: number) {
  return data[lineIdx]!.bands.map((b) => ({ id: b.id, left: b.left, width: b.width }));
}

describe('buildLineData adjacent-band gap', () => {
  it('shrinks the leading band by 3px when two phrases are index-adjacent', () => {
    // "abcd" one line; [0,1] + [2,3] touch (2 === 1 + 1)
    const lines: VisualLine[] = [[0, 3]];
    const data = buildLineData(lines, [ann('a', 0, 1), ann('b', 2, 3)], CHAR_WIDTH, 16);
    assert.deepEqual(bandsOf(data, 0), [
      { id: 'a', left: 0, width: 17 },
      { id: 'b', left: 20, width: 20 },
    ]);
  });

  it('keeps widths when any character separates the phrases', () => {
    // "ab cd": [0,1] + [3,4], index 2 (space) in between
    const lines: VisualLine[] = [[0, 4]];
    const data = buildLineData(lines, [ann('a', 0, 1), ann('b', 3, 4)], CHAR_WIDTH, 16);
    assert.deepEqual(bandsOf(data, 0), [
      { id: 'a', left: 0, width: 20 },
      { id: 'b', left: 30, width: 20 },
    ]);
  });

  it('three consecutive phrases: first two shrink, last does not', () => {
    // "abcdef": [0,1] + [2,3] + [4,5]
    const lines: VisualLine[] = [[0, 5]];
    const data = buildLineData(
      lines,
      [ann('a', 0, 1), ann('b', 2, 3), ann('c', 4, 5)],
      CHAR_WIDTH,
      16,
    );
    assert.deepEqual(bandsOf(data, 0), [
      { id: 'a', left: 0, width: 17 },
      { id: 'b', left: 20, width: 17 },
      { id: 'c', left: 40, width: 20 },
    ]);
  });

  it('does not shrink a phrase with no adjacent successor', () => {
    const lines: VisualLine[] = [[0, 3]];
    const data = buildLineData(lines, [ann('a', 0, 1)], CHAR_WIDTH, 16);
    assert.deepEqual(bandsOf(data, 0), [{ id: 'a', left: 0, width: 20 }]);
  });

  it('does not shrink when the adjacent phrase starts on the next visual line', () => {
    // Two lines [0,3] / [4,7]; a = [2,3] ends at line 0's last char,
    // b = [4,5] starts line 1. Index-adjacent but never fuse visually.
    const lines: VisualLine[] = [
      [0, 3],
      [4, 7],
    ];
    const data = buildLineData(lines, [ann('a', 2, 3), ann('b', 4, 5)], CHAR_WIDTH, 16);
    assert.deepEqual(bandsOf(data, 0), [{ id: 'a', left: 20, width: 20 }]);
    assert.deepEqual(bandsOf(data, 1), [{ id: 'b', left: 0, width: 20 }]);
  });

  it('shrinks only the tail fragment of a phrase spanning two lines', () => {
    // a = [2,5] spans line 0 ([0,3]) and line 1 ([4,7]); b = [6,7] adjacent.
    const lines: VisualLine[] = [
      [0, 3],
      [4, 7],
    ];
    const data = buildLineData(lines, [ann('a', 2, 5), ann('b', 6, 7)], CHAR_WIDTH, 16);
    // Line 0 fragment (no phrase tail): full width.
    assert.deepEqual(bandsOf(data, 0), [{ id: 'a', left: 20, width: 20 }]);
    // Line 1 tail fragment shrinks; b unchanged.
    assert.deepEqual(bandsOf(data, 1), [
      { id: 'a', left: 0, width: 17 },
      { id: 'b', left: 20, width: 20 },
    ]);
  });

  it('leaves note bubble left/width untouched for adjacent phrases', () => {
    const lines: VisualLine[] = [[0, 3]];
    const data = buildLineData(lines, [ann('a', 0, 1), ann('b', 2, 3)], CHAR_WIDTH, 16);
    assert.deepEqual(
      data[0]!.notes.map((n) => ({ id: n.id, left: n.left, width: n.width })),
      [
        { id: 'a', left: 0, width: 20 },
        { id: 'b', left: 20, width: 20 },
      ],
    );
  });
});
