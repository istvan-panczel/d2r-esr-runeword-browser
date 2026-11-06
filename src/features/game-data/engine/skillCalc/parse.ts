/**
 * The game's calc language compiler (skills.txt / skilldesc.txt / missiles.txt formula cells), ported from Fog
 * `DATATBLS_CompileExpression` (D2MOO `Calc.cpp`) so a formula gets exactly the tree the game builds. It is a
 * shunting-yard over a value stack with the game's own precedence rule, which differs from the conventional one:
 *
 * - `DATATABLS_CheckPrecendence(prev, next)`: a pending operator `prev` is applied before `next` is pushed when
 *   `PRECEDENCE[prev] >= next` (both are AST enum values; function calls and `:` never pop). Comparisons (10-15) pop
 *   comparisons; `+` `-` (16, 17) pop up to `-`; `*` `/` (18, 19) up to `/`; `^` (20) up to `^` (left-associative);
 *   unary minus (21) up to itself, so `-2^2` = `(-2)^2`.
 * - The ternary (22) is pushed above anything but a pending ternary: `a < b ? c : d` = `a < (b ? c : d)` and
 *   `-(x) ? 0 : y` = `-(x ? 0 : y)` (ESR Cloak of Shadows). `:` applies nothing and is not pushed. Any operator after
 *   the else-operand applies the ternary first: `c ? 5 : 0 + x` = `(c ? 5 : 0) + x` (ESR Sharpened Focus), and an
 *   operator inside the then-operand applies it too early (it takes the values on the stack, outer ones included).
 * - `-` is a negation only when no value precedes it. Values and function names set that state; `+ - * /` and the
 *   comparisons clear it; `?`, `:`, `,`, `(`, `)` and `^` leave it, so `c ? 1 : -x` subtracts.
 * - An operator that finds too few values on the stack fails the whole formula (the game compiles it to nothing).
 * - A character the tokenizer does not know (`&`, `|`, `_`, a lone `=` or `!`) ends the formula there: the game
 *   compiles what came before. An unclosed `(` stops the evaluation at that point; values left over are ignored (the
 *   result is the top of the stack). These cases are reported in `notes`.
 *
 * Tokens: numbers (digits), codes (`lvl`, `ln12`: a letter, then letters and digits), functions (`min`, `max`, `rand`
 * take two values; `skill`, `stat`, `miss`, `sksrc`, `sklvl` take a link `'Name'.field[.field]`), links and the
 * operators `+ - * / ^ < > <= >= == != ? : , ( )`. Whitespace and double quotes are skipped. A name followed by `(` that
 * is not a function is a code followed by a parenthesis, as in the game.
 *
 * Compiling never throws: a broken formula becomes a `{ kind: 'error' }` node. Results are cached per text.
 */

export type CalcBinaryOp = '+' | '-' | '*' | '/' | '^' | '<' | '>' | '<=' | '>=' | '==' | '!=';

export interface CalcLink {
  /** Text between the quotes: a skill, stat or missile name */
  name: string;
  /** The `.field` parts after the quotes (`blvl`, `accr`, `lvl` + `edmn`) */
  fields: string[];
}

export type CalcNode =
  | { kind: 'num'; value: number }
  | { kind: 'code'; code: string }
  | { kind: 'neg'; arg: CalcNode }
  | { kind: 'bin'; op: CalcBinaryOp; left: CalcNode; right: CalcNode }
  | { kind: 'ternary'; cond: CalcNode; then: CalcNode; else: CalcNode }
  | { kind: 'call'; name: string; args: CalcNode[] }
  | { kind: 'link'; link: CalcLink }
  | { kind: 'error'; message: string };

export interface CompiledCalc {
  node: CalcNode;
  /** Where the game's compiler does something a formula author probably did not mean (see the file comment) */
  notes: string[];
}

/** Fog AST types (D2MOO `FOGASTType`) */
const AST = {
  None: 0,
  Callback: 1,
  Paren: 2,
  Separator: 3,
  Lt: 10,
  Gt: 11,
  Le: 12,
  Ge: 13,
  Eq: 14,
  Ne: 15,
  Add: 16,
  Sub: 17,
  Mul: 18,
  Div: 19,
  Pow: 20,
  Neg: 21,
  Ternary: 22,
  Colon: 23,
} as const;

/** `aASTOperatorPrecedence`: a pending operator of this type is applied before a new one whose type is <= the value */
const PRECEDENCE: readonly number[] = [23, 1, 2, 3, 9, 9, 9, 9, 9, 9, 15, 15, 15, 15, 15, 15, 17, 17, 19, 19, 20, 21, 22, 0];

const BINARY: Readonly<Partial<Record<number, CalcBinaryOp>>> = {
  [AST.Lt]: '<',
  [AST.Gt]: '>',
  [AST.Le]: '<=',
  [AST.Ge]: '>=',
  [AST.Eq]: '==',
  [AST.Ne]: '!=',
  [AST.Add]: '+',
  [AST.Sub]: '-',
  [AST.Mul]: '*',
  [AST.Div]: '/',
  [AST.Pow]: '^',
};

