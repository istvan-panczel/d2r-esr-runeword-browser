/** Parser of the act grid token format (see `ActGrid` in ../data/types.ts). Pure; never throws. */

export type GridCellKind = 'station' | 'stack' | 'ghost';

export interface GridCell {
  readonly col: number;
  readonly row: number;
  readonly kind: GridCellKind;
  /** Area ids, top to bottom */
  readonly ids: readonly number[];
}

export interface ParsedGrid {
  readonly cells: readonly GridCell[];
  readonly rows: number;
  readonly cols: number;
  /** Unknown or malformed tokens */
  readonly problems: readonly string[];
}

/** One token, or a problem message */
export function parseToken(token: string): { kind: GridCellKind; ids: number[] } | string {
  if (/^\d+$/.test(token)) return { kind: 'station', ids: [Number(token)] };
  if (/^@\d+$/.test(token)) return { kind: 'ghost', ids: [Number(token.slice(1))] };
  const range = /^(\d+)\.\.(\d+)$/.exec(token);
  if (range !== null) {
    const first = Number(range[1]);
    const last = Number(range[2]);
    if (last <= first) return `bad stack range "${token}"`;
    return { kind: 'stack', ids: Array.from({ length: last - first + 1 }, (_, i) => first + i) };
  }
  if (/^\d+(\+\d+)+$/.test(token)) return { kind: 'stack', ids: token.split('+').map(Number) };
  return `unknown grid token "${token}"`;
}

export function parseGrid(grid: string): ParsedGrid {
  const cells: GridCell[] = [];
  const problems: string[] = [];
  const lines = grid
    .split('\n')
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter((line) => line !== '');
  let cols = 0;
  lines.forEach((line, row) => {
    const tokens = line.split(/\s+/);
    cols = Math.max(cols, tokens.length);
    tokens.forEach((token, col) => {
      if (token === '.') return;
      const parsed = parseToken(token);
      if (typeof parsed === 'string') problems.push(`row ${String(row)}, column ${String(col)}: ${parsed}`);
      else cells.push({ col, row, ...parsed });
    });
  });
  return { cells, rows: lines.length, cols, problems };
}
