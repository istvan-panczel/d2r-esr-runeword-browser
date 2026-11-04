import { describe, expect, it } from 'vitest';
import { parseGrid, parseToken } from './grid';

describe('parseToken', () => {
  it('reads stations, ghosts, ranges and explicit stacks', () => {
    expect(parseToken('12')).toEqual({ kind: 'station', ids: [12] });
    expect(parseToken('@40')).toEqual({ kind: 'ghost', ids: [40] });
    expect(parseToken('21..25')).toEqual({ kind: 'stack', ids: [21, 22, 23, 24, 25] });
    expect(parseToken('34+35+37')).toEqual({ kind: 'stack', ids: [34, 35, 37] });
  });

  it('returns a problem for malformed tokens', () => {
    expect(parseToken('5..5')).toMatch(/bad stack range/);
    expect(parseToken('x1')).toMatch(/unknown grid token/);
  });
});

describe('parseGrid', () => {
  it('places tokens by row and column, skipping dots, comments and blank lines', () => {
    const parsed = parseGrid(`
      1   .   3+4   # a comment
      .   @9
    `);
    expect(parsed.rows).toBe(2);
    expect(parsed.cols).toBe(3);
    expect(parsed.cells).toEqual([
      { col: 0, row: 0, kind: 'station', ids: [1] },
      { col: 2, row: 0, kind: 'stack', ids: [3, 4] },
      { col: 1, row: 1, kind: 'ghost', ids: [9] },
    ]);
    expect(parsed.problems).toEqual([]);
  });

  it('reports bad tokens with their position and keeps the rest', () => {
    const parsed = parseGrid('1 what 2');
    expect(parsed.cells.map((cell) => cell.ids[0])).toEqual([1, 2]);
    expect(parsed.problems).toEqual(['row 0, column 1: unknown grid token "what"']);
  });
});
