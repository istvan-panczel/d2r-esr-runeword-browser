/**
 * The loot filter `formula` condition (plugin 1.8.2, ESR 3.3; the guide's "Formulas"): "formula is a condition that
 * holds when its formula is not 0. It is written like a txt calc and checked when the filter loads."
 *
 * Parts (the guide): `stat('name')`, `stat('name', param)` (a number or a skills.txt skill name),
 * `playerStat('name')`, `playerStat('name', param)`, `statMax('name')`, `statSum('name')`, `+ - * /` on whole numbers
 * (division rounds toward 0, division by 0 gives 0), `== != < <= > >=` (1 or 0), `&& || !`, `a ? b : c`. Skill names on
 * chance-to-cast and charge stats match the skill at any level. A bad name or bad syntax switches the rule off.
 *
 * What the guide leaves open is decided in {@link FORMULA_ASSUMPTIONS} (the one list; the docs and the Test tab show
 * it) and the constants next to it.
 */

// ---------------------------------------------------------------------------
// Assumptions (the one place)
// ---------------------------------------------------------------------------

/** The functions, spelled as the guide writes them (taken to be case-sensitive: not verified). */
export const FORMULA_FUNCTIONS = ['stat', 'playerStat', 'statMax', 'statSum'] as const;
export type FormulaFunction = (typeof FORMULA_FUNCTIONS)[number];

/** How many arguments each function takes at most: the stat, and for `stat` / `playerStat` an optional param. */
const MAX_ARGUMENTS: Readonly<Record<FormulaFunction, 1 | 2>> = { stat: 2, playerStat: 2, statMax: 1, statSum: 1 };

export const BINARY_OPS = ['||', '&&', '==', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/'] as const;
export type FormulaBinaryOp = (typeof BINARY_OPS)[number];

/**
 * Binary operator precedence, C's (assumed; the guide gives none): higher binds tighter. Every binary operator is
 * left-associative; unary `!` and `-` bind tighter than all of them; `a ? b : c` is the loosest and right-associative.
 */
export const BINARY_PRECEDENCE: Readonly<Record<FormulaBinaryOp, number>> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
};

/** Values are signed 32-bit integers (assumed): every result wraps like a C `int`; a larger literal is a syntax error. */
export const FORMULA_INT_MAX = 2147483647;

/** The quote the guide writes names in; the other one (`\"` inside the JSON string) is read with a warning. */
export const FORMULA_QUOTE = "'";

/** Whether a skill name matches case-insensitively (assumed, like the game's own skills.txt name lookups). */
export const SKILL_NAMES_IGNORE_CASE: boolean = true;

/** Every guess the parser, evaluator and validator make where the guide is silent (docs/features/LOOT-FILTER.md too). */
export const FORMULA_ASSUMPTIONS: readonly string[] = [
  'Operators bind like C: unary ! and -, then * /, then + -, then < <= > >=, then == !=, then &&, then ||, then a ? b : c (right-associative); the binary operators are left-associative; parentheses group.',
  'Numbers are whole, non-negative literals (no decimals, hex or unary +); a - in front negates.',
  'Values are signed 32-bit integers: every result wraps like a C int; a literal above 2147483647 is an error (so -2147483648 is written -2147483647 - 1), and -2147483648 / -1 wraps to -2147483648.',
  'Names in single quotes, as in the guide; double quotes (\\" inside the JSON string) are read too, with a warning (the plugin log says "names go in single quotes", so it most likely rejects them). Quotes have no escapes.',
  'Function names are case-sensitive (stat, playerStat, statMax, statSum); stat names must match exactly (as in the stat lists); skill names ignore case (as the game’s own skills.txt lookups).',
  'Arguments are literals: the stat (a name in quotes or a row number), then a number or a quoted skill name; statMax and statSum take the stat only.',
  "stat('name') without a param reads the entry with param 0, as the stat lists do (verified for the lists); statMax and statSum read every param. A stat the item or character lacks is 0.",
  "A skill name is the skills.txt skill column ('Hex Bane', not the in-game 'Hex: Bane'). On the oskill, single skill and aura stats it is that skill's param; on chance-to-cast and charge stats it matches the skill at any level (the guide) and reads the highest of those entries; on any other stat it is read as the skill id.",
  'Enhanced Damage, Enhanced Defense and Increased Maximum Durability are taken to read 0 where the stat lists do (verified for the lists with plugin 1.5.3).',
];

