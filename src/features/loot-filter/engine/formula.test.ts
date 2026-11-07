import { describe, expect, it } from 'vitest';
import {
  evaluateFormula,
  formulaReferences,
  parseFormula,
  type FormulaContext,
  type FormulaNode,
  type FormulaParamKind,
  type FormulaStatEntry,
} from './formula';

/** The guide's example (ESR loot filter guide excerpt, 2026-10-31). */
const GUIDE_EXAMPLE = "((stat('item_fastercastrate')>=10)&&((stat('fireresist')+stat('coldresist')+stat('lightresist'))>=40))";

const STAT_IDS = new Map([
  ['strength', 0],
  ['fireresist', 39],
  ['lightresist', 41],
  ['coldresist', 43],
  ['item_fastercastrate', 105],
  ['item_nonclassskill', 97],
  ['item_skillonhit', 201],
  ['item_addskill_tab', 188],
  ['level', 12],
]);

const PARAM_KINDS: ReadonlyMap<number, FormulaParamKind> = new Map([
  [97, 'skill'],
  [201, 'skillLevel'],
]);

function context(itemStats: readonly FormulaStatEntry[] = [], playerStats: readonly FormulaStatEntry[] = []): FormulaContext {
  return {
    itemStats,
    playerStats,
    statIds: STAT_IDS,
    skillIds: new Map([
      ['teleport', 54],
      ['fire bolt', 36],
    ]),
    paramKind: (stat) => PARAM_KINDS.get(stat) ?? 'other',
  };
}

function ast(text: string): FormulaNode {
  const result = parseFormula(text);
  if (!result.ok) throw new Error(`${result.error.message} at ${String(result.error.offset)}`);
  return result.ast;
}

const value = (text: string, ctx: FormulaContext = context()): number => evaluateFormula(ast(text), ctx);

/** The tree in prefix notation, to see how it grouped. */
function show(node: FormulaNode): string {
  switch (node.kind) {
    case 'number':
      return String(node.value);
    case 'call':
      return `${node.fn}(${node.stat.kind === 'id' ? String(node.stat.id) : node.stat.name})`;
    case 'unary':
      return `(${node.op} ${show(node.operand)})`;
    case 'binary':
      return `(${node.op} ${show(node.left)} ${show(node.right)})`;
    case 'ternary':
      return `(? ${show(node.test)} ${show(node.then)} ${show(node.otherwise)})`;
  }
}

describe('parseFormula: precedence and associativity (C order, assumed)', () => {
  it.each([
    ['1 + 2 * 3', '(+ 1 (* 2 3))'],
    ['(1 + 2) * 3', '(* (+ 1 2) 3)'],
    ['10 - 4 - 3', '(- (- 10 4) 3)'],
    ['100 / 10 / 5', '(/ (/ 100 10) 5)'],
    ['1 + 2 < 4', '(< (+ 1 2) 4)'],
    ['1 < 2 == 3 > 4', '(== (< 1 2) (> 3 4))'],
    ['1 == 2 && 3 != 4', '(&& (== 1 2) (!= 3 4))'],
    ['1 || 0 && 0', '(|| 1 (&& 0 0))'],
    ['!1 == 0', '(== (! 1) 0)'],
    ['-2 * 3', '(* (- 2) 3)'],
    ['--2', '(- (- 2))'],
    ['1 ? 2 : 3 ? 4 : 5', '(? 1 2 (? 3 4 5))'],
    ['1 ? 2 ? 3 : 4 : 5', '(? 1 (? 2 3 4) 5)'],
    ['0 || 1 ? 2 : 3', '(? (|| 0 1) 2 3)'],
  ])('%s → %s', (text, tree) => {
    expect(show(ast(text))).toBe(tree);
  });

  it('keeps source positions, the group spans its parentheses', () => {
    const node = ast(" (1+ stat('strength'))");
    expect(node).toMatchObject({ kind: 'binary', start: 1, end: 22 });
    const [call] = formulaReferences(node);
    expect(call).toMatchObject({
      fn: 'stat',
      nameStart: 5,
      start: 5,
      end: 21,
      stat: { kind: 'name', name: 'strength', start: 10, end: 20 },
    });
    // A call in parentheses spans them, but keeps the offset of its name
    expect(formulaReferences(ast("1 + ((stat('strength')))"))).toEqual([expect.objectContaining({ nameStart: 6, start: 4, end: 24 })]);
  });
});