/** Functions of the skill calc table and how many values they take */
const FUNCTION_ARITY: Readonly<Record<string, number>> = { min: 2, max: 2, rand: 2, skill: 2, stat: 2, miss: 2, sksrc: 2, sklvl: 3 };
/** Functions whose argument is a link (`skill('Name'.blvl)`) */
const LINK_FUNCTIONS: ReadonlySet<string> = new Set(['skill', 'stat', 'miss', 'sksrc', 'sklvl']);

const OPERATOR_TYPES: Readonly<Record<string, number>> = {
  '<': AST.Lt,
  '>': AST.Gt,
  '<=': AST.Le,
  '>=': AST.Ge,
  '==': AST.Eq,
  '!=': AST.Ne,
  '+': AST.Add,
  '*': AST.Mul,
  '/': AST.Div,
  '^': AST.Pow,
  '?': AST.Ternary,
  ':': AST.Colon,
  ',': AST.Separator,
};
/** Operators after which a `-` is a negation (they clear the "value pending" state) */
const CLEARS_PENDING_VALUE: ReadonlySet<string> = new Set(['+', '-', '*', '/', '<', '>', '<=', '>=', '==', '!=']);

type Token =
  | { type: 'num'; value: number }
  | { type: 'code'; value: string }
  | { type: 'function'; value: string }
  | { type: 'link'; link: CalcLink }
  | { type: 'op'; value: string };

const isSpace = (char: string) => char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\v' || char === '\f';
const isDigit = (char: string) => char >= '0' && char <= '9';
const isAlpha = (char: string) => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
const isAlnum = (char: string) => isAlpha(char) || isDigit(char);

/** `DATATABLS_ParseExpressionToken` in a loop; an unknown character ends the token list (noted) */
function tokenize(text: string, notes: string[]): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const at = (i: number) => text.charAt(i);
  const skipBlank = () => {
    while (pos < text.length && (isSpace(at(pos)) || at(pos) === '"')) pos++;
  };
  const word = () => {
    const start = pos;
    while (isAlnum(at(pos))) pos++;
    return text.slice(start, pos);
  };
  for (;;) {
    skipBlank();
    if (pos >= text.length) return tokens;
    const char = at(pos);
    if (isDigit(char)) {
      const start = pos;
      while (isDigit(at(pos))) pos++;
      tokens.push({ type: 'num', value: Number(text.slice(start, pos)) | 0 });
      continue;
    }
    if (char === "'") {
      const end = text.indexOf("'", pos + 1);
      const name = text.slice(pos + 1, end === -1 ? text.length : end);
      pos = end === -1 ? text.length : end + 1;
      const fields: string[] = [];
      for (;;) {
        const save = pos;
        skipBlank();
        if (at(pos) !== '.') {
          pos = save;
          break;
        }
        pos++;
        const field = word();
        if (field === '') {
          notes.push(`stopped at an empty field after '${name}'`);
          if (fields.length > 0 || name !== '') tokens.push({ type: 'link', link: { name, fields } });
          return tokens;
        }
        fields.push(field);
      }
      tokens.push({ type: 'link', link: { name, fields } });
      continue;
    }
    if (isAlpha(char)) {
      const name = word();
      while (isSpace(at(pos))) pos++;
      if (at(pos) === '(' && name in FUNCTION_ARITY) {
        pos++;
        tokens.push({ type: 'function', value: name });
      } else tokens.push({ type: 'code', value: name });
      continue;
    }
    const two = text.slice(pos, pos + 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=') {
      tokens.push({ type: 'op', value: two });
      pos += 2;
      continue;
    }
    if ('()*+,-/:<>?^'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      pos++;
      continue;
    }
    notes.push(`stopped at "${char}" (position ${String(pos)}): the game ignores the rest`);
    return tokens;
  }
}

class CompileError extends Error {}

interface PendingOp {
  type: number;
  /** Function name (Callback) */
  name?: string;
}

/** `DATATABLS_CheckPrecendence` */
function appliesBefore(previous: number, next: number): boolean {
  if (previous === AST.Callback || next === AST.Callback || previous >= AST.Colon) return false;
  return (PRECEDENCE[previous] ?? 0) >= next;
}

function arity(op: PendingOp): number {
  if (op.type === AST.Callback) return FUNCTION_ARITY[op.name ?? ''] ?? 2;
  if (op.type === AST.Neg) return 1;
  if (op.type === AST.Ternary) return 3;
  return op.type in BINARY ? 2 : 0;
}