// ---------------------------------------------------------------------------
// Syntax tree
// ---------------------------------------------------------------------------

/** Character offsets into the formula text: `start` inclusive, `end` exclusive. */
export interface FormulaSpan {
  readonly start: number;
  readonly end: number;
}

/** The stat of a call: an itemstatcost `Stat` or a row number (written as a number, or as digits in quotes). */
export type FormulaStatArg = FormulaSpan &
  (
    | { readonly kind: 'name'; readonly name: string; readonly doubleQuoted: boolean }
    | { readonly kind: 'id'; readonly id: number; readonly quoted: boolean; readonly doubleQuoted: boolean }
  );

/** The param of a call: a number (digits in quotes count as a number) or a skills.txt skill name. */
export type FormulaParamArg = FormulaSpan &
  (
    | { readonly kind: 'number'; readonly value: number; readonly quoted: boolean; readonly doubleQuoted: boolean }
    | { readonly kind: 'skill'; readonly name: string; readonly doubleQuoted: boolean }
  );

export interface FormulaCall extends FormulaSpan {
  readonly kind: 'call';
  readonly fn: FormulaFunction;
  /** Offset of the function name (`start` covers the parentheses around a call written as `(stat('x'))`). */
  readonly nameStart: number;
  readonly stat: FormulaStatArg;
  readonly param?: FormulaParamArg;
}

export type FormulaNode =
  | (FormulaSpan & { readonly kind: 'number'; readonly value: number })
  | FormulaCall
  | (FormulaSpan & { readonly kind: 'unary'; readonly op: '!' | '-'; readonly operand: FormulaNode })
  | (FormulaSpan & { readonly kind: 'binary'; readonly op: FormulaBinaryOp; readonly left: FormulaNode; readonly right: FormulaNode })
  | (FormulaSpan & { readonly kind: 'ternary'; readonly test: FormulaNode; readonly then: FormulaNode; readonly otherwise: FormulaNode });

export interface FormulaError {
  readonly message: string;
  /** Character offset of the problem (the formula's length when it ends too early). */
  readonly offset: number;
}

export type ParseFormulaResult = { readonly ok: true; readonly ast: FormulaNode } | { readonly ok: false; readonly error: FormulaError };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const PUNCTUATION = ['==', '!=', '<=', '>=', '&&', '||', '(', ')', ',', '?', ':', '+', '-', '*', '/', '!', '<', '>'] as const;
type Punctuation = (typeof PUNCTUATION)[number];

type Token = FormulaSpan &
  (
    | { readonly kind: 'number'; readonly value: number }
    | { readonly kind: 'string'; readonly value: string; readonly doubleQuoted: boolean }
    | { readonly kind: 'name'; readonly value: string }
    | { readonly kind: 'punct'; readonly value: Punctuation }
    | { readonly kind: 'end' }
  );