describe('parseFormula: calls', () => {
  it('reads stat names, row numbers, number params and skill names', () => {
    const refs = formulaReferences(
      ast("stat('strength') + stat(39) + stat('41') + playerStat('level', 0) + stat('item_nonclassskill', 'Teleport') + statMax('x')")
    );
    expect(refs.map((ref) => [ref.fn, ref.stat, ref.param])).toEqual([
      ['stat', expect.objectContaining({ kind: 'name', name: 'strength', doubleQuoted: false }), undefined],
      ['stat', expect.objectContaining({ kind: 'id', id: 39, quoted: false }), undefined],
      ['stat', expect.objectContaining({ kind: 'id', id: 41, quoted: true }), undefined],
      ['playerStat', expect.objectContaining({ kind: 'name', name: 'level' }), expect.objectContaining({ kind: 'number', value: 0 })],
      ['stat', expect.objectContaining({ name: 'item_nonclassskill' }), expect.objectContaining({ kind: 'skill', name: 'Teleport' })],
      ['statMax', expect.objectContaining({ name: 'x' }), undefined],
    ]);
  });

  it('marks double-quoted names', () => {
    const [ref] = formulaReferences(ast('stat("strength", "Fire Bolt")'));
    expect(ref.stat).toMatchObject({ kind: 'name', doubleQuoted: true });
    expect(ref.param).toMatchObject({ kind: 'skill', name: 'Fire Bolt', doubleQuoted: true });
  });

  it('parses the guide example', () => {
    const refs = formulaReferences(ast(GUIDE_EXAMPLE));
    expect(refs.map((ref) => (ref.stat.kind === 'name' ? ref.stat.name : ref.stat.id))).toEqual([
      'item_fastercastrate',
      'fireresist',
      'coldresist',
      'lightresist',
    ]);
  });
});

describe('parseFormula: errors with offsets', () => {
  it.each([
    ['', 'The formula is empty', 0],
    ['   ', 'The formula is empty', 0],
    ['1 +', 'The formula ends too early: a value is missing', 3],
    ['(1 + 2', "Expected ')', found the end of the formula", 6],
    ['1 + 2)', "Expected an operator or the end of the formula, found a ')' without its '('", 5],
    ['1 = 2', "'=' is not an operator; compare with '=='", 2],
    ['1 & 2', "'&' is not an operator; 'and' is '&&'", 2],
    ['1.5', 'Numbers are whole numbers (no decimals)', 1],
    ['1 $ 2', "Unexpected character '$'", 2],
    ["stat('fireresist)", "The name starting here has no closing '", 5],
    ["Stat('fireresist')", "Unknown function 'Stat'; function names are case-sensitive: 'stat'", 0],
    ["max('a')", "Unknown function 'max' (stat, playerStat, statMax, statSum)", 0],
    ['stat', "Expected '(' after stat, found the end of the formula", 4],
    ['stat()', "stat needs a stat: a name in quotes or a row number, found ')'", 5],
    ["stat('')", 'The stat name is empty', 5],
    ["statMax('a', 1)", 'statMax takes the stat only (it reads every param)', 11],
    ["stat('a', 1, 2)", 'stat takes at most two arguments: the stat and a param', 11],
    ["stat('a', 1 + 1)", "Expected ')' to close stat(, found '+'", 12],
    ["stat('a', x)", "The param of stat is a number or a skill name in quotes, found 'x'", 10],
    ["'fireresist' > 1", "A quoted name goes inside stat(…), e.g. stat('fireresist')", 0],
    ['1 ? 2', "Expected ':' of 'a ? b : c', found the end of the formula", 5],
    ['+1', "A '+' in front of a value is not supported; leave it out", 0],
    ['2x', "Unexpected 'x' after a number", 1],
    ['1 + 2147483648', 'The number 2147483648 is above 2147483647 (values are 32-bit)', 4],
    [`1${'0'.repeat(400)}`, 'The number 10000000000000000000… is above 2147483647 (values are 32-bit)', 0],
  ])('%j', (text, message, offset) => {
    expect(parseFormula(text)).toEqual({ ok: false, error: { message, offset } });
  });
});