function compileTokens(tokens: readonly Token[], notes: string[]): CalcNode {
  const values: CalcNode[] = [];
  const ops: PendingOp[] = [];
  let pendingValue = false;
  let emitted = false;
  /** Set when an unclosed "(" is emitted: the game's evaluator returns the top of the stack there */
  const stop: { at: CalcNode | null } = { at: null };

  const emit = (op: PendingOp) => {
    const count = arity(op);
    if (values.length < count) throw new CompileError(`too few values for ${op.name ?? String(op.type)}`);
    emitted = true;
    const args = values.splice(values.length - count, count);
    if (op.type === AST.Paren) {
      if (stop.at === null) {
        notes.push('unclosed "(": the game stops evaluating there');
        stop.at = values.at(-1) ?? { kind: 'num', value: 0 };
      }
      return;
    }
    const [a, b, c] = args as [CalcNode, CalcNode, CalcNode];
    if (op.type === AST.Callback) values.push({ kind: 'call', name: op.name ?? '', args });
    else if (op.type === AST.Neg) values.push({ kind: 'neg', arg: a });
    else if (op.type === AST.Ternary) values.push({ kind: 'ternary', cond: a, then: b, else: c });
    else {
      const binary = BINARY[op.type];
      if (binary === undefined) throw new CompileError(`unexpected operator ${String(op.type)}`);
      values.push({ kind: 'bin', op: binary, left: a, right: b });
    }
  };
  /** `DATATBLS_Evaluate_HandleNewOp` */
  const newOp = (type: number) => {
    for (let top = ops.at(-1); top !== undefined && appliesBefore(top.type, type); top = ops.at(-1)) {
      emit(top);
      ops.pop();
    }
    if (type === AST.Colon || type === AST.Separator) return;
    if (type === AST.None) {
      if (!emitted && values.length === 0) throw new CompileError('empty formula');
      return;
    }
    ops.push({ type });
  };
  const value = (node: CalcNode) => {
    values.push(node);
    pendingValue = true;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.type) {
      case 'num':
        value({ kind: 'num', value: token.value });
        break;
      case 'code':
        value({ kind: 'code', code: token.value });
        break;
      case 'link':
        value({ kind: 'link', link: token.link });
        break;
      case 'function': {
        const link = tokens.at(i + 1);
        const close = tokens.at(i + 2);
        if (LINK_FUNCTIONS.has(token.value) && link?.type === 'link' && close?.type === 'op' && close.value === ')') {
          // skill('Name'.blvl): the link's values and the call are one leaf
          value({ kind: 'call', name: token.value, args: [{ kind: 'link', link: link.link }] });
          i += 2;
          break;
        }
        ops.push({ type: AST.Callback, name: token.value });
        pendingValue = true;
        break;
      }
      case 'op': {
        const op = token.value;
        if (op === '(') {
          ops.push({ type: AST.Paren });
          break;
        }
        if (op === ')') {
          if (ops.length === 0) throw new CompileError('")" without "("');
          for (;;) {
            const top = ops.at(-1);
            if (top === undefined) throw new CompileError('")" without "("');
            if (top.type === AST.Paren) break;
            emit(top);
            if (top.type === AST.Callback) break;
            ops.pop();
            if (ops.length === 0) throw new CompileError('")" without "("');
          }
          ops.pop();
          break;
        }
        newOp(op === '-' ? (pendingValue ? AST.Sub : AST.Neg) : (OPERATOR_TYPES[op] ?? AST.None));
        if (CLEARS_PENDING_VALUE.has(op)) pendingValue = false;
        break;
      }
    }
  }
  newOp(AST.None);
  if (ops.some((op) => op.type === AST.Callback)) notes.push('unclosed function call');
  if (stop.at !== null) return stop.at;
  const result = values.at(-1);
  if (result === undefined) throw new CompileError('no value');
  if (values.length > 1) notes.push(`${String(values.length - 1)} value(s) left over: the game uses the last one`);
  return result;
}

const cache = new Map<string, CompiledCalc>();

/** Compiles a formula cell the way the game does (cached by text). An empty cell is the number 0. */
export function compileCalc(text: string): CompiledCalc {
  let compiled = cache.get(text);
  if (compiled === undefined) {
    const notes: string[] = [];
    let node: CalcNode;
    try {
      const tokens = tokenize(text, notes);
      node = tokens.length === 0 && notes.length === 0 ? { kind: 'num', value: 0 } : compileTokens(tokens, notes);
    } catch (error) {
      node = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
    compiled = { node, notes };
    cache.set(text, compiled);
  }
  return compiled;
}

/** The game's tree of a formula cell (see `compileCalc`) */
export function parseCalc(text: string): CalcNode {
  return compileCalc(text).node;
}

/** A formula written back with every operation parenthesised (tests, reviews): `(-((x > 0) ? 0 : (10 + (lvl / 2))))` */
export function formatCalc(node: CalcNode): string {
  switch (node.kind) {
    case 'num':
      return String(node.value);
    case 'code':
      return node.code;
    case 'neg':
      return `(-${formatCalc(node.arg)})`;
    case 'bin':
      return `(${formatCalc(node.left)} ${node.op} ${formatCalc(node.right)})`;
    case 'ternary':
      return `(${formatCalc(node.cond)} ? ${formatCalc(node.then)} : ${formatCalc(node.else)})`;
    case 'call':
      return `${node.name}(${node.args.map(formatCalc).join(', ')})`;
    case 'link':
      return `'${node.link.name}'${node.link.fields.map((field) => `.${field}`).join('')}`;
    case 'error':
      return `<error: ${node.message}>`;
  }
}