class FormulaSyntaxError extends Error {
  readonly offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

const isDigit = (char: string): boolean => char >= '0' && char <= '9';
const isNameStart = (char: string): boolean => /[A-Za-z_]/.test(char);
const isNamePart = (char: string): boolean => /[A-Za-z0-9_]/.test(char);

/** Hints for characters that look like an operator but are not one. */
const LOOKALIKES: Readonly<Record<string, string>> = {
  '=': "'=' is not an operator; compare with '=='",
  '&': "'&' is not an operator; 'and' is '&&'",
  '|': "'|' is not an operator; 'or' is '||'",
  '%': "'%' is not an operator (only + - * /)",
  '.': 'Numbers are whole numbers (no decimals)',
};

/**
 * Editor limits, not the plugin's: the parser, the validator and the evaluator recurse over the tree, so a formula with
 * more parts or deeper nesting is a syntax error here instead of a stack overflow (the filter is saved, so a crash would
 * repeat on every reload). Real formulas stay far below both (the guide's example has 39 parts and nests 4 deep).
 */
export const MAX_FORMULA_TOKENS = 512;
/** Nesting levels of parentheses, `!` / `-` and `? :` branches. */
export const MAX_FORMULA_DEPTH = 64;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (tokens.length >= MAX_FORMULA_TOKENS && !/\s/.test(char)) {
      throw new FormulaSyntaxError(`The formula is too long: more than ${String(MAX_FORMULA_TOKENS)} parts`, i);
    }
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    const start = i;
    if (isDigit(char)) {
      while (i < text.length && isDigit(text[i])) i += 1;
      if (text[i] === '.') throw new FormulaSyntaxError('Numbers are whole numbers (no decimals)', i);
      if (i < text.length && isNameStart(text[i])) throw new FormulaSyntaxError(`Unexpected '${text[i]}' after a number`, i);
      const digits = text.slice(start, i);
      const value = Number(digits);
      if (value > FORMULA_INT_MAX) {
        const shown = digits.length > 20 ? `${digits.slice(0, 20)}…` : digits;
        throw new FormulaSyntaxError(`The number ${shown} is above ${String(FORMULA_INT_MAX)} (values are 32-bit)`, start);
      }
      tokens.push({ kind: 'number', value, start, end: i });
      continue;
    }
    if (char === "'" || char === '"') {
      const close = text.indexOf(char, i + 1);
      if (close < 0) throw new FormulaSyntaxError(`The name starting here has no closing ${char}`, start);
      tokens.push({ kind: 'string', value: text.slice(i + 1, close), doubleQuoted: char === '"', start, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (isNameStart(char)) {
      while (i < text.length && isNamePart(text[i])) i += 1;
      tokens.push({ kind: 'name', value: text.slice(start, i), start, end: i });
      continue;
    }
    const punct = PUNCTUATION.find((candidate) => text.startsWith(candidate, i));
    if (punct === undefined) throw new FormulaSyntaxError(LOOKALIKES[char] ?? `Unexpected character '${char}'`, i);
    tokens.push({ kind: 'punct', value: punct, start, end: i + punct.length });
    i += punct.length;
  }
  tokens.push({ kind: 'end', start: text.length, end: text.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (precedence climbing)
// ---------------------------------------------------------------------------

function isBinaryOp(value: string): value is FormulaBinaryOp {
  return (BINARY_OPS as readonly string[]).includes(value);
}

function describe(token: Token): string {
  switch (token.kind) {
    case 'end':
      return 'the end of the formula';
    case 'string':
      return 'a quoted name';
    case 'number':
      return `the number ${String(token.value)}`;
    default:
      return `'${token.value}'`;
  }
}

class Parser {
  private position = 0;
  private depth = 0;
  private readonly tokens: readonly Token[];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[Math.min(this.position, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    this.position += 1;
    return token;
  }

  private isPunct(value: Punctuation): boolean {
    const token = this.peek();
    return token.kind === 'punct' && token.value === value;
  }

  private expect(value: Punctuation, what: string): Token {
    const token = this.peek();
    if (token.kind !== 'punct' || token.value !== value) {
      throw new FormulaSyntaxError(`Expected ${what}, found ${describe(token)}`, token.start);
    }
    return this.next();
  }

  /** Runs `parse` one nesting level deeper; past `MAX_FORMULA_DEPTH` a syntax error at `offset`. */
  private nested<T>(offset: number, parse: () => T): T {
    if (this.depth >= MAX_FORMULA_DEPTH) {
      throw new FormulaSyntaxError(
        `The formula is nested too deeply: more than ${String(MAX_FORMULA_DEPTH)} levels of parentheses, ! and - or ? :`,
        offset
      );
    }
    this.depth += 1;
    try {
      return parse();
    } finally {
      this.depth -= 1;
    }
  }

  parse(): FormulaNode {
    if (this.peek().kind === 'end') throw new FormulaSyntaxError('The formula is empty', 0);
    const node = this.ternary();
    const rest = this.peek();
    if (rest.kind !== 'end') {
      const hint = rest.kind === 'punct' && rest.value === ')' ? "a ')' without its '('" : describe(rest);
      throw new FormulaSyntaxError(`Expected an operator or the end of the formula, found ${hint}`, rest.start);
    }
    return node;
  }

  private ternary(): FormulaNode {
    const test = this.binary(1);
    if (!this.isPunct('?')) return test;
    const question = this.next();
    const then = this.nested(question.start, () => this.ternary());
    const colon = this.expect(':', "':' of 'a ? b : c'");
    const otherwise = this.nested(colon.start, () => this.ternary());
    return { kind: 'ternary', test, then, otherwise, start: test.start, end: otherwise.end };
  }

  private binary(minPrecedence: number): FormulaNode {
    let left = this.unary();
    for (;;) {
      const token = this.peek();
      if (token.kind !== 'punct' || !isBinaryOp(token.value)) return left;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence < minPrecedence) return left;
      this.next();
      const right = this.binary(precedence + 1);
      left = { kind: 'binary', op: token.value, left, right, start: left.start, end: right.end };
    }
  }

  private unary(): FormulaNode {
    const token = this.peek();
    if (token.kind === 'punct' && (token.value === '!' || token.value === '-')) {
      this.next();
      const operand = this.nested(token.start, () => this.unary());
      return { kind: 'unary', op: token.value, operand, start: token.start, end: operand.end };
    }
    if (token.kind === 'punct' && token.value === '+') {
      throw new FormulaSyntaxError("A '+' in front of a value is not supported; leave it out", token.start);
    }
    return this.primary();
  }

  private primary(): FormulaNode {
    const token = this.next();
    switch (token.kind) {
      case 'number':
        return { kind: 'number', value: token.value, start: token.start, end: token.end };
      case 'name':
        return this.call(token);
      case 'string':
        throw new FormulaSyntaxError(`A quoted name goes inside stat(…), e.g. stat('${token.value}')`, token.start);
      case 'end':
        throw new FormulaSyntaxError('The formula ends too early: a value is missing', token.start);
      case 'punct':
        if (token.value === '(') {
          const inner = this.nested(token.start, () => this.ternary());
          const close = this.expect(')', "')'");
          // The span covers the parentheses, so an error points at the group.
          return { ...inner, start: token.start, end: close.end };
        }
        throw new FormulaSyntaxError(`Expected a number, a function or '(', found ${describe(token)}`, token.start);
    }
  }

  private call(name: Token & { kind: 'name' }): FormulaCall {
    const fn = FORMULA_FUNCTIONS.find((candidate) => candidate === name.value);
    if (fn === undefined) {
      const other = FORMULA_FUNCTIONS.find((candidate) => candidate.toLowerCase() === name.value.toLowerCase());
      const hint = other === undefined ? ` (${FORMULA_FUNCTIONS.join(', ')})` : `; function names are case-sensitive: '${other}'`;
      throw new FormulaSyntaxError(`Unknown function '${name.value}'${hint}`, name.start);
    }
    this.expect('(', `'(' after ${fn}`);
    const stat = this.statArgument(fn);
    let param: FormulaParamArg | undefined;
    if (this.isPunct(',')) {
      const comma = this.next();
      if (MAX_ARGUMENTS[fn] < 2) throw new FormulaSyntaxError(`${fn} takes the stat only (it reads every param)`, comma.start);
      param = this.paramArgument(fn);
    }
    if (this.isPunct(',')) throw new FormulaSyntaxError(`${fn} takes at most two arguments: the stat and a param`, this.peek().start);
    const close = this.expect(')', `')' to close ${fn}(`);
    return { kind: 'call', fn, nameStart: name.start, stat, ...(param === undefined ? {} : { param }), start: name.start, end: close.end };
  }

  private statArgument(fn: FormulaFunction): FormulaStatArg {
    const token = this.next();
    const span = { start: token.start, end: token.end };
    if (token.kind === 'number') return { kind: 'id', id: token.value, quoted: false, doubleQuoted: false, ...span };
    if (token.kind !== 'string') {
      throw new FormulaSyntaxError(`${fn} needs a stat: a name in quotes or a row number, found ${describe(token)}`, token.start);
    }
    // Names are taken as written (no trimming): ' 39 ' and ' fireresist' are names the game data does not know.
    if (token.value.trim() === '') throw new FormulaSyntaxError('The stat name is empty', token.start);
    if (/^\d+$/.test(token.value)) return { kind: 'id', id: Number(token.value), quoted: true, doubleQuoted: token.doubleQuoted, ...span };
    return { kind: 'name', name: token.value, doubleQuoted: token.doubleQuoted, ...span };
  }

  private paramArgument(fn: FormulaFunction): FormulaParamArg {
    const token = this.next();
    const span = { start: token.start, end: token.end };
    if (token.kind === 'number') return { kind: 'number', value: token.value, quoted: false, doubleQuoted: false, ...span };
    if (token.kind !== 'string') {
      throw new FormulaSyntaxError(`The param of ${fn} is a number or a skill name in quotes, found ${describe(token)}`, token.start);
    }
    if (token.value.trim() === '') throw new FormulaSyntaxError('The skill name is empty', token.start);
    if (/^\d+$/.test(token.value)) {
      return { kind: 'number', value: Number(token.value), quoted: true, doubleQuoted: token.doubleQuoted, ...span };
    }
    return { kind: 'skill', name: token.value, doubleQuoted: token.doubleQuoted, ...span };
  }
}

/** Parses a formula into its syntax tree, or the first syntax error with its character offset. */
export function parseFormula(text: string): ParseFormulaResult {
  try {
    return { ok: true, ast: new Parser(tokenize(text)).parse() };
  } catch (error) {
    if (error instanceof FormulaSyntaxError) return { ok: false, error: { message: error.message, offset: error.offset } };
    // The limits above should prevent it; a stack overflow must still not take the page down.
    if (error instanceof RangeError) return { ok: false, error: { message: 'The formula is too complex', offset: 0 } };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Walking the tree
// ---------------------------------------------------------------------------

/** Every node of the tree, parents before children, left to right. */
export function formulaNodes(ast: FormulaNode): FormulaNode[] {
  const nodes: FormulaNode[] = [];
  const visit = (node: FormulaNode): void => {
    nodes.push(node);
    switch (node.kind) {
      case 'unary':
        visit(node.operand);
        break;
      case 'binary':
        visit(node.left);
        visit(node.right);
        break;
      case 'ternary':
        visit(node.test);
        visit(node.then);
        visit(node.otherwise);
        break;
      default:
        break;
    }
  };
  visit(ast);
  return nodes;
}

/** The function calls of a formula in source order: what the validator checks (functions, stats, params, skill names). */
export function formulaReferences(ast: FormulaNode): FormulaCall[] {
  return formulaNodes(ast)
    .filter((node): node is FormulaCall => node.kind === 'call')
    .sort((a, b) => a.nameStart - b.nameStart);
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** One stat entry of the item or character (the evaluator's `ItemStatEntry`); an entry without param has param 0. */
export interface FormulaStatEntry {
  readonly stat: number;
  readonly param?: number;
  readonly value: number;
}

/** How a stat's param is encoded, for skill-name params (see game-data/engine/statLayers.ts). */
export type FormulaParamKind = 'skill' | 'skillLevel' | 'other';

export interface FormulaContext {
  readonly itemStats: readonly FormulaStatEntry[];
  readonly playerStats: readonly FormulaStatEntry[];
  /** itemstatcost `Stat` → row id */
  readonly statIds: ReadonlyMap<string, number>;
  /** skills.txt `skill` → id; looked up by {@link formulaSkillKey} */
  readonly skillIds: ReadonlyMap<string, number>;
  /** How the stat's param is encoded: a skill id, skill × 64 + level (event, charged), or anything else. */
  readonly paramKind: (stat: number) => FormulaParamKind;
}

/** The key a skill name is looked up by in {@link FormulaContext.skillIds} (lowercase while skill names ignore case). */
export function formulaSkillKey(name: string): string {
  return SKILL_NAMES_IGNORE_CASE ? name.toLowerCase() : name;
}

/** Signed 32-bit wrap, like a C `int`. */
const int32 = (value: number): number => value | 0;
const truth = (value: boolean): number => (value ? 1 : 0);

export function resolveFormulaStat(stat: FormulaStatArg, statIds: ReadonlyMap<string, number>): number | undefined {
  return stat.kind === 'id' ? stat.id : statIds.get(stat.name);
}

function callValue(call: FormulaCall, context: FormulaContext): number {
  const id = resolveFormulaStat(call.stat, context.statIds);
  if (id === undefined) return 0;
  const entries = (call.fn === 'playerStat' ? context.playerStats : context.itemStats).filter((entry) => entry.stat === id);
  const values = (match: (param: number) => boolean) => entries.filter((entry) => match(entry.param ?? 0)).map((entry) => entry.value);
  switch (call.fn) {
    case 'statMax':
      return entries.length === 0 ? 0 : int32(Math.max(...entries.map((entry) => entry.value)));
    case 'statSum':
      return entries.reduce((sum, entry) => int32(sum + entry.value), 0);
    case 'stat':
    case 'playerStat': {
      const { param } = call;
      if (param === undefined) return int32(values((p) => p === 0).at(0) ?? 0);
      if (param.kind === 'number') return int32(values((p) => p === param.value).at(0) ?? 0);
      const skill = context.skillIds.get(formulaSkillKey(param.name));
      if (skill === undefined) return 0;
      if (context.paramKind(id) === 'skillLevel') {
        const any = values((p) => p >> 6 === skill);
        return any.length === 0 ? 0 : int32(Math.max(...any));
      }
      return int32(values((p) => p === skill).at(0) ?? 0);
    }
  }
}

function binaryValue(op: FormulaBinaryOp, left: number, right: () => number): number {
  switch (op) {
    case '&&':
      return truth(left !== 0 && right() !== 0);
    case '||':
      return truth(left !== 0 || right() !== 0);
    default:
      break;
  }
  const b = right();
  switch (op) {
    case '+':
      return int32(left + b);
    case '-':
      return int32(left - b);
    case '*':
      return Math.imul(left, b);
    case '/':
      return b === 0 ? 0 : int32(Math.trunc(left / b));
    case '==':
      return truth(left === b);
    case '!=':
      return truth(left !== b);
    case '<':
      return truth(left < b);
    case '<=':
      return truth(left <= b);
    case '>':
      return truth(left > b);
    case '>=':
      return truth(left >= b);
  }
}

/** The formula's value: a signed 32-bit whole number; the condition holds when it is not 0. */
export function evaluateFormula(ast: FormulaNode, context: FormulaContext): number {
  switch (ast.kind) {
    case 'number':
      return int32(ast.value);
    case 'call':
      return callValue(ast, context);
    case 'unary': {
      const value = evaluateFormula(ast.operand, context);
      return ast.op === '!' ? truth(value === 0) : int32(-value);
    }
    case 'binary':
      return binaryValue(ast.op, evaluateFormula(ast.left, context), () => evaluateFormula(ast.right, context));
    case 'ternary':
      return evaluateFormula(ast.test, context) !== 0 ? evaluateFormula(ast.then, context) : evaluateFormula(ast.otherwise, context);
  }
}