describe('evaluateFormula', () => {
  it('does whole-number arithmetic: division truncates toward 0, division by 0 gives 0', () => {
    expect(value('7 / 2')).toBe(3);
    expect(value('-7 / 2')).toBe(-3);
    expect(value('7 / -2')).toBe(-3);
    expect(value('7 / 0')).toBe(0);
    expect(value('1 + 2 * 3 - 4')).toBe(3);
    expect(value('(1 + 2) * 3')).toBe(9);
  });

  it('gives 1 or 0 for comparisons and logic', () => {
    expect(value('3 >= 3')).toBe(1);
    expect(value('3 > 3')).toBe(0);
    expect(value('2 == 2')).toBe(1);
    expect(value('2 != 2')).toBe(0);
    expect(value('5 && 7')).toBe(1);
    expect(value('5 && 0')).toBe(0);
    expect(value('0 || 0')).toBe(0);
    expect(value('0 || -3')).toBe(1);
    expect(value('!5')).toBe(0);
    expect(value('!0')).toBe(1);
  });

  it('picks a ternary branch', () => {
    expect(value('1 ? 10 : 20')).toBe(10);
    expect(value('0 ? 10 : 20')).toBe(20);
    expect(value('0 ? 1 : 0 ? 2 : 3')).toBe(3);
  });

  it('wraps like a signed 32-bit int', () => {
    expect(value('2147483647 + 1')).toBe(-2147483648);
    expect(value('65536 * 65536')).toBe(0);
    expect(value('(-2147483647 - 1) / -1')).toBe(-2147483648);
  });

  it('reads item and player stats; a missing stat or unknown name is 0', () => {
    const ctx = context(
      [
        { stat: 39, value: 30 },
        { stat: 43, param: 0, value: 25 },
      ],
      [{ stat: 12, value: 85 }]
    );
    expect(value("stat('fireresist')", ctx)).toBe(30);
    expect(value('stat(43)', ctx)).toBe(25);
    expect(value("stat('lightresist')", ctx)).toBe(0);
    expect(value("stat('nope')", ctx)).toBe(0);
    // Names are taken as written
    expect(value("stat(' fireresist')", ctx)).toBe(0);
    expect(value("stat(' 43 ')", ctx)).toBe(0);
    expect(value("playerStat('level')", ctx)).toBe(85);
    expect(value("stat('level')", ctx)).toBe(0);
  });

  it('reads param 0 without a param, one param with it, every param with statMax / statSum', () => {
    const ctx = context([
      { stat: 188, param: 0, value: 1 },
      { stat: 188, param: 50, value: 3 },
      { stat: 188, param: 10, value: 2 },
    ]);
    expect(value("stat('item_addskill_tab')", ctx)).toBe(1);
    expect(value("stat('item_addskill_tab', 50)", ctx)).toBe(3);
    expect(value("stat('item_addskill_tab', '10')", ctx)).toBe(2);
    expect(value("stat('item_addskill_tab', 9)", ctx)).toBe(0);
    expect(value("statMax('item_addskill_tab')", ctx)).toBe(3);
    expect(value("statSum('item_addskill_tab')", ctx)).toBe(6);
    expect(value("statMax('fireresist')", ctx)).toBe(0);
    expect(value("statSum('fireresist')", ctx)).toBe(0);
  });

  it('resolves skill names (any case): the skill id on skill stats, any level on skill-event stats', () => {
    const ctx = context([
      { stat: 97, param: 54, value: 12 },
      { stat: 201, param: (36 << 6) | 5, value: 10 },
      { stat: 201, param: (36 << 6) | 9, value: 4 },
      { stat: 201, param: (54 << 6) | 1, value: 50 },
    ]);
    expect(value("stat('item_nonclassskill', 'Teleport') > 10", ctx)).toBe(1);
    expect(value("stat('item_nonclassskill', 'TELEPORT')", ctx)).toBe(12);
    expect(value("stat('item_nonclassskill', 'Fire Bolt')", ctx)).toBe(0);
    expect(value("stat('item_skillonhit', 'Fire Bolt')", ctx)).toBe(10);
    expect(value(`stat('item_skillonhit', ${String((36 << 6) | 9)})`, ctx)).toBe(4);
    expect(value("stat('item_skillonhit', 'Nope')", ctx)).toBe(0);
  });

  it('evaluates the guide example', () => {
    const ring = (fcr: number, fire: number, cold: number, light: number) =>
      context([
        { stat: 105, value: fcr },
        { stat: 39, value: fire },
        { stat: 43, value: cold },
        { stat: 41, value: light },
      ]);
    expect(value(GUIDE_EXAMPLE, ring(10, 15, 15, 10))).toBe(1);
    expect(value(GUIDE_EXAMPLE, ring(10, 15, 15, 9))).toBe(0);
    expect(value(GUIDE_EXAMPLE, ring(5, 30, 30, 30))).toBe(0);
  });
});

describe('parseFormula: limits (no stack overflow on huge formulas)', () => {
  it.each([
    ['deep parentheses', `${'('.repeat(200)}1${')'.repeat(200)}`, 'The formula is nested too deeply', 64],
    ['many nots', `${'!'.repeat(200)}1`, 'The formula is nested too deeply', 64],
    ['many minus signs', `${'-'.repeat(200)}1`, 'The formula is nested too deeply', 64],
    ['nested ternaries', `${'1 ? '.repeat(100)}1${' : 0'.repeat(100)}`, 'The formula is nested too deeply', 258],
    ['a long sum', Array<string>(10000).fill('1').join('+'), 'The formula is too long: more than 512 parts', 512],
  ])('%s', (_name, text, message, offset) => {
    const result = parseFormula(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message.startsWith(message)).toBe(true);
    expect(result.error.offset).toBe(offset);
  });

  it('rejects the review’s inputs without throwing', () => {
    for (const text of [`${'('.repeat(3000)}1${')'.repeat(3000)}`, `${'!'.repeat(10000)}1`, Array<string>(10000).fill('1').join('+')]) {
      expect(parseFormula(text).ok).toBe(false);
    }
  });

  it('parses up to the limits and evaluates them', () => {
    expect(value(`${'('.repeat(64)}1${')'.repeat(64)}`)).toBe(1);
    expect(value(Array<string>(256).fill('1').join('+'))).toBe(256);
    expect(value(`${Array<string>(256).fill('1').join('+')}  \n  `)).toBe(256);
  });
});
